#!/usr/bin/env node
/**
 * The account emails Supabase Auth sends (confirm sign-up, password reset...),
 * in the store's style. Writes supabase/email-templates/<name>.html, each to
 * be pasted into Supabase > Authentication > Emails > Templates, with the
 * subject line from SUBJECTS.md alongside.
 *
 *   node scripts/make-auth-emails.mjs
 *
 * Only Confirm sign up and Reset password are sent by the site today; the
 * rest are done so nothing ever goes out looking like the default template.
 * {{ .ConfirmationURL }} etc. are Supabase's template variables.
 */
import { writeFile, mkdir } from 'node:fs/promises';

const SITE = 'https://www.camarillobookworm.com';
const GREEN = '#1B4332';
const out = new URL('../supabase/email-templates/', import.meta.url);

const button = (href, label) => `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr>
        <td style="background:${GREEN};border-radius:6px"><a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${label}</a></td>
      </tr></table>
      <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#777">If the button doesn't work, copy this link into your browser:<br><a href="${href}" style="color:${GREEN};word-break:break-all">${href}</a></p>`;

const code = (token) => `
      <p style="margin:26px 0;font-family:Helvetica,Arial,sans-serif;font-size:34px;letter-spacing:.3em;font-weight:bold;color:${GREEN}">${token}</p>`;

const shell = (heading, body, closing) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="background:${GREEN};padding:22px 32px">
    <a href="${SITE}" style="font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#ffffff;text-decoration:none"><i style="font-weight:normal">The</i> Bookworm</a>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#B7E4C7;margin-top:3px">Camarillo's independent bookstore since 1973</div>
  </td></tr>
  <tr><td style="padding:32px 32px 8px">
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:24px;color:${GREEN}">${heading}</h1>
      <img src="${SITE}/brand/glasses.png" width="150" height="73" alt="" style="display:block;border:0;margin:0 0 22px">
      ${body}
      ${closing ? `<p style="margin:18px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#555">${closing}</p>` : ''}
  </td></tr>
  <tr><td style="padding:24px 32px 32px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#777">
    <hr style="border:none;border-top:1px solid #e5e0d5;margin:0 0 16px">
    The Bookworm · 93 E Daily Dr, Camarillo, CA 93010 · <a href="tel:+18054821384" style="color:#777">(805) 482-1384</a><br>
    Questions? Just reply to this email or write to <a href="mailto:hello@camarillobookworm.com" style="color:#777">hello@camarillobookworm.com</a>.
  </td></tr>
</table></td></tr></table></body></html>
`;

const p = (text) => `<p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#333">${text}</p>`;
const IGNORE = "If you didn't ask for this, you can ignore this email - nothing will change.";

const TEMPLATES = {
  'confirm-signup': {
    subject: 'Confirm your email for The Bookworm',
    html: shell('Welcome to The Bookworm',
      p('Thanks for creating an account. Confirm your email address and you\'re all set - your wishlist, orders and event RSVPs will be waiting for you.')
      + button('{{ .ConfirmationURL }}', 'Confirm my email'),
      "If you didn't create an account with us, you can ignore this email."),
  },
  'reset-password': {
    subject: 'Reset your password for The Bookworm',
    html: shell('Reset your password',
      p('We got a request to reset the password for {{ .Email }}. Choose a new one here:')
      + button('{{ .ConfirmationURL }}', 'Choose a new password')
      + p('<span style="font-size:14px;color:#555">The link works once and expires in an hour.</span>'),
      IGNORE),
  },
  'magic-link': {
    subject: 'Your sign-in link for The Bookworm',
    html: shell('Sign in to The Bookworm',
      p('Here\'s your one-time sign-in link for {{ .Email }}:')
      + button('{{ .ConfirmationURL }}', 'Sign me in')
      + p('<span style="font-size:14px;color:#555">The link works once and expires shortly. Your one-time code, if asked for it, is <b>{{ .Token }}</b>.</span>'),
      IGNORE),
  },
  'change-email': {
    subject: 'Confirm your new email address',
    html: shell('Confirm your new email address',
      p('You asked to change the email on your Bookworm account from {{ .Email }} to <b>{{ .NewEmail }}</b>. Confirm the new address here:')
      + button('{{ .ConfirmationURL }}', 'Confirm new email'),
      IGNORE),
  },
  'invite-user': {
    subject: "You're invited to The Bookworm",
    html: shell("You're invited",
      p('You\'ve been invited to create an account at The Bookworm, Camarillo\'s independent bookstore. Accept the invitation to set up your account:')
      + button('{{ .ConfirmationURL }}', 'Accept invitation'),
      "If you weren't expecting this, you can ignore this email."),
  },
  'reauthentication': {
    subject: '{{ .Token }} is your Bookworm verification code',
    html: shell('Your verification code',
      p('Enter this code to confirm it\'s you. It expires shortly.')
      + code('{{ .Token }}'),
      IGNORE),
  },
};

await mkdir(out, { recursive: true });
const subjects = ['# Supabase auth email subjects', '', 'Paste each into the matching template\'s Subject field.', ''];
for (const [name, t] of Object.entries(TEMPLATES)) {
  await writeFile(new URL(`${name}.html`, out), t.html);
  subjects.push(`- **${name}.html** → \`${t.subject}\``);
}
await writeFile(new URL('SUBJECTS.md', out), subjects.join('\n') + '\n');
console.log(Object.keys(TEMPLATES).join(', '));
