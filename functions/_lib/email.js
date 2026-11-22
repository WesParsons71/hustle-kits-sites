// Kit confirmation email through Resend. No SDK: one fetch, Workers-safe.
// Docs: https://resend.com/docs/api-reference/emails/send-email
import { EMAIL } from './bbq-config.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// A paid (or fully discounted) session that includes the Kit, either alone or in the combo.
export function isKitPurchase(session, cfg) {
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) return false;
  const products = (session.line_items?.data ?? []).map((li) => li.price?.product);
  return products.includes(cfg.kitProduct) || products.some((p) => cfg.products[p] === 'combo');
}

export function firstName(fullName) {
  const first = String(fullName ?? '').trim().split(/\s+/)[0];
  return first || null;
}

// Pure: builds the message body. deliveryUrl is the link to the Kit files.
export function kitEmail({ name, deliveryUrl, dfyFormUrl = EMAIL.dfyFormUrl }) {
  const hi = firstName(name) ? `Hi ${firstName(name)},` : 'Hi there,';
  const subject = 'Your BBQ Hustle Kit is ready';
  const inside = [
    ['Build the Business', 'the 12 modules, each with its worksheet.'],
    ['Master the Smoke', 'the BBQ chapters, from smoking fundamentals to catering.'],
    ['Two cost calculators', 'the Meat Cost Calculator and the Catering Cost Calculator. Open "Your Calculators - Start Here" in the Tools folder to make your own working copy of each.'],
    ['Your Done For You month', 'one finished month of social media posts, built from your answers.'],
  ];

  const text = [
    hi, '',
    'Thank you for getting the BBQ Hustle Kit. Your files are ready.', '',
    `Open your Kit: ${deliveryUrl}`, '',
    "What's inside:",
    ...inside.map(([a, b]) => `- ${a}: ${b}`), '',
    'Your Done For You month',
    `Fill in the intake form here: ${dfyFormUrl}`,
    'Expect your month within 3 to 5 business days.', '',
    'Questions? Reply to this email or write to hello@thebbqhustle.com.', '',
    'The BBQ Hustle',
  ].join('\n');

  const li = inside.map(([a, b]) => `<li style="margin:0 0 8px;"><strong>${esc(a)}:</strong> ${esc(b)}</li>`).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6ede1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6ede1;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:4px;">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#241a14;font-weight:bold;">Your BBQ Hustle Kit is ready</td></tr>
<tr><td style="padding:0 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#241a14;">
<p style="margin:16px 0;">${esc(hi)}</p>
<p style="margin:16px 0;">Thank you for getting the BBQ Hustle Kit. Your files are ready.</p>
<p style="margin:24px 0;"><a href="${esc(deliveryUrl)}" style="background:#c65d2e;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:3px;font-weight:bold;display:inline-block;">Open your Kit</a></p>
<p style="margin:16px 0 8px;font-weight:bold;">What's inside</p>
<ul style="margin:0 0 16px;padding-left:20px;">${li}</ul>
<p style="margin:24px 0 8px;font-weight:bold;">Your Done For You month</p>
<p style="margin:0 0 8px;">Fill in the <a href="${esc(dfyFormUrl)}" style="color:#c65d2e;">intake form</a> to get your month started. Expect it within 3 to 5 business days.</p>
<p style="margin:24px 0 0;">Questions? Reply to this email or write to <a href="mailto:hello@thebbqhustle.com" style="color:#c65d2e;">hello@thebbqhustle.com</a>.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5a4c3e;">The BBQ Hustle</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// Sends one message. idempotencyKey makes a retried webhook safe (Resend keeps keys for 24 hours).
export async function sendEmail(env, { to, subject, html, text, idempotencyKey }, fetchFn = fetch) {
  if (!env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({ from: env.EMAIL_FROM || EMAIL.from, to: [to], reply_to: EMAIL.replyTo, subject, html, text }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend send failed: ${json.message ?? res.status}`);
  return json; // { id }
}
