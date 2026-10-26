// Minimal Stripe client for Cloudflare Pages Functions. No dependencies:
// plain fetch for the API, WebCrypto for webhook signatures.

const API = 'https://api.stripe.com/v1';

// Stripe wants form bodies with bracket notation: a[b][0][c]=d
export function encodeForm(value, prefix = '', out = []) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
  }
  return out;
}

export function createStripe(env, fetchImpl = fetch) {
  async function call(method, path, params, { idempotencyKey } = {}) {
    const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
    if (env.STRIPE_API_VERSION) headers['Stripe-Version'] = env.STRIPE_API_VERSION;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    let url = API + path;
    let body;
    if (method === 'GET') {
      const qs = encodeForm(params).join('&');
      if (qs) url += `?${qs}`;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = encodeForm(params).join('&');
    }
    const res = await fetchImpl(url, { method, headers, body });
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(`Stripe ${method} ${path}: ${json.error?.message || res.status}`);
      err.status = res.status;
      err.stripe = json.error;
      throw err;
    }
    return json;
  }
  return {
    get: (path, params) => call('GET', path, params),
    post: (path, params, opts) => call('POST', path, params, opts),
  };
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verifies a Stripe-Signature header (works for snapshot and thin events).
// Returns the parsed event, or throws.
export async function verifyWebhook(rawBody, header, secret, { tolerance = 300, now = Date.now() } = {}) {
  if (!header || !secret) throw new Error('missing signature or secret');
  const parts = header.split(',').map((p) => p.split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length) throw new Error('malformed signature header');
  if (Math.abs(now / 1000 - Number(t)) > tolerance) throw new Error('timestamp outside tolerance');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`)));
  if (!sigs.some((s) => safeEqual(s, expected))) throw new Error('signature mismatch');
  return JSON.parse(rawBody);
}
