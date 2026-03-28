import { Resend } from 'resend';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { getSESClient } from './awsClients';

export interface SendLetterParams {
  to: string;
  donorName: string;
  orgName: string;
  totalAmount: number;
  dateRange?: string;
  taxId?: string;
  donations?: { date: string; description: string; amount: number }[];
  pdfUrl?: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

export function buildEmailHtml(params: SendLetterParams): string {
  const { donorName, orgName, totalAmount, dateRange, taxId, donations, pdfUrl } = params;
  const formatted = totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const donationsTable = donations && donations.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Date</th>
          <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Description</th>
          <th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${donations.map(d => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">${d.date}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;">${d.description}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">$${d.amount.toFixed(2)}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : '';

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
  <div style="background:#2563eb;padding:24px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">${orgName}</h1>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Official Donation Acknowledgment</p>
  </div>
  <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;">Dear ${donorName.split(' ')[0] || 'Friend'},</p>
    <p style="margin:0 0 16px;">Thank you for your generous contribution to <strong>${orgName}</strong>. Your support makes a meaningful difference.</p>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.05em;margin-bottom:6px;">Total Contribution</div>
          <div style="font-size:36px;font-weight:900;color:#2563eb;">${formatted}</div>
        </div>
        ${dateRange ? `<div style="text-align:right;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.05em;margin-bottom:6px;">Period</div>
          <div style="font-size:16px;font-weight:600;color:#1e293b;">${dateRange}</div>
        </div>` : ''}
      </div>
    </div>

    ${donationsTable}

    ${pdfUrl ? `<p style="text-align:center;"><a href="${pdfUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Download Tax Receipt (PDF)</a></p>` : ''}

    <p style="color:#64748b;font-size:13px;margin-top:24px;">
      Please retain this letter for your tax records. No goods or services were provided by ${orgName} in exchange for the contributions described above.
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0;">
      ${orgName}${taxId ? ` &nbsp;·&nbsp; Tax ID: ${taxId}` : ''} &nbsp;·&nbsp; 501(c)(3) Certified
    </p>
  </div>
</div>`.trim();
}

/** Send via user's own Resend API key */
export async function sendViaResend(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  params: SendLetterParams
): Promise<SendResult> {
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject: `Your donation receipt from ${params.orgName}`,
      html: buildEmailHtml(params),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Send via AWS SES — platform sends from verified address, Reply-To goes to org's email */
export async function sendViaSES(
  fromName: string,
  replyTo: string,
  params: SendLetterParams
): Promise<SendResult> {
  const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@example.com';
  const toAddress = params.to?.trim().toLowerCase();
  const replyToAddress = replyTo?.trim().toLowerCase();
  if (!toAddress) return { success: false, error: 'Donor email address is missing.' };
  if (!replyToAddress) return { success: false, error: 'Reply-To email not configured. Please update Email settings.' };
  try {
    await getSESClient().send(new SendEmailCommand({
      Source: `${fromName || 'Beyond Books'} <${fromEmail}>`,
      Destination: { ToAddresses: [toAddress] },
      ReplyToAddresses: [replyToAddress],
      Message: {
        Subject: { Data: `Your donation receipt from ${params.orgName}`, Charset: 'UTF-8' },
        Body: { Html: { Data: buildEmailHtml(params), Charset: 'UTF-8' } },
      },
    }));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Refresh a Gmail OAuth access token using the stored refresh token */
export async function refreshGmailToken(refreshToken: string): Promise<{ accessToken: string; tokenExpiry: Date } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return null;
    return {
      accessToken: data.access_token,
      tokenExpiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    };
  } catch {
    return null;
  }
}

/** Send via Gmail API using OAuth access token */
export async function sendViaGmail(
  accessToken: string,
  fromEmail: string,
  fromName: string,
  params: SendLetterParams
): Promise<SendResult> {
  try {
    const subject = `Your donation receipt from ${params.orgName}`;
    const html = buildEmailHtml(params);

    // Build RFC 2822 message
    const message = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${params.to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ].join('\r\n');

    // Base64url encode
    const encoded = Buffer.from(message).toString('base64url');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error?.message ?? `Gmail API error ${res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Send via platform Resend key (legacy / fallback) */
export async function sendDonationLetter(params: SendLetterParams): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY is not configured' };
  }
  return sendViaResend(process.env.RESEND_API_KEY, process.env.FROM_EMAIL ?? 'letters@yourdomain.com', params.orgName, params);
}
