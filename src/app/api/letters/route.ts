import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PDFService } from '@/lib/pdfService';
import { ChatFileService } from '@/lib/chatFileService';
import { sendDonationLetter } from '@/lib/emailService';

async function getOrgName(userId: string): Promise<string> {
  const branding = await prisma.orgBranding.findUnique({ where: { userId } });
  return branding?.orgName ?? 'Your Organization';
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { action, donorName } = body;

    if (action === 'send_single') {
      const donorGroups = await ChatFileService.groupTransactionsByDonor();
      const donor = donorGroups.find(
        (d) => d.name.toLowerCase() === donorName.toLowerCase()
      );

      if (!donor) {
        return NextResponse.json({ error: 'Donor not found' }, { status: 404 });
      }

      const transactionIds = donor.transactions.map((tx) => tx.id);
      const letter = await PDFService.createDonationLetter(donor.name, donor.email, transactionIds, true, userId);

      const pdfUrl = letter.pdfPath ? await PDFService.getPresignedUrl(letter.pdfPath) : undefined;
      const orgName = await getOrgName(userId);
      const emailResult = await sendDonationLetter({
        to: donor.email,
        donorName: donor.name,
        orgName,
        totalAmount: donor.total,
        pdfUrl,
      });

      await prisma.emailLog.create({
        data: {
          recipient: donor.email,
          recipientName: donor.name,
          subject: `Donation Receipt from ${orgName}`,
          status: emailResult.success ? 'sent' : 'failed',
          letterId: letter.id,
          errorMessage: emailResult.error ?? null,
        },
      });

      if (emailResult.success) {
        await prisma.donationLetter.update({
          where: { id: letter.id },
          data: { emailSent: true, emailSentAt: new Date() },
        });
      }

      return NextResponse.json({
        success: emailResult.success,
        donorName: donor.name,
        email: donor.email,
        letterId: letter.id,
        amount: donor.total,
        emailError: emailResult.error,
      });
    }

    if (action === 'send_bulk') {
      const donorGroups = await ChatFileService.groupTransactionsByDonor();
      const orgName = await getOrgName(userId);
      const sent: string[] = [];
      const failed: { name: string; error: string }[] = [];

      for (const donor of donorGroups) {
        try {
          const transactionIds = donor.transactions.map((tx) => tx.id);
          const letter = await PDFService.createDonationLetter(donor.name, donor.email, transactionIds, true, userId);
          const pdfUrl = letter.pdfPath ? await PDFService.getPresignedUrl(letter.pdfPath) : undefined;
          const emailResult = await sendDonationLetter({
            to: donor.email,
            donorName: donor.name,
            orgName,
            totalAmount: donor.total,
            pdfUrl,
          });

          await prisma.emailLog.create({
            data: {
              recipient: donor.email,
              recipientName: donor.name,
              subject: `Donation Receipt from ${orgName}`,
              status: emailResult.success ? 'sent' : 'failed',
              letterId: letter.id,
              errorMessage: emailResult.error ?? null,
            },
          });

          if (emailResult.success) {
            await prisma.donationLetter.update({
              where: { id: letter.id },
              data: { emailSent: true, emailSentAt: new Date() },
            });
            sent.push(donor.name);
          } else {
            failed.push({ name: donor.name, error: emailResult.error ?? 'Unknown error' });
          }
        } catch (err: any) {
          failed.push({ name: donor.name, error: err.message });
        }
      }

      return NextResponse.json({ success: true, sent: sent.length, failed });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Letter generation error:', error);
    return NextResponse.json({ error: 'Failed to generate letter', message: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const letterId = searchParams.get('download');

    // Return a presigned S3 URL for a specific letter's PDF
    if (letterId) {
      const letter = await prisma.donationLetter.findUnique({ where: { id: letterId } });
      if (!letter?.pdfPath) {
        return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
      }
      const url = await PDFService.getPresignedUrl(letter.pdfPath);
      return NextResponse.json({ url });
    }

    const letters = await prisma.donationLetter.findMany({
      include: {
        transactions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(letters);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
