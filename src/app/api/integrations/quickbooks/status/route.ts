import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksService } from '@/lib/quickbooksService';

export async function GET() {
  try {
    const qbService = getQuickBooksService();
    const connection = await qbService.getActiveConnection();

    if (!connection) {
      console.log('❌ No QuickBooks connection in database');
      return NextResponse.json({
        connected: false,
        lastSyncAt: null,
        error: 'No QuickBooks connection configured',
        isStale: true,
      });
    }

    console.log('🔍 Testing QuickBooks connection by calling API...');

    // Make actual API call to QuickBooks to verify connection
    const isConnected = await qbService.testConnection();

    if (isConnected) {
      console.log('✅ QuickBooks API responded successfully');
    } else {
      console.log('❌ QuickBooks API call failed');
    }

    return NextResponse.json({
      connected: isConnected,
      lastSyncAt: connection.lastSyncAt?.toISOString() || null,
      companyName: connection.companyName,
      realmId: connection.realmId,
      error: isConnected ? null : 'Connection test failed',
      isStale: false,
    });
  } catch (error: any) {
    console.error('❌ QuickBooks status check error:', error);
    return NextResponse.json({
      connected: false,
      lastSyncAt: null,
      error: error.message,
      isStale: true,
    });
  }
}

// Keep POST for backward compatibility with n8n (if still using it)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { heartbeat } = body;

    // If heartbeat from n8n, just return success
    if (heartbeat) {
      return NextResponse.json({
        success: true,
        message: 'Heartbeat received (using direct QB connection now)',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Status endpoint is now using direct QuickBooks connection',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
