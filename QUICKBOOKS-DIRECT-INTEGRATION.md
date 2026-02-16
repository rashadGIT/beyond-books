# QuickBooks Direct Integration Setup

Your Beyond Books app now connects **directly** to QuickBooks - no n8n required!

## 🎉 What Was Built

### Backend (API)
✅ OAuth authentication with QuickBooks
✅ Secure token storage in database
✅ Automatic token refresh
✅ Transaction sync from QuickBooks
✅ Real-time connection status

### Frontend (Dashboard)
✅ QuickBooks status badge
✅ Connect button (when offline)
✅ Sync button (when connected)
✅ Last sync timestamp display

## 🚀 Quick Setup (5 Minutes)

### Step 1: Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your QuickBooks credentials to `.env`:
```bash
# Your QuickBooks App Credentials
QUICKBOOKS_CLIENT_ID="AB5FzN7U6iEExsTxG0DKT0SPSitT25Xq3HqueRknS78xwP64ND"
QUICKBOOKS_CLIENT_SECRET="your_secret_here"

# Update these
NEXT_PUBLIC_URL="http://localhost:3000"
QUICKBOOKS_REDIRECT_URI="http://localhost:3000/api/quickbooks/callback"
QUICKBOOKS_ENVIRONMENT="sandbox"
```

### Step 2: Update QuickBooks Redirect URI

1. Go to https://developer.intuit.com/
2. Open your app
3. Go to **Keys & OAuth**
4. Add redirect URI:
```
http://localhost:3000/api/quickbooks/callback
```

**For production**, use:
```
https://your-domain.com/api/quickbooks/callback
```

### Step 3: Start the App

```bash
npm run dev
```

### Step 4: Connect QuickBooks

1. Open http://localhost:3000
2. Hover over the **QUICKBOOKS** badge (top-right)
3. Click **"Connect QB"** button
4. Sign in to QuickBooks and authorize
5. You'll be redirected back - status shows "Connected" ✅

### Step 5: Sync Transactions

1. Hover over QuickBooks badge
2. Click **"Sync Now"**
3. Transactions import automatically
4. Check chat to see imported data

---

## 📂 Files Created

### Database Schema
- `prisma/schema.prisma` - Added `QuickBooksConnection` model

### Services
- `src/lib/quickbooksService.ts` - Complete QuickBooks API integration

### API Routes
- `/api/quickbooks/connect` - Initiates OAuth flow
- `/api/quickbooks/callback` - Handles OAuth callback
- `/api/quickbooks/sync` - Syncs transactions
- `/api/integrations/quickbooks/status` - Real connection status (updated)

### Frontend
- `src/app/page.tsx` - Added Connect/Sync buttons to QB badge

---

## 🔄 How It Works

### OAuth Flow
```
User clicks "Connect QB"
    ↓
Redirects to QuickBooks
    ↓
User authorizes
    ↓
QuickBooks redirects to /api/quickbooks/callback
    ↓
App exchanges code for tokens
    ↓
Saves tokens to database
    ↓
Redirects to dashboard → Status: Connected ✅
```

### Sync Flow
```
User clicks "Sync Now"
    ↓
POST /api/quickbooks/sync
    ↓
Fetches Sales Receipts, Invoices, Payments
    ↓
Transforms to Beyond Books format
    ↓
Saves to ProcessedFile + DonationTransaction
    ↓
Updates lastSyncAt timestamp
    ↓
Returns transaction count
```

### Token Refresh
Tokens auto-refresh when expired:
- Access token: Valid for 1 hour
- Refresh token: Valid for 100 days
- Automatic refresh before expiry

---

## 🧪 Testing

### Test Connection
```bash
curl http://localhost:3000/api/integrations/quickbooks/status
```

**Expected Response (Offline)**:
```json
{
  "connected": false,
  "lastSyncAt": null,
  "error": "No QuickBooks connection configured"
}
```

**Expected Response (Connected)**:
```json
{
  "connected": true,
  "lastSyncAt": "2026-02-15T12:00:00.000Z",
  "companyName": "Your Company Name",
  "error": null
}
```

