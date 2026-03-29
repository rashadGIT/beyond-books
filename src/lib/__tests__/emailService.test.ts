import {
  buildEmailHtml,
  sendViaResend,
  sendViaSES,
  sendViaGmail,
  refreshGmailToken,
  type SendLetterParams,
} from '../emailService';
import { Resend } from 'resend';
import { SESClient } from '@aws-sdk/client-ses';

// awsClients module creates singleton SES/S3 clients at import time using
// the mocked constructors from jest.setup.ts.  We need getSESClient() to return
// a mock with a working .send() so emailService.sendViaSES can call it.
const mockSesSend = jest.fn().mockResolvedValue({});
jest.mock('../awsClients', () => ({
  getSESClient: jest.fn(() => ({ send: mockSesSend })),
  getS3Client: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
  sesClient: { send: jest.fn().mockResolvedValue({}) },
  s3Client: { send: jest.fn().mockResolvedValue({}) },
}));

const baseParams: SendLetterParams = {
  to: 'donor@example.com',
  donorName: 'Jane Doe',
  orgName: 'Test Org',
  totalAmount: 500,
};

// ─── buildEmailHtml ────────────────────────────────────────────────────────

describe('buildEmailHtml', () => {
  it('includes donor first name in greeting', () => {
    const html = buildEmailHtml(baseParams);
    expect(html).toContain('Dear Jane,');
  });

  it('includes formatted total amount', () => {
    const html = buildEmailHtml(baseParams);
    expect(html).toContain('$500.00');
  });

  it('includes organization name', () => {
    const html = buildEmailHtml(baseParams);
    expect(html).toContain('Test Org');
  });

  it('renders donations table when donations array is provided', () => {
    const params: SendLetterParams = {
      ...baseParams,
      donations: [
        { date: '2024-01-01', description: 'General Gift', amount: 250 },
        { date: '2024-06-01', description: 'Spring Campaign', amount: 250 },
      ],
    };
    const html = buildEmailHtml(params);
    expect(html).toContain('General Gift');
    expect(html).toContain('Spring Campaign');
    expect(html).toContain('250.00');
  });

  it('omits donations table when donations is undefined', () => {
    const html = buildEmailHtml(baseParams);
    // The table markup only appears when donations are present
    expect(html).not.toContain('<table');
  });

  it('omits donations table when donations array is empty', () => {
    const html = buildEmailHtml({ ...baseParams, donations: [] });
    expect(html).not.toContain('<table');
  });

  it('includes PDF download link when pdfUrl is provided', () => {
    const params: SendLetterParams = {
      ...baseParams,
      pdfUrl: 'https://example.com/receipt.pdf',
    };
    const html = buildEmailHtml(params);
    expect(html).toContain('https://example.com/receipt.pdf');
    expect(html).toContain('Download Tax Receipt (PDF)');
  });

  it('omits PDF link when pdfUrl is not provided', () => {
    const html = buildEmailHtml(baseParams);
    expect(html).not.toContain('Download Tax Receipt');
  });

  it('includes Tax ID in footer when taxId is provided', () => {
    const html = buildEmailHtml({ ...baseParams, taxId: '12-3456789' });
    expect(html).toContain('Tax ID: 12-3456789');
  });

  it('omits Tax ID from footer when taxId is not provided', () => {
    const html = buildEmailHtml(baseParams);
    expect(html).not.toContain('Tax ID:');
  });

  it('includes dateRange when provided', () => {
    const html = buildEmailHtml({ ...baseParams, dateRange: '2024 Fiscal Year' });
    expect(html).toContain('2024 Fiscal Year');
  });

  it('uses "Friend" as fallback when donor name has no first name', () => {
    const html = buildEmailHtml({ ...baseParams, donorName: '' });
    expect(html).toContain('Dear Friend,');
  });
});

// ─── sendViaResend ─────────────────────────────────────────────────────────

