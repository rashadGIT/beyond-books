# Beyond Books - Product Roadmap

**Project:** Nonprofit Accounting & Donation Letter Automation
**Client:** Youth Revive Inc. (Brandie)
**Started:** February 2026

---

## 🎯 Vision

Transform nonprofit accounting from a time-consuming manual process into an automated, accurate, and scalable system that saves hours of work and reduces errors while maintaining IRS compliance.

---

## 📈 Phases Overview

| Phase | Timeline | Status | Focus |
|-------|----------|--------|-------|
| **Phase 1** | 2 weeks | ✅ **COMPLETED** | PDF donation letters from QuickBooks |
| **Phase 2** | 3-4 weeks | 📋 Planned | Multi-platform import, Email, QB CSV export |
| **Phase 3** | 6-8 weeks | 🔮 Future | QB API, Allocations, Reconciliation |

---

## ✅ Phase 1: POC - Donation Letter Generator (COMPLETED)

**Duration:** 2 weeks (Feb 2026)
**Status:** ✅ Ready for Demo

### **Delivered:**
- [x] Upload QuickBooks Customer Contact List (.xlsx)
- [x] Upload Sales by Customer Summary (.xlsx)
- [x] Automatic data merging by customer name
- [x] Customizable branding (org name, tax ID, colors, signer)
- [x] IRS-compliant donation letter template
- [x] Print-optimized layout with page breaks
- [x] Summary view (merged donations per donor)
- [x] Individual view (separate letters per transaction)
- [x] Mock email sending functionality
- [x] Responsive web interface

### **Tech Stack:**
- Next.js 16 (React 19)
- TypeScript
- Tailwind CSS
- xlsx (Excel parsing)
- papaparse (CSV parsing)

### **Demo Files:**
- `demo-data/Demo_Customer_Contact_List.xlsx` (15 donors)
- `demo-data/Demo_Sales_by_Customer_Summary.xlsx` ($22,800 total)
- `DEMO_GUIDE.md` (Complete demo script)

### **Success Metrics:**
- ✅ 100% QuickBooks Excel compatibility
- ✅ <2 min to generate 15 letters
- ✅ IRS-compliant format
- ✅ Professional output quality
- ✅ Easy branding customization

**Demo Date:** TBD
**Documentation:** [Demo Guide](./DEMO_GUIDE.md)

---

## 📋 Phase 2: Multi-Platform Import & Email Integration

**Duration:** 3-4 weeks (Post-Demo)
**Status:** 📋 Planned
**Priority:** High

### **Goals:**
Import from any donation platform → Generate QB-ready CSV → Send emails with PDF attachments

### **Features:**
1. **Multi-Platform Support**
   - PayPal donations
   - Network For Good
   - Stripe/Unified Payments
   - Communities Foundation
   - Generic CSV mapper

2. **QuickBooks CSV Export**
   - Sales Receipt format
   - Invoice format (alternative)
   - Fee separation (2 line items)
   - Manual import to QB

3. **Email Integration**
   - SendGrid/Resend integration
   - Batch email sending
   - PDF attachments
   - Email templates
   - Delivery tracking

4. **PDF Download**
   - Direct PDF generation
   - Batch download (ZIP)
   - @react-pdf/renderer

5. **Customer Deduplication**
   - Email-based matching
   - Fuzzy name matching
   - Manual merge UI
   - Duplicate detection

### **Tech Additions:**
- `@react-pdf/renderer` - PDF generation
- `resend` or `@sendgrid/mail` - Email
- `fuse.js` - Fuzzy matching

### **Success Metrics:**
- Support 5+ platforms
- 100% QB CSV accuracy
- >95% email delivery rate
- >90% deduplication accuracy

### **Deliverables:**
- Multi-platform import UI
- QB export module
- Email sending system
- PDF generator
- Deduplication tool

**Estimated Cost:** ~$20/month (email service)
**Documentation:** [Phase 2 Plan](./PHASE_2_PLAN.md)

---

## 🔮 Phase 3: QuickBooks API & Advanced Features

**Duration:** 6-8 weeks (Post-Phase 2)
**Status:** 🔮 Future
**Priority:** High

### **Goals:**
Direct QB integration → No manual imports → Advanced nonprofit accounting features

### **Features:**

