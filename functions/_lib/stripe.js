// Minimal Stripe REST helpers for Cloudflare Pages Functions (no SDK, Workers-safe).

// Stripe wants form-encoded bodies with bracketed keys: a[0][b]=c
export function encodeForm(value, prefix = '', out = []) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
  } else {
    out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(value)}`);
  }
  return out;
}

// STRIPE_MODE defaults to "test". Live needs an explicit STRIPE_MODE=live.
export function stripeMode(env) {
  return env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

export function secrets(env) {
  const mode = stripeMode(env);
  const suffix = mode === 'live' ? 'LIVE' : 'TEST';
  return {
    mode,
    secretKey: env[`STRIPE_SECRET_KEY_${suffix}`],
    webhookSecret: env[`STRIPE_WEBHOOK_SECRET_${suffix}`],
  };
}

export async function stripe(env, method, path, params, { idempotencyKey } = {}) {
  const { secretKey } = secrets(env);
  if (!secretKey) throw new Error(`Missing STRIPE_SECRET_KEY_${stripeMode(env).toUpperCase()}`);
  const headers = { Authorization: `Bearer ${secretKey}` };
  let url = `https://api.stripe.com/v1${path}`;
  let body;
  const encoded = params ? encodeForm(params).join('&') : '';
  if (method === 'GET') {
    if (encoded) url += `?${encoded}`;
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encoded;
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(url, { method, headers, body });
  const json = await res.json();
  if (!res.ok) {
    const e = new Error(`Stripe ${method} ${path} failed: ${json.error?.message ?? res.status}`);
    e.stripe = json.error;
    throw e;
  }
  return json;
}

// Verifies the Stripe-Signature header (t=...,v1=...) against the raw body.
export async function verifySignature(payload, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
