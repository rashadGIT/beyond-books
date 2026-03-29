// Mock the direct '../prisma' import used in pdfService.ts
jest.mock('../prisma', () => require('../../../__mocks__/prisma'));

// Mock awsClients — jest.mock is hoisted so inline jest.fn() here
jest.mock('../awsClients', () => ({
  s3Client: { send: jest.fn().mockResolvedValue({}) },
  getS3Client: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
  sesClient: { send: jest.fn().mockResolvedValue({}) },
  getSESClient: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
}));

// Override chromium-min mock with __esModule: true so the default import resolves correctly
jest.mock('@sparticuz/chromium-min', () => ({
  __esModule: true,
  default: {
    args: ['--no-sandbox'],
    executablePath: jest.fn().mockResolvedValue('/usr/bin/chromium'),
  },
}));

import { PDFService } from '../pdfService';
import puppeteer from 'puppeteer-core';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../../__mocks__/prisma';

const mockLaunch = jest.mocked(puppeteer.launch);
const mockGetSignedUrl = jest.mocked(getSignedUrl);

describe('PDFService.generatePDF', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('launches Puppeteer with correct args', async () => {
    process.env.BB_S3_BUCKET = 'test-bucket';

    await PDFService.generatePDF(
      'Alice Smith',
      'alice@example.com',
      500,
      '2024',
      false
    );

    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(['--no-sandbox']),
        headless: true,
      })
    );
  });

  it('returns an S3 key string', async () => {
    process.env.BB_S3_BUCKET = 'test-bucket';

    const key = await PDFService.generatePDF(
      'Bob Jones',
      'bob@example.com',
      1000,
      '2024 Annual',
      true,
      [{ date: '2024-01-01', description: 'Gift', grossAmount: 1000 }]
    );

    expect(typeof key).toBe('string');
    expect(key).toMatch(/^pdfs\/letter-Bob-Jones-\d+\.pdf$/);
  });

  it('calls PutObjectCommand with correct bucket and content type', async () => {
    process.env.BB_S3_BUCKET = 'my-bucket';

    await PDFService.generatePDF('Jane Doe', 'jane@example.com', 250, '2024', false);

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'my-bucket',
        ContentType: 'application/pdf',
        Key: expect.stringContaining('pdfs/letter-Jane-Doe'),
      })
    );
  });

  it('calls browser.close() in the finally block', async () => {
    const mockClose = jest.fn().mockResolvedValue(undefined);
    mockLaunch.mockResolvedValueOnce({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
      }),
      close: mockClose,
    } as any);

    await PDFService.generatePDF('Test User', 'test@example.com', 100, '2024', false);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('uploads the PDF buffer returned by page.pdf()', async () => {
    const fakePdfBuffer = Buffer.from('fake-pdf-content-xyz');
    mockLaunch.mockResolvedValueOnce({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(fakePdfBuffer),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    } as any);

    await PDFService.generatePDF('Upload Test', 'upload@example.com', 300, '2024', false);

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Body: expect.any(Buffer),
      })
    );
  });
});

describe('PDFService.getPresignedUrl', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls getSignedUrl with the provided S3 key', async () => {
    process.env.BB_S3_BUCKET = 'test-bucket';
    mockGetSignedUrl.mockResolvedValueOnce('https://presigned-url.example.com/file.pdf');

    const url = await PDFService.getPresignedUrl('pdfs/letter-Alice-1234567890.pdf');

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'pdfs/letter-Alice-1234567890.pdf',
      })
    );
    expect(url).toBe('https://presigned-url.example.com/file.pdf');
  });

  it('returns the presigned URL string from getSignedUrl', async () => {
    const expectedUrl = 'https://s3.amazonaws.com/test-bucket/pdfs/letter-test-999.pdf?X-Amz-Signature=abc';
    mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

    const url = await PDFService.getPresignedUrl('pdfs/letter-test-999.pdf');
    expect(url).toBe(expectedUrl);
  });

  it('uses expiresIn of 3600 seconds (1 hour)', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://url.example.com');

    await PDFService.getPresignedUrl('pdfs/some-key.pdf');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(), // s3 client
      expect.anything(), // GetObjectCommand instance
      expect.objectContaining({ expiresIn: 3600 })
    );
  });
});

describe('PDFService.createDonationLetter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws when no transactions are found', async () => {
    prisma.donationTransaction.findMany.mockResolvedValue([]);

    await expect(
      PDFService.createDonationLetter('Alice', 'alice@example.com', ['tx-999'], true)
    ).rejects.toThrow('No transactions found');
  });

  it('creates a letter record in the database', async () => {
    const mockTransactions = [
      { id: 'tx-1', grossAmount: 100, date: '2024-01-01' },
      { id: 'tx-2', grossAmount: 200, date: '2024-03-01' },
    ];

    prisma.donationTransaction.findMany.mockResolvedValue(mockTransactions as any);
    prisma.donationLetter.create.mockResolvedValue({
      id: 'letter-1',
      donorName: 'Alice Smith',
      donorEmail: 'alice@example.com',
      totalAmount: 300,
      pdfGenerated: true,
    } as any);

    const letter = await PDFService.createDonationLetter(
      'Alice Smith',
      'alice@example.com',
      ['tx-1', 'tx-2'],
      true
    );

    expect(prisma.donationLetter.create).toHaveBeenCalledTimes(1);
    expect(letter).toHaveProperty('id', 'letter-1');
    expect(letter.totalAmount).toBe(300);
  });

  it('loads org branding when userId is provided', async () => {
    prisma.donationTransaction.findMany.mockResolvedValue([
      { id: 'tx-1', grossAmount: 500, date: '2024-06-01' },
    ] as any);

    prisma.orgBranding.findUnique.mockResolvedValue({
      orgName: 'My Nonprofit',
      tagLine: 'Empowering communities',
      taxId: '99-1234567',
      signerName: 'Director Jane',
      signerTitle: 'Executive Director',
      logoUrl: null,
      primaryColor: '#1a56db',
    } as any);

    prisma.donationLetter.create.mockResolvedValue({ id: 'letter-2' } as any);

    await PDFService.createDonationLetter(
      'Bob',
      'bob@example.com',
      ['tx-1'],
      false,
      'user-123'
    );

    expect(prisma.orgBranding.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
  });
});
