import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ChatCommandParser } from '@/lib/chatCommandParser';
import { ChatFileService } from '@/lib/chatFileService';

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { timestamp: 'asc' },
    });
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { role, content, fileId } = await request.json();

    // Save user message
    const message = await prisma.chatMessage.create({
      data: {
        role,
        content,
        hasAttachment: !!fileId,
        fileId,
      },
    });

    // If assistant is responding, parse intent and generate response
    if (role === 'user') {
      const intent = ChatCommandParser.parseIntent(content);
      let responseData: any = null;

      switch (intent.type) {
        case 'process_demo':
          responseData = await ChatFileService.processDemoFiles();
          break;
        case 'show_stats':
          responseData = await ChatFileService.getStatistics();
          break;
        case 'list_donors':
          responseData = await ChatFileService.groupTransactionsByDonor();
          break;
        case 'send_letter':
          // Call letter API
          const letterRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/letters`, {
            method: 'POST',
            body: JSON.stringify({
              action: 'send_single',
              donorName: intent.params?.donorName,
            }),
            headers: { 'Content-Type': 'application/json' },
          });
          responseData = await letterRes.json();
          break;
        case 'send_bulk_letters':
          const bulkRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/letters`, {
            method: 'POST',
            body: JSON.stringify({ action: 'send_bulk' }),
            headers: { 'Content-Type': 'application/json' },
          });
          responseData = await bulkRes.json();
          break;
      }

      const responseContent = ChatCommandParser.formatResponse(intent, responseData);

      // Save assistant response
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          role: 'assistant',
          content: responseContent,
        },
      });

      return NextResponse.json({
        userMessage: message,
        assistantMessage,
      });
    }

    return NextResponse.json(message);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.chatMessage.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
