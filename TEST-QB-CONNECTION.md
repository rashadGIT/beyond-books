# Testing QuickBooks API Connection

## How It Works Now

Your app **actually calls the QuickBooks API** every 60 seconds to verify the connection is live.

### The Flow

```
Dashboard polls every 60s
    ↓
GET /api/integrations/quickbooks/status
    ↓
Gets connection from database
    ↓
Calls QuickBooks API: GET /v3/company/{realmId}/companyinfo
    ↓
If API responds ✅ → Status: "Connected"
If API fails ❌ → Status: "Offline"
```

## See It In Action

### Step 1: Start the Dev Server

```bash
npm run dev
```

### Step 2: Watch the Console

You'll see logs like this:

```bash
🔍 Testing QuickBooks connection by calling API...
🔄 Making API call to QuickBooks (realmId: 123456789)...
✅ QuickBooks API call successful: {
  companyName: 'Your Company Name',
  country: 'US'
}
✅ QuickBooks API responded successfully
```

**This happens every 60 seconds!**

### Step 3: Watch Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter for "status"
4. Every 60 seconds you'll see:
   ```
   GET /api/integrations/quickbooks/status
   Status: 200
   Response: { connected: true, companyName: "..." }
   ```

### Step 4: Test Disconnect

1. Stop the server: `Ctrl+C`
2. The dashboard polls but server is down
3. Status shows: "Offline" ❌

## Manual Test

### Test the Connection Right Now

```bash
# Call the status endpoint
curl http://localhost:3000/api/integrations/quickbooks/status

# Expected response when connected:
{
  "connected": true,
  "lastSyncAt": "2026-02-15T12:00:00.000Z",
  "companyName": "Your Company Name",
  "realmId": "123456789",
  "error": null,
  "isStale": false
}

# Expected response when NOT connected:
{
  "connected": false,
  "lastSyncAt": null,
  "error": "No QuickBooks connection configured",
  "isStale": true
}
```

### Watch Server Logs

```bash
# Start server with logs
npm run dev

# Watch for these logs every 60 seconds:
🔍 Testing QuickBooks connection by calling API...
🔄 Making API call to QuickBooks (realmId: 123456789)...
✅ QuickBooks API call successful: { companyName: 'Your Company' }
✅ QuickBooks API responded successfully
```

## What Gets Called

### The Actual API Call

```typescript
// src/lib/quickbooksService.ts

async testConnection(): Promise<boolean> {
  // Gets connection from database
  const connection = await this.getActiveConnection();

  // Makes REAL API call to QuickBooks
  const companyInfo = await this.getCompanyInfo();
  // ↑ This calls:
  // GET https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/companyinfo/{realmId}

  return true; // Only returns true if API call succeeds
}
```

## Proof It's Working

### Console Logs Show:

1. **Before API call**:
   ```
   🔍 Testing QuickBooks connection by calling API...
   🔄 Making API call to QuickBooks (realmId: 123456789)...
   ```

2. **After successful API call**:
   ```
   ✅ QuickBooks API call successful: {
     companyName: 'Your Company Name',
     country: 'US'
   }
   ✅ QuickBooks API responded successfully
   ```

3. **If API call fails**:
   ```
   ❌ QuickBooks API call failed: {
     error: 'Request failed with status 401',
     details: 'Unauthorized'
   }
   ❌ QuickBooks API call failed
   ```

## The Difference

### ❌ Before (n8n - didn't work)
```
n8n tries to call QB → gets realmId error → never works
```

### ✅ Now (Direct integration)
```
App → QB OAuth → Save tokens → Call QB API → Get company info → Return "Connected" ✅
```

## Try It Now!

1. **Connect QuickBooks**:
   - Hover over QB badge
   - Click "Connect QB"
   - Authorize

2. **Watch the logs**:
   ```bash
   ✅ QuickBooks connected successfully: {
     realmId: '123456789',
     companyName: 'Your Company'
   }
   ```

3. **See it stay online**:
   - Every 60 seconds: API call
   - If successful: Status stays "Connected" ✅
   - If fails: Status changes to "Offline" ❌

---

**The status badge shows "Connected" ONLY when the QuickBooks API actually responds!** 🎯