describe('sendViaResend', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns success: true on successful send', async () => {
    const result = await sendViaResend('re_key', 'from@org.com', 'Test Org', baseParams);
    expect(result).toEqual({ success: true });
  });

  it('returns success: false with error message when Resend returns an error', async () => {
    const mockResend = jest.mocked(Resend);
    mockResend.mockImplementationOnce(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ error: { message: 'Invalid API key', name: 'validation_error' } }),
      },
    }) as any);

    const result = await sendViaResend('bad_key', 'from@org.com', 'Test Org', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid API key');
  });

  it('returns success: false with error message when Resend constructor throws', async () => {
    const mockResend = jest.mocked(Resend);
    mockResend.mockImplementationOnce(() => {
      throw new Error('Network failure');
    });

    const result = await sendViaResend('key', 'from@org.com', 'Test Org', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });
});

// ─── sendViaSES ────────────────────────────────────────────────────────────

describe('sendViaSES', () => {
  const { getSESClient } = require('../awsClients');

  beforeEach(() => {
    // Ensure getSESClient always returns an object with a working send mock
    (getSESClient as jest.Mock).mockReturnValue({ send: mockSesSend });
    mockSesSend.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns success: true when SES send succeeds', async () => {
    const result = await sendViaSES('Test Org', 'org@example.com', baseParams);
    expect(result).toEqual({ success: true });
  });

  it('returns success: false when replyTo is missing', async () => {
    const result = await sendViaSES('Test Org', '', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Reply-To');
  });

  it('returns success: false when replyTo is only whitespace', async () => {
    const result = await sendViaSES('Test Org', '   ', baseParams);
    expect(result.success).toBe(false);
  });

  it('returns success: false with error message when SES send throws', async () => {
    mockSesSend.mockRejectedValueOnce(new Error('SES quota exceeded'));

    const result = await sendViaSES('Test Org', 'org@example.com', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toBe('SES quota exceeded');
  });

  it('returns success: false when to address is missing', async () => {
    const paramsNoTo: SendLetterParams = { ...baseParams, to: '' };
    const result = await sendViaSES('Test Org', 'org@example.com', paramsNoTo);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Donor email address is missing');
  });
});

// ─── sendViaGmail ──────────────────────────────────────────────────────────

describe('sendViaGmail', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns success: true when Gmail API responds ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: 'msg_123' }),
    });

    const result = await sendViaGmail('access_token', 'from@org.com', 'Test Org', baseParams);
    expect(result).toEqual({ success: true });
  });

  it('returns success: false when Gmail API returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ error: { message: 'Forbidden' } }),
    });

    const result = await sendViaGmail('bad_token', 'from@org.com', 'Test Org', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns success: false with fallback message when error object lacks message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({}),
    });

    const result = await sendViaGmail('token', 'from@org.com', 'Test Org', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Gmail API error 500');
  });

  it('returns success: false when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await sendViaGmail('token', 'from@org.com', 'Test Org', baseParams);
    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });
});

// ─── refreshGmailToken ─────────────────────────────────────────────────────

describe('refreshGmailToken', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns accessToken and tokenExpiry on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        access_token: 'new_access_token',
        expires_in: 3600,
      }),
    });

    const result = await refreshGmailToken('refresh_token_value');
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('new_access_token');
    expect(result!.tokenExpiry).toBeInstanceOf(Date);
    // tokenExpiry should be roughly 1 hour from now
    const diff = result!.tokenExpiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(3000 * 1000); // more than 50 minutes
    expect(diff).toBeLessThan(3700 * 1000);    // less than ~61 minutes
  });

  it('returns null when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: 'invalid_grant' }),
    });

    const result = await refreshGmailToken('expired_refresh_token');
    expect(result).toBeNull();
  });

  it('returns null when access_token is missing from response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    });

    const result = await refreshGmailToken('refresh_token');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await refreshGmailToken('refresh_token');
    expect(result).toBeNull();
  });

  it('uses default expires_in of 3600 when not provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ access_token: 'tok' }),
    });

    const result = await refreshGmailToken('token');
    expect(result).not.toBeNull();
    const diff = result!.tokenExpiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(3500 * 1000);
  });
});