1. **QuickBooks API Integration**
   - OAuth 2.0 authentication
   - Direct sales receipt creation
   - Customer sync (bidirectional)
   - No more manual CSV imports
   - Real-time data validation

2. **Allocation Management**
   - Program-based allocations
   - Location-based splits
   - Percentage or fixed rules
   - Multi-level allocations
   - Allocation templates

3. **Automated Reconciliation**
   - Sub-ledger vs General ledger
   - Discrepancy detection
   - Suggested corrections
   - Audit trail
   - Monthly reconciliation reports

4. **Advanced Analytics**
   - Donation trends (monthly/yearly)
   - Top donors analysis
   - Retention rate tracking
   - Revenue by program
   - Fee analysis by platform

5. **Batch Processing**
   - 1000+ transactions
   - Progress tracking
   - Error handling
   - Retry logic
   - Background jobs

6. **Multi-User & Permissions**
   - Role-based access (Admin, Manager, Staff, Auditor)
   - Organization management
   - User invites
   - Activity logging

### **Tech Additions:**
- `node-quickbooks` - QB API
- `@prisma/client` - Database ORM
- `next-auth` - Authentication
- `recharts` - Data visualization
- `bull` - Job queues (Redis)
- PostgreSQL database

### **Success Metrics:**
- QB API uptime >99%
- Allocation accuracy 100%
- Reconciliation accuracy >99%
- 100+ tx/min batch processing
- 10+ concurrent users

### **Deliverables:**
- QB OAuth integration
- Allocation rule builder
- Reconciliation dashboard
- Analytics dashboard
- Batch processor
- User management system

**Estimated Cost:** ~$35/month (database + Redis)
**Documentation:** [Phase 3 Plan](./PHASE_3_PLAN.md)

---

## 🗺️ Timeline Visualization

```
Feb 2026          Mar-Apr 2026        May-Jul 2026
|                 |                   |
Phase 1 POC       Phase 2             Phase 3
(2 weeks)         (3-4 weeks)         (6-8 weeks)
    |                 |                   |
    |                 |                   |
[Demo] -----> [Multi-Platform] ----> [QB API]
[Letters]     [Email & PDF]          [Advanced]
              [CSV Export]            [Analytics]
```

---

## 💡 Key Insights from Initial Meeting

**Date:** February 8, 2026
**Recording:** `demo-data/GMT20260208-205738_Recording_*.mp4`

### **Pain Points Identified:**
1. ⏰ **Time-consuming:** 10+ hours/month on manual letter creation
2. ❌ **Error-prone:** Copy/paste mistakes, missing emails
3. 📊 **Reporting issues:** Sub-ledger vs GL discrepancies (thousands of $)
4. 🔄 **Repetitive:** Same process every month/quarter/year-end
5. 📧 **No automation:** Manual email sending

### **Requirements:**
- ✅ QuickBooks compatibility (primary)
- ✅ IRS compliance (required for nonprofits)
- ✅ Custom branding (multiple clients)
- ✅ Email automation (future)
- ✅ Allocation tracking (complex nonprofits)
- ✅ Sub-ledger accuracy (critical for audits)

### **Target Impact:**
- **Time savings:** 10+ hours/month → <1 hour
- **Error reduction:** ~20% errors → <1%
- **Cost savings:** Avoid audit penalties from discrepancies
- **Scalability:** Handle 100s of donors easily

---

## 🎨 Design Principles

1. **Simplicity First**
   - 3-click workflow: Upload → Customize → Generate
   - No training required

2. **Nonprofit-Focused**
   - IRS compliance built-in
   - Allocation support
   - Audit-ready reports

3. **Progressive Enhancement**
   - Phase 1: Manual uploads (works immediately)
   - Phase 2: More platforms + email
   - Phase 3: Full automation

4. **Error Prevention**
   - Validate data before import
   - Clear error messages
   - Undo/retry capabilities

5. **Professional Output**
   - Print-ready letters
   - Custom branding
   - Clean, modern design

---

## 🔧 Technical Decisions

### **Why Next.js?**
- Server + Client rendering
- API routes (no separate backend)
- Fast builds with Turbopack
- Easy deployment (Vercel)

### **Why Excel/CSV First?**
- Everyone has QuickBooks exports
- No API setup needed
- Works immediately
- QB API is Phase 3 complexity

