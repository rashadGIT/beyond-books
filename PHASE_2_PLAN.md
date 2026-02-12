# Phase 2: Multi-Platform Data Import & Email Integration

**Status:** Planned (Post-Demo)
**Timeline:** 3-4 weeks after Phase 1 approval
**Priority:** High

---

## 🎯 Goals

1. Import donation data from multiple platforms (PayPal, Network For Good, etc.)
2. Generate QuickBooks-ready CSV files for import
3. Implement email delivery for donation letters
4. Add PDF download functionality
5. Enhance customer deduplication logic

---

## 📋 Features

### **1. Multi-Platform Import Support**

#### **Platforms to Support:**
- ✅ PayPal (already parsed in Phase 1)
- ✅ Network For Good
- ✅ Communities Foundation Disbursement Reports
- ✅ Stripe/Unified Payments
- 🔄 Add: Kindful integration
- 🔄 Add: Generic CSV mapper (user defines columns)

#### **Implementation:**
```typescript
// Extend parser.ts
export const detectPlatform = (headers: string[]): Platform => {
  // Auto-detect platform by header analysis
  // Return platform type + confidence score
}

export const mapToPlatform = (
  data: any[],
  platform: Platform
): StandardizedTransaction[] => {
  // Platform-specific mapping logic
}
```

**Files to Update:**
- `src/lib/parser.ts` - Add platform detection
- `src/lib/types.ts` - Add Platform enum
- `src/app/page.tsx` - Multi-file upload support

---

### **2. QuickBooks CSV Export**

#### **Features:**
- Generate Sales Receipt CSV in QB format
- Support both single-line and multi-line transactions
- Handle fee separation (two line items per donation)
- Include all required QB fields

#### **QuickBooks Sales Receipt Format:**
```csv
Sales Receipt No.,*Customer,Email,Deposit To Account,*Date,Payment Method,*Product/Service,Description,Qty,Rate,*Amount
1001,John Smith,john@email.com,Checking,01/15/2026,PayPal,Donation,Online Donation,1,100.00,100.00
1001,,,,,PayPal,Processing Fee,PayPal Fee,1,-2.90,-2.90
```

#### **Implementation:**
```typescript
// src/lib/quickbooks.ts
export const generateSalesReceiptCSV = (
  transactions: StandardizedTransaction[],
  options: QBExportOptions
): string => {
  // Convert transactions to QB Sales Receipt format
  // Separate fees into line items
  // Return CSV string
}

export const generateInvoiceCSV = (
  transactions: StandardizedTransaction[],
  options: QBExportOptions
): string => {
  // Alternative: Invoice format
}
```

**UI Flow:**
1. User uploads platform data (PayPal, etc.)
2. Data is parsed and displayed in table
3. User clicks "Export to QuickBooks"
4. System generates QB-formatted CSV
5. User downloads CSV
6. User imports CSV into QuickBooks

**Files to Create:**
- `src/lib/quickbooks.ts` - QB export logic
- `src/app/export/page.tsx` - Export configuration UI

---

### **3. Email Integration**

#### **Email Service Options:**
- **SendGrid** (Recommended)
- **Resend** (Modern alternative)
- **AWS SES** (Cost-effective)
- **Mailgun**

#### **Features:**
- Send individual donation letters via email
- Batch send to all donors
- Email template customization
- Track sent emails (prevent duplicates)
- Preview email before sending
- Attachments (PDF letter)

#### **Implementation:**

**Backend API Route:**
```typescript
// src/app/api/send-letter/route.ts
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { donorEmail, donorName, amount, branding, pdfUrl } = await request.json();

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: `${branding.organizationName} <donations@yourdomain.com>`,
    to: donorEmail,
    subject: `Tax Receipt - ${branding.organizationName}`,
    html: generateEmailHTML(donorName, amount, branding),
    attachments: pdfUrl ? [{ filename: 'donation-receipt.pdf', path: pdfUrl }] : []
  });

  return Response.json({ success: !error, data, error });
}
```

**Email Template:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2 style="color: {primaryColor};">{organizationName}</h2>
  <p>Dear {firstName},</p>
  <p>Thank you for your generous contribution of ${amount}...</p>
  <p>Your tax receipt is attached.</p>
  <p>Sincerely,<br/>{signerName}<br/>{signerTitle}</p>
</div>
```

**Files to Create:**
- `src/app/api/send-letter/route.ts` - Email API
- `src/lib/email-templates.ts` - HTML email templates
- `src/components/EmailPreview.tsx` - Preview component

**Dependencies to Add:**
```bash
npm install resend
# OR
npm install @sendgrid/mail
```

---

### **4. PDF Download Functionality**

#### **Option A: react-pdf/renderer** (Recommended)
```bash
npm install @react-pdf/renderer
```

**Pros:**
- React components → PDF
- Server-side or client-side rendering
- Good quality output
- Similar to current HTML template

**Implementation:**
```typescript
// src/lib/pdf-generator.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export const DonationLetterPDF = ({ donor, branding }: Props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ color: branding.primaryColor }}>
          {branding.organizationName}
        </Text>
      </View>
      {/* ... rest of letter */}
    </Page>
  </Document>
);

// Usage
import { pdf } from '@react-pdf/renderer';

const blob = await pdf(<DonationLetterPDF {...} />).toBlob();
// Download or send as email attachment
```

#### **Option B: jsPDF** (Lighter alternative)
```bash
npm install jspdf
```

**Files to Create:**
- `src/lib/pdf-generator.tsx` - PDF generation logic
- `src/app/api/generate-pdf/route.ts` - Server-side PDF generation

---

### **5. Customer Deduplication & Matching**

#### **Problem:**
Same donor with slight name variations:
- "John Smith" vs "John M. Smith"
- "john.smith@email.com" vs "JOHN.SMITH@EMAIL.COM"

#### **Solution:**

**Email-based matching (Primary):**
```typescript
const normalizeEmail = (email: string) =>
  email.trim().toLowerCase();

