import puppeteer from 'puppeteer';
import { prisma } from './prisma';
import path from 'path';
import { mkdir } from 'fs/promises';
import { BrandingConfig } from './types';

const PDF_DIR = path.join(process.cwd(), 'generated-pdfs');

export class PDFService {
  private static async ensurePdfDir() {
    await mkdir(PDF_DIR, { recursive: true });
  }

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
      organizationName: 'Youth Revive Inc.',
      tagline: 'Building stronger communities together',
      taxId: '840-464680632',
      signerName: 'Brandie',
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

  // Generate PDF from HTML
  static async generatePDF(
    donorName: string,
    donorEmail: string,
    totalAmount: number,
    dateRange: string,
    isSummary: boolean,
    donations?: any[],
    branding?: BrandingConfig
  ): Promise<string> {
    await this.ensurePdfDir();

    const html = this.generateLetterHTML(
      donorName,
      donorEmail,
      totalAmount,
      dateRange,
      isSummary,
      donations,
      branding
    );

    const fileName = `letter-${donorName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filePath,
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
      });

      return filePath;
    } finally {
      await browser.close();
    }
  }

  // Generate a general-purpose report PDF from a title + plain text/markdown content
  static async generateReportPDF(title: string, content: string): Promise<string> {
    await this.ensurePdfDir();

    // Convert basic markdown to HTML
    const bodyHtml = content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^#{1,3}\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 48px; line-height: 1.7; color: #1e293b; }
    h1 { color: #2563eb; font-size: 26px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 6px; }
    h3 { color: #334155; margin-top: 20px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 32px; }
    p { margin: 0 0 12px; }
    strong { color: #0f172a; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  <p>${bodyHtml}</p>
</body>
</html>`;

    const slug = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
    const fileName = `report-${slug}-${Date.now()}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filePath,
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      });
      return fileName;
    } finally {
      await browser.close();
    }
  }

  // Generate letter and save to database
  static async createDonationLetter(
    donorName: string,
    donorEmail: string,
    transactionIds: string[],
    isSummary: boolean = true
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
      transactions
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
