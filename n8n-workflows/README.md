# n8n Workflows for QuickBooks Integration

This folder contains ready-to-import n8n workflows for integrating QuickBooks with Beyond Books.

## 📦 Available Workflows

### 1. **simple-heartbeat-no-auth.json** ⭐ START HERE
- **Purpose**: Test the QuickBooks status indicator without QuickBooks authentication
- **Complexity**: Beginner
- **Runs**: Every 1 minute
- **What it does**: Sends heartbeat to keep status "Connected"
- **Use case**: Quick setup to see the dashboard badge working

### 2. **quickbooks-heartbeat-monitor.json**
- **Purpose**: Monitor QuickBooks connection status with authentication
- **Complexity**: Intermediate
- **Runs**: Every 1 minute
- **What it does**:
  - Tests QuickBooks connection
  - Updates dashboard status (Connected/Error)
  - Handles authentication errors
- **Requires**: QuickBooks OAuth2 credentials

### 3. **quickbooks-daily-sync.json**
- **Purpose**: Sync QuickBooks transactions to Beyond Books
- **Complexity**: Advanced
- **Runs**: Daily (configurable)
- **What it does**:
  - Fetches Sales Receipts and Invoices from last 30 days
  - Transforms data to Beyond Books format
  - Sends to your API
  - Updates sync status
- **Requires**: QuickBooks OAuth2 credentials + custom API endpoint

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Import Simple Heartbeat Workflow

1. Open your n8n instance
2. Click **Workflows** → **Add Workflow** → **Import from File**
3. Select `simple-heartbeat-no-auth.json`
4. Click **Import**

### Step 2: Update the URL

1. Click on the **"Send Heartbeat"** node
2. Update the URL if your app is not on `localhost:3000`:
   - Change `http://localhost:3000` to your actual URL
   - Example: `https://your-domain.com`

### Step 3: Activate the Workflow

1. Toggle the **Active** switch in the top-right corner
2. Your dashboard should now show "Connected" within 60 seconds!

### Step 4: Verify

Visit your dashboard at `http://localhost:3000` and check the QuickBooks badge in the header.

---

## 🔐 Setting Up QuickBooks OAuth (For Advanced Workflows)

### Step 1: Create QuickBooks App

