import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PDFService } from '@/lib/pdfService';
import { ChatFileService } from '@/lib/chatFileService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, donorName } = body;

    if (action === 'send_single') {
      // Find donor's transactions
      const donorGroups = await ChatFileService.groupTransactionsByDonor();
      const donor = donorGroups.find(
        (d) => d.name.toLowerCase() === donorName.toLowerCase()
      );

      if (!donor) {
        return NextResponse.json(
          { error: 'Donor not found' },
          { status: 404 }
        );
      }

      // Generate letter
      const transactionIds = donor.transactions.map((tx) => tx.id);
      const letter = await PDFService.createDonationLetter(
        donor.name,
        donor.email,
        transactionIds,
        true
      );

      // Mock email sending
      await prisma.emailLog.create({
        data: {
          recipient: donor.email,
          recipientName: donor.name,
          subject: 'Donation Receipt from Youth Revive Inc.',
          status: 'sent',
          letterId: letter.id,
        },
      });

      // Update letter status
      await prisma.donationLetter.update({
        where: { id: letter.id },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        donorName: donor.name,
        email: donor.email,
        letterId: letter.id,
        amount: donor.total,
      });
    }

    if (action === 'send_bulk') {
      const donorGroups = await ChatFileService.groupTransactionsByDonor();

      const results = await Promise.allSettled(
        donorGroups.map(async (donor) => {
          const transactionIds = donor.transactions.map((tx) => tx.id);
          const letter = await PDFService.createDonationLetter(
            donor.name,
            donor.email,
            transactionIds,
            true
          );

          await prisma.emailLog.create({
            data: {
              recipient: donor.email,
              recipientName: donor.name,
              subject: 'Donation Receipt from Youth Revive Inc.',
              status: 'sent',
              letterId: letter.id,
            },
          });

          await prisma.donationLetter.update({
            where: { id: letter.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            },
          });

          return letter;
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return NextResponse.json({
        success: true,
        count: succeeded,
        recipients: donorGroups.length,
        failed,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Letter generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate letter', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
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