// Match by email first
const customer = customers.find(c =>
  normalizeEmail(c.email) === normalizeEmail(tx.donorEmail)
);
```

**Fuzzy name matching (Fallback):**
```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(customers, {
  keys: ['name'],
  threshold: 0.3 // Similarity threshold
});

const matches = fuse.search(tx.donorName);
```

**Implementation:**
```typescript
// src/lib/deduplication.ts
export const findBestMatch = (
  transaction: StandardizedTransaction,
  customers: CustomerContact[]
): CustomerContact | null => {
  // 1. Try exact email match
  // 2. Try normalized email match
  // 3. Try fuzzy name match
  // 4. Return best match or null
}

export const suggestDuplicates = (
  customers: CustomerContact[]
): DuplicateGroup[] => {
  // Find potential duplicates for user review
  // Group by similar emails or names
}
```

**UI for Manual Review:**
```typescript
// src/components/DuplicateReview.tsx
<DuplicateReviewModal>
  <DuplicateGroup>
    <Customer>John Smith (john@email.com) - $1000</Customer>
    <Customer>John M Smith (john@email.com) - $500</Customer>
    <Button>Merge</Button>
    <Button>Keep Separate</Button>
  </DuplicateGroup>
</DuplicateReviewModal>
```

**Files to Create:**
- `src/lib/deduplication.ts` - Matching logic
- `src/components/DuplicateReview.tsx` - UI component

---

## 🏗️ Technical Architecture

### **New API Routes:**
```
src/app/api/
├── send-letter/route.ts       # Email sending
├── send-batch/route.ts        # Batch email sending
├── generate-pdf/route.ts      # PDF generation
└── export-qb/route.ts         # QuickBooks CSV export
```

### **New Components:**
```
src/components/
├── PlatformSelector.tsx       # Choose import platform
├── EmailPreview.tsx           # Preview email before send
├── BatchEmailModal.tsx        # Batch send configuration
├── DuplicateReview.tsx        # Manual duplicate review
└── QBExportConfig.tsx         # QB export settings
```

### **New Library Files:**
```
src/lib/
├── quickbooks.ts              # QB CSV generation
├── pdf-generator.tsx          # PDF generation
├── email-templates.ts         # Email HTML templates
└── deduplication.ts           # Customer matching
```

---

## 📦 Dependencies to Add

```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.4.0",
    "resend": "^3.2.0",
    "fuse.js": "^7.0.0"
  }
}
```

---

## 🔐 Environment Variables

```env
# Email Service
RESEND_API_KEY=re_xxxxx
# OR
SENDGRID_API_KEY=SG.xxxxx

# Email Configuration
EMAIL_FROM_ADDRESS=donations@youthrevive.org
EMAIL_FROM_NAME=Youth Revive Inc.

# PDF Generation
PDF_STORAGE_URL=https://yourdomain.com/pdfs/
```

---

## 🧪 Testing Requirements

### **Platform Import Tests:**
- ✅ Test PayPal CSV import
- ✅ Test Network For Good import
- ✅ Test Stripe/Unified Payments
- ✅ Test invalid/malformed CSV handling
- ✅ Test fee calculation accuracy

### **QuickBooks Export Tests:**
- ✅ Verify QB CSV format matches template
- ✅ Test fee separation (two line items)
- ✅ Test special characters in names
- ✅ Test date formatting
- ✅ Manual import test in QB sandbox

### **Email Tests:**
- ✅ Test email delivery
- ✅ Test PDF attachment
- ✅ Test email template rendering
- ✅ Test batch sending (rate limits)
- ✅ Test error handling (bounce, invalid email)

### **Deduplication Tests:**
- ✅ Test exact email match
- ✅ Test fuzzy name match
- ✅ Test case sensitivity handling
- ✅ Test special characters
- ✅ Test merge functionality

---

## 📊 Success Metrics

- [ ] Support 5+ platform imports
- [ ] 100% accurate QB CSV generation
- [ ] Email delivery rate >95%
- [ ] Customer deduplication accuracy >90%
- [ ] PDF generation time <3 seconds
- [ ] Zero data loss during import

---

## 🚀 Deployment Steps

1. **Development:**
   - Implement features in feature branches
   - Write unit tests for each module
   - Test with sample data

2. **Staging:**
   - Deploy to staging environment
   - Test with real QuickBooks sandbox
   - Test email sending (test mode)
   - UAT with Brandie

3. **Production:**
   - Configure production email service
   - Set up error monitoring (Sentry)
   - Deploy to production
   - Monitor for 24 hours

---

## 💰 Cost Estimate

### **Development Time:**
- Multi-platform import: 1 week
- QB CSV export: 3 days
- Email integration: 1 week
- PDF generation: 3 days
- Deduplication: 3 days
- Testing & refinement: 4 days

**Total: 3-4 weeks**

### **Recurring Costs:**
- Email service (Resend): $20/month (50k emails)
- Hosting: $0 (Vercel free tier)
- Total: ~$20/month

---

## 📝 Notes

- Keep Phase 1 functionality intact
- Maintain backward compatibility
- Document all API endpoints
- Create user guide for QB import process
- Add comprehensive error messages
- Log all email sends for audit trail

---

**Next Phase:** [Phase 3: QuickBooks API & Advanced Features](./PHASE_3_PLAN.md)