1. Go to [QuickBooks Developer Portal](https://developer.intuit.com/)
2. Sign in with your Intuit account
3. Click **Create an app** → **QuickBooks Online and Payments**
4. Fill in app details:
   - **App name**: Beyond Books Integration
   - **Description**: Sync donation transactions
5. Click **Create app**

### Step 2: Get Credentials

1. Go to **Keys & credentials** tab
2. Copy your **Client ID** and **Client Secret**
3. Under **Redirect URIs**, add:
   ```
   https://your-n8n-instance.com/rest/oauth2-credential/callback
   ```
   - For local testing: `http://localhost:5678/rest/oauth2-credential/callback`

### Step 3: Configure n8n Credentials

1. In n8n, click **Credentials** → **Add Credential**
2. Search for **QuickBooks OAuth2 API**
3. Fill in:
   - **Credential Name**: QuickBooks OAuth2
   - **Client ID**: (paste from Step 2)
   - **Client Secret**: (paste from Step 2)
   - **Environment**:
     - Choose **Production** for live data
     - Choose **Sandbox** for testing
4. Click **Connect my account**
5. Sign in to QuickBooks and authorize

### Step 4: Update Workflow Credentials

1. Import `quickbooks-heartbeat-monitor.json`
2. Click on **"QuickBooks - Test Connection"** node
3. Under **Credentials**, select your newly created credential
4. Click **Save**
5. Activate the workflow

---

## 🛠️ Workflow Configuration

### Changing Heartbeat Frequency

**Default**: Every 1 minute

To change:
1. Click the **"Every 1 Minute"** (Schedule Trigger) node
2. Change **Minutes Interval** to your desired value
   - Recommended: 1-5 minutes
   - Too frequent: May hit API rate limits
   - Too infrequent: Status may show "Offline" (2-minute timeout)

### Changing Sync Schedule

For `quickbooks-daily-sync.json`:
1. Click the **"Daily Trigger"** node
2. Options:
   - **Hourly**: Change interval to hours
   - **Specific time**: Use Cron expression
     - Example: `0 9 * * *` (9 AM daily)
   - **Weekly**: `0 9 * * 1` (9 AM every Monday)

### Adjusting Date Range

In `quickbooks-daily-sync.json`:
1. Click **"Get Sales Receipts"** or **"Get Invoices"** node
2. Find the query: `WHERE TxnDate >= '{{ $now.minus({days: 30})...'`
3. Change `30` to your desired number of days

---

## 📊 Monitoring Your Workflows

### View Execution History

1. Go to **Executions** in n8n sidebar
2. See all workflow runs with timestamps
3. Click any execution to see:
   - Success/Failure status
   - Data at each node
   - Error messages

### Test Manually

1. Open any workflow
2. Click **Execute Workflow** button (top-right)
3. Check results in each node

### Debugging Errors

If a workflow fails:
1. Check **Executions** → Click failed run
2. Look for red error icons on nodes
3. Common issues:
   - **QuickBooks auth expired**: Re-authenticate credentials
   - **Network error**: Check URLs (localhost vs production)
   - **Data format error**: Check Code node transformations

---

## 🔧 Customization Guide

### Adding More Transaction Types

In `quickbooks-daily-sync.json`, add nodes for:
- **Payments**: `resource: "payment"`
- **Deposits**: `resource: "deposit"`
- **Credit Memos**: `resource: "creditMemo"`

### Filtering by Customer

Add to QuickBooks query:
```sql
SELECT * FROM SalesReceipt
WHERE TxnDate >= '2026-01-01'
AND CustomerRef = '123'
```

### Webhook Trigger (Real-time)

Replace Schedule Trigger with Webhook:
1. Add **Webhook** node
2. Set **HTTP Method**: POST
3. Copy webhook URL
4. Configure in QuickBooks webhooks settings

---

## 🚨 Troubleshooting

### Dashboard shows "Offline"

**Possible causes:**
1. Workflow not activated
2. Wrong URL in HTTP Request node
3. Heartbeat timeout (no update in 2+ minutes)

**Solution:**
- Check workflow is Active (toggle on)
- Verify URL matches your app
- Check Executions for errors

### QuickBooks authentication fails

**Solution:**
1. Re-authorize credentials in n8n
2. Check redirect URI matches exactly
3. Ensure app is in Production (not Development)

### "Cannot connect to localhost"

If n8n is cloud-hosted:
- Replace `localhost:3000` with your public URL
- Example: `https://beyond-books.herokuapp.com`

### Data not syncing

1. Check QuickBooks node returns data
   - Click node → View output
   - If empty, adjust date range or query
2. Verify API endpoint exists
   - Test with curl or Postman

---

## 📝 Example: Testing with Curl

### Test heartbeat manually:
```bash
curl -X POST http://localhost:3000/api/integrations/quickbooks/status \
  -H "Content-Type: application/json" \
  -d '{"heartbeat": true}'
```

### Simulate connection error:
```bash
curl -X POST http://localhost:3000/api/integrations/quickbooks/status \
  -H "Content-Type: application/json" \
  -d '{"connected": false, "error": "Test error"}'
```

### Check current status:
```bash
curl http://localhost:3000/api/integrations/quickbooks/status
```

---

## 🎯 Next Steps

1. ✅ Start with **simple-heartbeat-no-auth.json** to see it working
2. 🔐 Set up QuickBooks OAuth credentials
3. 📊 Import **quickbooks-heartbeat-monitor.json**
4. 🔄 Import **quickbooks-daily-sync.json** for full integration
5. 🎨 Customize workflows to match your data flow

---

## 💡 Tips

- **Start simple**: Get heartbeat working first
- **Test in Sandbox**: Use QuickBooks Sandbox environment initially
- **Monitor executions**: Keep an eye on n8n Executions tab
- **Error handling**: All workflows have error paths configured
- **Rate limits**: QuickBooks has API rate limits (500 requests/minute)

---

## 📚 Resources

- [QuickBooks API Documentation](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [n8n QuickBooks Node Docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.quickbooks/)
- [n8n Community Forum](https://community.n8n.io/)

---

## 🆘 Need Help?

If you encounter issues:
1. Check the **Troubleshooting** section above
2. Review n8n **Executions** for error details
3. Test API endpoints with curl commands
4. Check QuickBooks API status page

Happy automating! 🚀
