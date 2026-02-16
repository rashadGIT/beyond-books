# Security Checklist - Protected Sensitive Data

## ✅ Files Protected by .gitignore

### 🔐 Environment Variables & Secrets
```
.env                    ← QuickBooks Client ID & Secret
.env.local
.env.development.local
.env.production.local
```

### 🗄️ Database Files (Contains OAuth Tokens & Donor Data)
```
*.db                    ← SQLite database files
*.db-journal           ← SQLite journal files
*.db-shm               ← SQLite shared memory
*.db-wal               ← SQLite write-ahead log
dev.db                 ← Main development database
prisma/dev.db          ← Alternative location
```

**What's in the database:**
- QuickBooks OAuth access tokens
- QuickBooks refresh tokens
- Donor names and emails
- Transaction amounts
- Personal donation history

### 📄 Generated PDFs (Contains Donor Information)
```
generated-pdfs/        ← All generated donation letters
*.pdf                  ← Any PDF files
```

**What's in PDFs:**
- Donor names
- Donor emails
- Donation amounts
- Tax information
- Personal addresses (if added)

### 📂 Uploaded Files (Contains Transaction Data)
```
uploads/               ← Uploaded CSV/Excel files
uploaded-files/        ← Alternative upload location
```

**What's in uploads:**
- Donor transaction data
- Email addresses
- Payment information
- Original financial records

### 💼 QuickBooks Data Exports
```
quickbooks-exports/    ← QB data dumps
qb-data/              ← QB sync files
```

### 📊 Donor/Customer Files
```
*Customer*.xlsx       ← Customer lists
*Donor*.xlsx         ← Donor lists
*Sales*.xlsx         ← Sales records
*Phone*.xlsx         ← Contact info
test_*.csv           ← Test data
demo_*.csv           ← Demo data
```

---

## 🚨 What Gets Committed (Safe Files)

### ✅ Safe to Commit
```
.env.example          ← Template only (no real credentials)
src/                  ← Source code
public/               ← Public assets
package.json          ← Dependencies
README.md             ← Documentation
*.ts                  ← TypeScript code
*.tsx                 ← React components
```

---

## 🔍 Verify Protection

### Check what's ignored:
```bash
git status --ignored
```

### Check what would be committed:
```bash
git status
```

### Test if file is ignored:
```bash
git check-ignore -v dev.db
git check-ignore -v .env
git check-ignore -v generated-pdfs/letter-123.pdf
```

---

## 📝 Current Protected Items

| File/Folder | Contains | Protected? |
|------------|----------|------------|
| `.env` | QB Client ID, Client Secret | ✅ Yes |
| `dev.db` | OAuth tokens, donor data | ✅ Yes |
| `generated-pdfs/` | Donation letters | ✅ Yes |
| `uploads/` | Transaction files | ✅ Yes |
| `*.pdf` | Any PDF documents | ✅ Yes |
| `*.db` | Any database files | ✅ Yes |

---

## 🛡️ Security Best Practices

### 1. Never Commit Credentials
- ❌ Don't commit `.env` files
- ❌ Don't hardcode API keys in code
- ✅ Use environment variables
- ✅ Use `.env.example` as template

### 2. Protect Database Files
- ❌ Don't commit SQLite databases
- ❌ Don't share database files
- ✅ Use database backups offline
- ✅ Encrypt database in production

### 3. Protect User Data
- ❌ Don't commit uploaded files
- ❌ Don't commit generated PDFs
- ✅ Store files outside git repo
- ✅ Use cloud storage for production

### 4. QuickBooks Tokens
- ❌ Never share access/refresh tokens
- ❌ Don't log tokens to console
- ✅ Store in database only
- ✅ Refresh tokens automatically

---

## 🔒 Production Security Checklist

Before deploying to production:

- [ ] All `.env` files excluded from git
- [ ] Database uses strong encryption
- [ ] OAuth tokens stored securely
- [ ] File uploads go to secure storage (S3, etc.)
- [ ] HTTPS enabled for all endpoints
- [ ] Environment variables set in hosting platform
- [ ] No hardcoded secrets in code
- [ ] Rate limiting enabled
- [ ] Error logs don't expose sensitive data
- [ ] Database backups encrypted

---

## 🚨 If You Accidentally Commit Sensitive Data

### 1. Remove from Git History
```bash
# Remove file from git but keep locally
git rm --cached .env

# Commit the removal
git commit -m "Remove sensitive file"

# Force push (if already pushed to remote)
git push --force
```

### 2. Rotate Credentials
If you committed credentials:
1. Go to QuickBooks Developer Portal
2. Regenerate Client Secret
3. Update `.env` with new secret
4. Test connection still works

### 3. Clean Git History (Advanced)
```bash
# Remove file from entire git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

---

## ✅ Verify Your Repository is Clean

```bash
# Check for sensitive files in git
git ls-files | grep -E '\.(db|env|pdf)$'

# Should return nothing!
# If it returns files, they need to be removed
```

---

## 📞 Emergency Response

If sensitive data was exposed:

1. **Rotate all credentials immediately**
2. **Remove from git history**
3. **Force push to overwrite remote**
4. **Notify affected users (if donor data)**
5. **Review security practices**

---

## 🎯 Summary

**Protected:**
- ✅ QuickBooks OAuth credentials
- ✅ Database with tokens & donor data
- ✅ Generated donation letters
- ✅ Uploaded transaction files
- ✅ All sensitive file types

**You're safe to commit:**
- ✅ Source code
- ✅ Documentation
- ✅ Configuration templates
- ✅ Public assets

---

**Your sensitive data is now protected!** 🔒