### Test Sync
```bash
curl -X POST http://localhost:3000/api/quickbooks/sync \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 💡 Usage

### Connect for the First Time
1. Hover over QB badge → Click "Connect QB"
2. Authorize in QuickBooks
3. Done! Status shows "Connected"

### Sync Transactions
1. Hover over QB badge → Click "Sync Now"
2. Transactions import automatically
3. See count in alert

### View Synced Data
1. Go to chat
2. Type: `show stats`
3. Or: `list donors`

### Disconnect (If Needed)
1. Delete connection from Prisma Studio:
```bash
npx prisma studio
```
2. Go to `QuickBooksConnection` table
3. Delete the record

---

## 🔧 Advanced Usage

### Sync Specific Date Range

```typescript
// POST /api/quickbooks/sync
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31"
}
```

### Get Company Info
```bash
# Via API
const qbService = getQuickBooksService();
const company = await qbService.getCompanyInfo();
```

### Custom Queries
```bash
# Get customers
const customers = await qbService.query(`SELECT * FROM Customer MAXRESULTS 100`);

# Get specific invoice
const invoice = await qbService.query(`SELECT * FROM Invoice WHERE Id = '123'`);
```

---

## 🚨 Troubleshooting

### "No QuickBooks connection configured"
**Solution**: Click "Connect QB" button and authorize

### "Failed to get access token"
**Cause**: Client ID/Secret wrong or redirect URI mismatch
**Solution**:
1. Check `.env` credentials
2. Verify redirect URI in QB app matches exactly

### "Refresh token expired"
**Cause**: Refresh token expired (100 days)
**Solution**: Reconnect QuickBooks

### Sync returns 0 transactions
**Cause**: No transactions in date range
**Solution**: Check QuickBooks has data in sandbox

### "QuickBooks API error: 401"
**Cause**: Token expired or invalid
**Solution**: Tokens auto-refresh - if persists, reconnect

---

## 🔐 Security Notes

### Tokens Storage
- Stored encrypted in SQLite database
- Access tokens: 1 hour expiry
- Refresh tokens: 100 days expiry
- Auto-refresh before expiry

### Environment Variables
**Never commit `.env` to Git**:
```bash
# Already in .gitignore
.env
.env.local
```

### Production Checklist
- [ ] Use HTTPS for redirect URI
- [ ] Use Production environment (not Sandbox)
- [ ] Set secure environment variables
- [ ] Use strong database encryption
- [ ] Implement rate limiting
- [ ] Add error logging/monitoring

---

## 📊 Database Schema

### QuickBooksConnection Table
```prisma
model QuickBooksConnection {
  id            String    @id @default(cuid())
  realmId       String    @unique          // QB Company ID
  accessToken   String                     // OAuth access token
  refreshToken  String                     // OAuth refresh token
  tokenType     String    @default("Bearer")
  expiresAt     DateTime                   // Access token expiry
  refreshExpiresAt DateTime                // Refresh token expiry
  companyName   String?                    // Company name from QB
  lastSyncAt    DateTime?                  // Last sync timestamp
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

---

## 🎯 Next Steps

### Automatic Sync
Add a cron job to sync daily:
```typescript
// Can use Vercel Cron or node-cron
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  // Run sync at 2 AM daily
  await fetch('/api/quickbooks/sync', { method: 'POST' });
});
```

### Webhooks (Real-time)
Configure QuickBooks webhooks:
1. Set up webhook endpoint
2. Receive real-time transaction updates
3. No need for polling

### Multi-Company Support
Support multiple QB companies:
```typescript
// Add companyId to routes
await qbService.getConnection(companyId);
```

---

## 🆚 n8n vs Direct Integration

### Before (n8n)
```
Beyond Books → n8n → QuickBooks → n8n → Beyond Books
```
- Extra dependency
- Complex setup
- Needs n8n running
- realmId errors

### After (Direct)
```
Beyond Books → QuickBooks
```
- ✅ No external dependencies
- ✅ Simple OAuth flow
- ✅ Automatic token management
- ✅ Real-time status checks
- ✅ Built-in sync

---

## ✅ What You Can Do Now

1. ✅ Click "Connect QB" to authorize
2. ✅ Sync transactions with one click
3. ✅ See real-time connection status
4. ✅ View synced data in chat
5. ✅ Generate donation letters from QB data
6. ✅ No n8n required!

---

**You're all set!** Just add your QuickBooks credentials to `.env` and click "Connect QB" on the dashboard. 🚀
