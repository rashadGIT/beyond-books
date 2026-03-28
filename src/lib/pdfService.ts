import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { prisma } from './prisma';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { BrandingConfig } from './types';
import { s3Client as s3 } from './awsClients';

export class PDFService {

  // Generate HTML from letter template
  private static generateLetterHTML(
    donorName: string,
    donorEmail: string,
    totalAmount: number,
    dateRange: string,
    isSummary: boolean,
    donations?: any[],
    branding?: BrandingConfig
  ): string {
    const defaultBranding = {
      organizationName: 'Your Organization',
      tagline: 'Building stronger communities together',
      taxId: 'XX-XXXXXXX',
      signerName: 'Your Name',
      signerTitle: 'Executive Director',
      primaryColor: '#2563eb',
    };

    const brand = branding || defaultBranding;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      padding: 48px;
      line-height: 1.6;
      color: #1e293b;
    }
    .letterhead {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 32px;
      margin-bottom: 48px;
    }
    .org-name {
      font-size: 24px;
      font-weight: bold;
      color: ${brand.primaryColor};
      text-transform: uppercase;
    }
    .tagline {
      color: #64748b;
      font-style: italic;
      font-size: 14px;
    }
    .date {
      text-align: right;
      color: #64748b;
      font-size: 14px;
    }
    .recipient {
      margin-bottom: 40px;
      font-size: 18px;
      font-weight: bold;
    }
    .amount-box {
      background: #f1f5f9;
      padding: 32px;
      border-radius: 16px;
      margin: 32px 0;
    }
    .amount-label {
      font-size: 12px;
      color: #64748b;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 36px;
      font-weight: 900;
      color: ${brand.primaryColor};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
    }
    .signature {
      margin-top: 64px;
      padding-top: 32px;
      border-top: 1px solid #e2e8f0;
    }
    .signer-name {
      font-weight: bold;
      font-size: 18px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <div>
      <div class="org-name">${brand.organizationName}</div>
      <div class="tagline">${brand.tagline}</div>
    </div>
    <div class="date">
      ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
      Official Tax Receipt
    </div>
  </div>

  <div class="recipient">
    To:<br>
    ${donorName}<br>
    <span style="font-size: 14px; color: #64748b;">${donorEmail}</span>
  </div>

  <p>Dear ${donorName.split(' ')[0]},</p>

  <p>
    Thank you for your generous contribution to <strong>${brand.organizationName}</strong>.
    Your support allows us to continue our mission and impact the lives of those we serve.
  </p>

  <div class="amount-box">
    <div class="amount-label">Total Contribution</div>
    <div class="amount-value">$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
    <div class="amount-label" style="margin-top: 16px;">Contribution Date</div>
    <div style="font-size: 20px; font-weight: 600;">${dateRange}</div>
  </div>

  ${
    isSummary && donations
      ? `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${donations
        .map(
          (d) => `
        <tr>
          <td>${d.date}</td>
          <td>${d.description}</td>
          <td style="text-align: right;">$${d.grossAmount.toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <p>
    Please retain this letter for your tax records. No goods or services were provided by the
    organization in return for the contributions mentioned above.
  </p>

  <div class="signature">
    <p>Sincerely,</p>
    <div class="signer-name">${brand.signerName}</div>
    <div style="color: #64748b; font-size: 14px;">${brand.signerTitle}</div>
    <div style="color: ${brand.primaryColor}; font-weight: 600; font-size: 14px; margin-top: 4px;">
      ${brand.organizationName}
    </div>
    <div style="font-size: 10px; color: #94a3b8; margin-top: 16px;">
      Tax-Exempt ID: ${brand.taxId} | 501(c)(3) Certified
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  // Generate PDF from HTML and upload to S3, returns S3 key
  static async generatePDF(
    donorName: string,
    donorEmail: string,
    totalAmount: number,
    dateRange: string,
    isSummary: boolean,
    donations?: any[],
    branding?: BrandingConfig
  ): Promise<string> {
    const html = this.generateLetterHTML(
      donorName,
      donorEmail,
      totalAmount,
      dateRange,
      isSummary,
      donations,
      branding
    );

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(
        process.env.CHROMIUM_PATH ?? undefined
      ),
      headless: true,
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = Buffer.from(await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
      }));
    } finally {
      await browser.close();
    }

    // Upload to S3
    const s3Key = `pdfs/letter-${donorName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.BB_S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));

    return s3Key; // Return S3 key (stored in DB)
  }

  // Generate a presigned download URL for a PDF stored in S3 (valid 1 hour)
  static async getPresignedUrl(s3Key: string): Promise<string> {
    return getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.BB_S3_BUCKET,
        Key: s3Key,
      }),
      { expiresIn: 3600 }
    );
  }

  // Generate a general-purpose report PDF from a title + plain text/markdown content
  // Uses pdfkit (pure JS — no Chromium or S3 required). Saves to public/reports/ and returns a relative URL.
  static async generateReportPDF(title: string, content: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit') as typeof import('pdfkit');
    const fs = await import('fs');
    const path = await import('path');

    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const slug = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
    const filename = `report-${slug}-${Date.now()}.pdf`;
    const filepath = path.join(reportsDir, filename);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Title
      doc.fontSize(22).fillColor('#2563eb').text(title, { align: 'left' });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#2563eb').stroke();
      doc.moveDown(0.5);

      // Date
      doc.fontSize(10).fillColor('#64748b')
        .text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
      doc.moveDown(1);

      // Body — strip markdown, render plain text
      const plain = content
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\|.*\|/g, (line) => line.replace(/\|/g, '  ').trim());

      doc.fontSize(11).fillColor('#1e293b').text(plain, { lineGap: 4 });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return `/reports/${filename}`;
  }

  // Generate letter and save to database
  static async createDonationLetter(
    donorName: string,
    donorEmail: string,
    transactionIds: string[],
    isSummary: boolean = true,
    userId?: string
  ): Promise<any> {
    // Get transactions
    const transactions = await prisma.donationTransaction.findMany({
      where: {
        id: { in: transactionIds },
      },
    });

    if (transactions.length === 0) {
      throw new Error('No transactions found');
    }

    // Load org branding from DB if userId provided
    let branding: BrandingConfig | undefined;
    if (userId) {
      const orgBranding = await prisma.orgBranding.findUnique({ where: { userId } });
      if (orgBranding) {
        branding = {
          organizationName: orgBranding.orgName ?? 'Your Organization',
          tagline: orgBranding.tagLine ?? 'Building stronger communities together',
          taxId: orgBranding.taxId ?? 'XX-XXXXXXX',
          signerName: orgBranding.signerName ?? 'Your Name',
          signerTitle: orgBranding.signerTitle ?? 'Executive Director',
          logoUrl: orgBranding.logoUrl ?? undefined,
          primaryColor: orgBranding.primaryColor ?? '#2563eb',
        };
      }
    }

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.grossAmount, 0);
    const dateRange = isSummary
      ? 'Annual Summary 2026'
      : transactions[0].date;

    // Generate PDF
    const pdfPath = await this.generatePDF(
      donorName,
      donorEmail,
      totalAmount,
      dateRange,
      isSummary,
      transactions,
      branding
    );

    // Save to database
    const letter = await prisma.donationLetter.create({
      data: {
        donorName,
        donorEmail,
        totalAmount,
        dateRange,
        isSummary,
        pdfPath,
        pdfGenerated: true,
        transactions: {
          connect: transactions.map((tx) => ({ id: tx.id })),
        },
      },
    });

    return letter;
  }
}
