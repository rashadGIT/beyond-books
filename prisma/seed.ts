import { PrismaClient } from '@prisma/client';
import { MOCK_REALM_ID } from '../src/lib/mockQbResponses';

const prisma = new PrismaClient();

const USER_ID = '344844d8-f0d1-704f-ac91-c33b6f4440c8';

async function main() {
  console.log('🌱 Seeding mock data for user', USER_ID);

  // ─── Org Branding ────────────────────────────────────────────────────────────
  await prisma.orgBranding.upsert({
    where: { userId: USER_ID },
    update: {},
    create: {
      userId: USER_ID,
      orgName: 'Youth Revive Inc.',
      tagLine: 'Building stronger communities together',
      taxId: '84-0464680',
      signerName: 'Brandie Johnson',
      signerTitle: 'Executive Director',
      primaryColor: '#2563eb',
    },
  });
  console.log('✅ Org branding');

  // ─── Programs ────────────────────────────────────────────────────────────────
  const [afterSchool, summerCamp, titleIGrant, downtown] = await Promise.all([
    prisma.program.upsert({
      where: { id: 'prog-afterschool' },
      update: {},
      create: { id: 'prog-afterschool', userId: USER_ID, name: 'After-School Program', type: 'PROGRAM' },
    }),
    prisma.program.upsert({
      where: { id: 'prog-summer' },
      update: {},
      create: { id: 'prog-summer', userId: USER_ID, name: 'Summer Camp', type: 'PROGRAM' },
    }),
    prisma.program.upsert({
      where: { id: 'prog-title1' },
      update: {},
      create: { id: 'prog-title1', userId: USER_ID, name: 'Title I Funding', type: 'GRANT' },
    }),
    prisma.program.upsert({
      where: { id: 'prog-downtown' },
      update: {},
      create: { id: 'prog-downtown', userId: USER_ID, name: 'Downtown Location', type: 'LOCATION' },
    }),
  ]);
  console.log('✅ Programs (4)');

  // ─── Allocation Rules ────────────────────────────────────────────────────────
  // Delete existing splits before re-creating rules to avoid duplicates
  await prisma.allocationSplit.deleteMany({ where: { ruleId: { in: ['rule-overhead', 'rule-programs'] } } });
  await prisma.allocationRule.deleteMany({ where: { id: { in: ['rule-overhead', 'rule-programs'] } } });

  await prisma.allocationRule.create({
    data: {
      id: 'rule-overhead',
      userId: USER_ID,
      name: 'Admin Overhead Split',
      splits: {
        create: [
          { programId: afterSchool.id, percentage: 50 },
          { programId: summerCamp.id, percentage: 30 },
          { programId: titleIGrant.id, percentage: 20 },
        ],
      },
    },
  });

  await prisma.allocationRule.create({
    data: {
      id: 'rule-programs',
      userId: USER_ID,
      name: 'Equal Program Split',
      splits: {
        create: [
          { programId: afterSchool.id, percentage: 50 },
          { programId: summerCamp.id, percentage: 50 },
        ],
      },
    },
  });
  console.log('✅ Allocation rules (2)');

  // ─── Processed Files ────────────────────────────────────────────────────────
  const [paypalFile, nfgFile] = await Promise.all([
    prisma.processedFile.upsert({
      where: { id: 'file-paypal-jan' },
      update: {},
      create: {
        id: 'file-paypal-jan',
        userId: USER_ID,
        filename: 'paypal-january-2026.csv',
        source: 'paypal',
        fileSize: 12480,
        transactionCount: 0,
        totalAmount: 0,
      },
    }),
    prisma.processedFile.upsert({
      where: { id: 'file-nfg-q1' },
      update: {},
      create: {
        id: 'file-nfg-q1',
        userId: USER_ID,
        filename: 'nfg-q1-2026.csv',
        source: 'network_for_good',
        fileSize: 8320,
        transactionCount: 0,
        totalAmount: 0,
      },
    }),
  ]);

  // ─── Donation Transactions ───────────────────────────────────────────────────
  const paypalTxns = [
    { id: 'tx-pp-001', transactionId: 'PP-7841', date: '2026-01-05', donorName: 'Marcus Williams', donorEmail: 'marcus.williams@gmail.com', grossAmount: 250.00, fee: 7.55, netAmount: 242.45, description: 'PayPal Donation', classification: 'GENERAL' },
    { id: 'tx-pp-002', transactionId: 'PP-7842', date: '2026-01-08', donorName: 'Sarah Chen', donorEmail: 'sarah.chen@outlook.com', grossAmount: 500.00, fee: 14.80, netAmount: 485.20, description: 'After-School Program', classification: 'RESTRICTED', restrictedFund: 'After-School Program' },
    { id: 'tx-pp-003', transactionId: 'PP-7843', date: '2026-01-12', donorName: 'David Okafor', donorEmail: 'dokafor@proton.me', grossAmount: 100.00, fee: 3.20, netAmount: 96.80, description: 'PayPal Donation', classification: 'GENERAL' },
    { id: 'tx-pp-004', transactionId: 'PP-7844', date: '2026-01-15', donorName: 'Jennifer Lopez', donorEmail: 'jlopez@yahoo.com', grossAmount: 1000.00, fee: 29.30, netAmount: 970.70, description: 'Summer Camp Fund', classification: 'RESTRICTED', restrictedFund: 'Summer Camp' },
    { id: 'tx-pp-005', transactionId: 'PP-7845', date: '2026-01-19', donorName: 'Robert Kim', donorEmail: 'rkim@company.io', grossAmount: 75.00, fee: 2.48, netAmount: 72.52, description: 'PayPal Donation', classification: 'GENERAL' },
    { id: 'tx-pp-006', transactionId: 'PP-7846', date: '2026-01-22', donorName: 'Angela Moore', donorEmail: 'angela.moore@gmail.com', grossAmount: 200.00, fee: 6.10, netAmount: 193.90, description: 'PayPal Donation', classification: 'GENERAL' },
    { id: 'tx-pp-007', transactionId: 'PP-7847', date: '2026-01-28', donorName: 'Thomas Grant', donorEmail: 'tgrant@icloud.com', grossAmount: 150.00, fee: 4.65, netAmount: 145.35, description: 'Title I Support', classification: 'RESTRICTED', restrictedFund: 'Title I Funding' },
  ];

  const nfgTxns = [
    { id: 'tx-nfg-001', transactionId: 'NFG-3310', date: '2026-02-03', donorName: 'Patricia Davis', donorEmail: 'pdavis@email.com', grossAmount: 500.00, fee: 0, netAmount: 500.00, description: 'Network for Good Donation', classification: 'GENERAL' },
    { id: 'tx-nfg-002', transactionId: 'NFG-3311', date: '2026-02-07', donorName: 'James Wilson', donorEmail: 'jwilson@corp.net', grossAmount: 2500.00, fee: 0, netAmount: 2500.00, description: 'After-School Program', classification: 'RESTRICTED', restrictedFund: 'After-School Program' },
    { id: 'tx-nfg-003', transactionId: 'NFG-3312', date: '2026-02-14', donorName: 'Linda Thompson', donorEmail: 'lthompson@gmail.com', grossAmount: 100.00, fee: 0, netAmount: 100.00, description: 'Network for Good Donation', classification: 'GENERAL' },
    { id: 'tx-nfg-004', transactionId: 'NFG-3313', date: '2026-02-18', donorName: 'Michael Brown', donorEmail: 'mbrown@hotmail.com', grossAmount: 750.00, fee: 0, netAmount: 750.00, description: 'Summer Camp Scholarship', classification: 'RESTRICTED', restrictedFund: 'Summer Camp' },
    { id: 'tx-nfg-005', transactionId: 'NFG-3314', date: '2026-02-24', donorName: 'Susan Martinez', donorEmail: 'smartinez@edu.org', grossAmount: 300.00, fee: 0, netAmount: 300.00, description: 'Network for Good Donation', classification: 'GENERAL' },
  ];

  for (const tx of [...paypalTxns, ...nfgTxns]) {
    const fileId = tx.id.startsWith('tx-pp') ? paypalFile.id : nfgFile.id;
    await prisma.donationTransaction.upsert({
      where: { id: tx.id },
      update: {},
      create: {
        id: tx.id,
        fileId,
        transactionId: tx.transactionId,
        date: tx.date,
        source: tx.id.startsWith('tx-pp') ? 'paypal' : 'network_for_good',
        donorName: tx.donorName,
        donorEmail: tx.donorEmail,
        grossAmount: tx.grossAmount,
        fee: tx.fee,
        netAmount: tx.netAmount,
        description: tx.description,
        originalData: JSON.stringify(tx),
        classification: tx.classification,
        restrictedFund: (tx as any).restrictedFund ?? null,
        classificationConf: tx.classification !== 'UNCLASSIFIED' ? 0.95 : null,
      },
    });
  }

  // Update file totals
  const ppTotal = paypalTxns.reduce((s, t) => s + t.grossAmount, 0);
  const nfgTotal = nfgTxns.reduce((s, t) => s + t.grossAmount, 0);
  await prisma.processedFile.update({ where: { id: paypalFile.id }, data: { transactionCount: paypalTxns.length, totalAmount: ppTotal } });
  await prisma.processedFile.update({ where: { id: nfgFile.id }, data: { transactionCount: nfgTxns.length, totalAmount: nfgTotal } });
  console.log('✅ Transactions (12 across 2 files)');

  // ─── Scheduled Jobs ──────────────────────────────────────────────────────────
  await prisma.scheduledJob.upsert({
    where: { id: 'job-weekly-donors' },
    update: {},
    create: {
      id: 'job-weekly-donors',
      userId: USER_ID,
      label: 'Weekly Donor Summary',
      prompt: 'Show me all donations received in the past 7 days, total amount, and top 3 donors.',
      schedule: '09:00 AM',
      frequency: 'WEEKLY',
      cronExpression: '0 9 * * 1',
      isActive: true,
    },
  });

  await prisma.scheduledJob.upsert({
    where: { id: 'job-monthly-report' },
    update: {},
    create: {
      id: 'job-monthly-report',
      userId: USER_ID,
      label: 'Monthly Giving Report',
      prompt: 'Generate a summary of all donations from last month, broken down by source and classification.',
      schedule: '08:00 AM',
      frequency: 'MONTHLY' as any,
      cronExpression: '0 8 1 * *',
      isActive: true,
    },
  });
  console.log('✅ Scheduled jobs (2)');

  // ─── Chat Messages ───────────────────────────────────────────────────────────
  await prisma.chatMessage.createMany({
    skipDuplicates: true,
    data: [
      { id: 'msg-001', userId: USER_ID, role: 'user', content: 'How much did we raise in January?', timestamp: new Date('2026-02-01T10:00:00Z') },
      { id: 'msg-002', userId: USER_ID, role: 'assistant', content: 'In January 2026, Youth Revive Inc. raised **$2,275.00** from 7 PayPal donations.\n\n**Top donors:**\n- Jennifer Lopez — $1,000\n- Sarah Chen — $500\n- Marcus Williams — $250\n\nThree donations were **restricted** (After-School Program, Summer Camp, Title I Funding). Four were unrestricted general gifts.', timestamp: new Date('2026-02-01T10:00:05Z') },
      { id: 'msg-003', userId: USER_ID, role: 'user', content: 'Classify all donations from the January PayPal file', timestamp: new Date('2026-02-01T10:01:00Z') },
      { id: 'msg-004', userId: USER_ID, role: 'assistant', content: 'Classification complete: **3 RESTRICTED**, **4 GENERAL** out of 7 transactions.\n\nRestricted funds identified:\n- After-School Program (Sarah Chen, $500)\n- Summer Camp (Jennifer Lopez, $1,000)\n- Title I Funding (Thomas Grant, $150)', timestamp: new Date('2026-02-01T10:01:08Z') },
    ],
  });
  console.log('✅ Chat history (4 messages)');

  // ─── Email Logs ──────────────────────────────────────────────────────────────
  await prisma.emailLog.createMany({
    skipDuplicates: true,
    data: [
      { id: 'email-001', recipient: 'marcus.williams@gmail.com', recipientName: 'Marcus Williams', subject: 'Your donation receipt from Youth Revive Inc.', status: 'sent', sentAt: new Date('2026-02-05T14:00:00Z') },
      { id: 'email-002', recipient: 'sarah.chen@outlook.com', recipientName: 'Sarah Chen', subject: 'Your donation receipt from Youth Revive Inc.', status: 'sent', sentAt: new Date('2026-02-05T14:00:02Z') },
      { id: 'email-003', recipient: 'dokafor@proton.me', recipientName: 'David Okafor', subject: 'Your donation receipt from Youth Revive Inc.', status: 'sent', sentAt: new Date('2026-02-05T14:00:04Z') },
    ],
  });
  console.log('✅ Email logs (3)');

  // ─── Mock QuickBooks Connection ───────────────────────────────────────────
  await prisma.quickBooksConnection.upsert({
    where: { userId: USER_ID },
    update: {},
    create: {
      userId: USER_ID,
      realmId: MOCK_REALM_ID,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date('2099-01-01'),
      refreshExpiresAt: new Date('2099-01-01'),
      companyName: 'Youth Revive Inc. (Demo)',
      isActive: true,
    },
  });
  console.log('✅ Mock QuickBooks connection');

  console.log('\n🎉 Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
