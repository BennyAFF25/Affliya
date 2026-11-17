import { Resend } from 'resend';
import { renderNettmarkEmail, type RenderNettmarkEmailArgs } from '../email/renderNettmarkEmail';
export function growthEmailAllowed(email: string, env = process.env) {
  if (env.VERCEL_ENV === 'production') return true;
  const normalized = email.trim().toLowerCase();
  if (!env.NON_PRODUCTION_EMAIL_ALLOWLIST) return /^nettmarkqa(?:\+[^@\s]+)?@mail\.grokbot\.com$/.test(normalized);
  return env.NON_PRODUCTION_EMAIL_ALLOWLIST.split(',').some(entry => {
    const allowed = entry.trim().toLowerCase();
    return allowed.startsWith('@') ? normalized.endsWith(allowed) : normalized === allowed;
  });
}
export const growthOrigin = () => (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.nettmark.com').replace(/\/$/, '');
export async function sendGrowthEmail(to: string, subject: string, content: RenderNettmarkEmailArgs) {
  if (!growthEmailAllowed(to)) { console.info('[growth-partners] Email skipped', { recipient: `${to.slice(0, 1)}***@***` }); return { skipped: true }; }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return { skipped: true };
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `${process.env.RESEND_FROM_NAME || 'Nettmark'} <${process.env.RESEND_FROM_EMAIL}>`,
      to, subject, html: renderNettmarkEmail(content),
    });
    if (result.error) throw new Error('Email failed');
    return { sent: true };
  } catch { console.warn('[growth-partners] Email delivery failed'); return { sent: false }; }
}
