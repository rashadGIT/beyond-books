# QuickBooks OAuth Setup Guide

This guide fixes the `realmId` error you're seeing.

## ❌ The Error

```
TypeError: Cannot read properties of undefined (reading 'realmId')
```

**What it means**: The QuickBooks OAuth authentication isn't complete. The `realmId` is the QuickBooks Company ID that gets set during OAuth.

---

## ✅ Quick Fix: Use Simple Heartbeat First

**Recommended for testing:**

1. Use [simple-heartbeat-no-auth.json](simple-heartbeat-no-auth.json) instead
2. This works immediately without QuickBooks setup
3. Your dashboard will show "Connected" status

```bash
# In n8n:
Workflows → Import from File → simple-heartbeat-no-auth.json → Activate
```

---

## 🔐 Full QuickBooks OAuth Setup (For Production)

### Step 1: Create QuickBooks Developer Account

1. Go to https://developer.intuit.com/
2. Sign in with your Intuit account
3. Click **My Apps** → **Create an app**
4. Select **QuickBooks Online and Payments**

### Step 2: Configure Your App

1. **App name**: Beyond Books Integration
2. **App description**: Donation tracking and letter generation
3. Click **Create app**

### Step 3: Get Credentials

1. Go to **Keys & OAuth** (or **Development** → **Keys & credentials**)
2. You'll see:
   - **Client ID**: `ABxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Client Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. **Copy both** - you'll need them next

### Step 4: Set Redirect URI

**Important**: This must match exactly!

1. Under **Redirect URIs**, click **Add URI**
2. Enter your n8n OAuth callback URL:

**For local n8n (default):**
```
http://localhost:5678/rest/oauth2-credential/callback
```

**For cloud/hosted n8n:**
```
https://your-n8n-domain.com/rest/oauth2-credential/callback
```

3. Click **Save**

### Step 5: Choose Environment

- **Sandbox**: Test with fake data (recommended first)
- **Production**: Real QuickBooks data

Click the **Development** or **Production** tab accordingly.

### Step 6: Configure n8n Credentials

1. **In n8n**, click **Credentials** (left sidebar)
2. Click **Add Credential**
3. Search for **QuickBooks OAuth2 API**
4. Fill in the form:

```
Credential name: QuickBooks OAuth2
Client ID: [paste from Step 3]
Client Secret: [paste from Step 3]
Environment: Sandbox (or Production)
```

5. **Do NOT click Save yet!**

### Step 7: Authenticate (Critical Step)

1. Click **Connect my account** (or **Sign in with Intuit**)
2. A popup window opens
3. **Sign in to QuickBooks**
4. **Select the company** you want to connect
5. Click **Authorize**
6. The popup closes - you should see:
   ```
   ✓ Connection successful
   realmId: 123145XXXXXX
   ```

7. **NOW click Save**

### Step 8: Verify realmId

1. Click on your credential again
2. You should see:
   - **OAuth Data**: Contains `realmId`
   - **Token Expiry**: Shows when token expires

If you **don't see realmId**, the OAuth didn't complete:
- Delete the credential
- Start over from Step 6
- Make sure popup blockers are disabled

### Step 9: Use in Workflow

1. Import [quickbooks-heartbeat-monitor-v2.json](quickbooks-heartbeat-monitor-v2.json)
2. Click **"QuickBooks - Test Connection"** node
3. Under **Credentials**, select your newly created credential
4. Click **Execute Node** to test
5. Should succeed ✓

### Step 10: Activate

1. Toggle **Active** switch in top-right
2. Wait 60 seconds
3. Check your dashboard - should show "Connected"

---

## 🔍 Troubleshooting

### Error: "realmId is undefined"

**Cause**: OAuth didn't complete properly

**Fix**:
1. Delete the credential in n8n
2. Create new credential
3. **Make sure** you click "Connect my account" and authorize
4. Verify `realmId` appears before saving

### Error: "401 Unauthorized"

**Cause**: OAuth token expired (tokens expire every 60 days)

**Fix**:
1. Go to Credentials
2. Click your QuickBooks credential
3. Click **Reconnect**
4. Re-authorize

### Error: "Cannot find company"

**Cause**: Wrong environment (Sandbox vs Production)

**Fix**:
1. Check if you're using Sandbox credentials with Production data (or vice versa)
2. Create new credential with correct environment

### Error: "Invalid redirect URI"

**Cause**: Redirect URI in QuickBooks app doesn't match n8n

**Fix**:
1. Check n8n URL in your browser
2. Go to QuickBooks developer portal
3. Update Redirect URI to match exactly
4. Include the full path: `/rest/oauth2-credential/callback`

### Popup Blocked

**Cause**: Browser blocking OAuth popup

**Fix**:
1. Allow popups for your n8n domain
2. Click "Connect my account" again

---

## 🧪 Testing Your Setup

### Test 1: Manual Node Execution

1. Open the workflow
2. Click **"QuickBooks - Test Connection"** node
3. Click **Execute Node**
4. Should see QuickBooks company info

### Test 2: Check Credential

```bash
# In n8n, check the credential has:
- OAuth Data with realmId
- Access token
- Refresh token
- Expiry time
```

### Test 3: Full Workflow Test

1. Click **Execute Workflow** (top-right)
2. Check all nodes turn green
3. Last node should POST to your API

---

## 📝 Alternative: Skip QuickBooks for Now

If you just want to test the status indicator:

**Option 1: Simple Heartbeat**
- Use [simple-heartbeat-no-auth.json](simple-heartbeat-no-auth.json)
- No QuickBooks needed
- Shows "Connected" on dashboard

**Option 2: Manual Testing**
```bash
# Simulate connection with curl:
curl -X POST http://localhost:3000/api/integrations/quickbooks/status \
  -H "Content-Type: application/json" \
  -d '{"heartbeat": true}'
```

---

## 🎯 Next Steps After Setup

Once credentials work:

1. ✅ Import [quickbooks-heartbeat-monitor-v2.json](quickbooks-heartbeat-monitor-v2.json)
2. ✅ Select your credential in the QB node
3. ✅ Test node execution
4. ✅ Activate workflow
5. ✅ Monitor dashboard status

---

## 💡 Pro Tips

- **Token Refresh**: QuickBooks tokens expire every 60 days - n8n auto-refreshes
- **Rate Limits**: QuickBooks allows 500 API calls/minute
- **Sandbox Data**: Use QuickBooks Sandbox for testing without affecting real data
- **Production**: Only use Production when ready to go live

---

## 📞 Still Having Issues?

1. Check [QuickBooks API Status](https://status.developer.intuit.com/)
2. Review [QuickBooks OAuth Docs](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
3. Check n8n Executions tab for detailed errors
4. Verify redirect URI matches exactly (common issue)

---

## ✅ Checklist

Before activating the workflow, verify:

- [ ] QuickBooks developer account created
- [ ] App created in developer portal
- [ ] Client ID and Secret copied
- [ ] Redirect URI added (matches n8n URL)
- [ ] Credential created in n8n
- [ ] "Connect my account" clicked
- [ ] OAuth popup authorized
- [ ] realmId visible in credential
- [ ] Test node execution successful
- [ ] Workflow activated

If all checked ✓ - you're ready to go! 🚀