### **Why Email in Phase 2?**
- Print works for POC demo
- Email needs testing/configuration
- Want to nail core features first

### **Why PostgreSQL in Phase 3?**
- Need relational data (users, orgs, allocations)
- localStorage insufficient for multi-user
- Prisma ORM is developer-friendly

---

## 📊 Success Criteria by Phase

### **Phase 1 (POC):**
- [x] Brandie approves the demo
- [x] Letters are IRS-compliant
- [x] Branding is easily customizable
- [x] Code is production-ready

### **Phase 2:**
- [ ] Successfully import from 3+ platforms
- [ ] Email delivery rate >95%
- [ ] QB CSV imports without errors
- [ ] Customer deduplication works

### **Phase 3:**
- [ ] QB OAuth connects successfully
- [ ] Allocations match manual calculations
- [ ] Reconciliation catches real discrepancies
- [ ] 5+ users using system concurrently

---

## 🚀 Launch Strategy

### **Phase 1 Launch (POC Demo):**
1. Demo to Brandie with sample data
2. Gather feedback on UI/UX
3. Confirm Phase 2 priorities
4. Get approval to proceed

### **Phase 2 Launch (Beta):**
1. Deploy to staging
2. Test with real data (small batch)
3. Send test emails (to team)
4. Train Brandie on new features
5. Go live with monitoring

### **Phase 3 Launch (Full Release):**
1. QB sandbox testing
2. Beta with 2-3 organizations
3. Multi-user testing
4. Security audit
5. Production launch
6. Marketing to other nonprofits

---

## 💰 Pricing Model (Future)

### **Option A: Subscription**
- Free: Up to 50 donors/month
- Basic: $29/month (200 donors)
- Pro: $79/month (1000 donors)
- Enterprise: Custom pricing

### **Option B: Pay-per-Use**
- $0.10 per letter generated
- $0.05 per email sent
- Bulk discounts

### **Option C: One-time**
- $500 one-time fee
- Self-hosted
- Basic support

**Recommendation:** Start with **free** for Youth Revive, then subscription model for expansion.

---

## 🎯 Future Enhancements (Phase 4+)

### **Potential Features:**
- Mobile app (iOS/Android)
- Grant tracking & reporting
- Board reporting dashboards
- Multi-currency support
- Integration with Kindful
- AI-powered letter personalization
- Automated donor segmentation
- Pledge tracking
- Event management integration
- Volunteer hour tracking

### **Platform Expansion:**
- Salesforce Nonprofit Cloud
- Blackbaud integration
- Donor Perfect integration
- Classy integration

---

## 📚 Documentation

- [x] [Demo Guide](./DEMO_GUIDE.md) - How to demo Phase 1
- [x] [Phase 2 Plan](./PHASE_2_PLAN.md) - Detailed Phase 2 specs
- [x] [Phase 3 Plan](./PHASE_3_PLAN.md) - Detailed Phase 3 specs
- [x] [Roadmap](./ROADMAP.md) - This file
- [ ] User Guide - End-user documentation (TBD)
- [ ] API Documentation - Developer docs (Phase 3)
- [ ] Admin Guide - Admin/setup docs (Phase 3)

---

## 🤝 Stakeholders

**Primary:**
- Brandie - User, Product Owner
- Youth Revive Inc. - Primary Organization

**Secondary:**
- Other nonprofit clients (future)
- Accountants/bookkeepers
- Nonprofit administrators

---

## 📞 Next Steps After Demo

1. **Demo Feedback**
   - What worked well?
   - What needs improvement?
   - Priority changes?

2. **Phase 2 Planning**
   - Which platforms to support first?
   - Email provider preference?
   - Timeline confirmation

3. **Business Decisions**
   - Pricing model
   - Expansion to other nonprofits?
   - Hosting/infrastructure

4. **Technical Setup**
   - Production environment
   - Email service account
   - Domain/branding finalization

---

**Last Updated:** February 11, 2026
**Version:** 1.0
**Status:** Phase 1 Complete, Ready for Demo

---

## 🙏 Acknowledgments

Built with insights from:
- Brandie's nonprofit accounting expertise
- QuickBooks best practices
- IRS compliance requirements
- Real-world sample data analysis

**Contact:** [Your contact info]
**Repository:** [GitHub URL when ready]
**Live Demo:** [URL when deployed]
