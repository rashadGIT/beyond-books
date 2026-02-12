# 🎬 Donation Letter Generator - Demo Guide

## 📦 Demo Files Created

✅ **Demo_Customer_Contact_List.xlsx**
- 15 sample donors with complete contact information
- Names, emails, phone numbers, addresses
- Ready to upload to the app

✅ **Demo_Sales_by_Customer_Summary.xlsx**
- 15 donors with donation amounts
- Total: $22,800.00
- Average donation: $1,520.00
- Matches customer names from Contact List

---

## 🎯 Demo Flow (5-10 minutes)

### **Step 1: Introduction (1 min)**
"This is the Donation Letter Generator POC - Phase 1. It automatically creates IRS-compliant donation letters from your QuickBooks data."

### **Step 2: Upload Files (2 min)**

1. **Upload Customer Contact List**
   - Click the left upload box
   - Select `Demo_Customer_Contact_List.xlsx`
   - ✅ Shows "15 Customers Loaded"

2. **Upload Sales Summary**
   - Click the right upload box
   - Select `Demo_Sales_by_Customer_Summary.xlsx`
   - ✅ Shows "15 Donations Loaded"

**Key Points:**
- "The app automatically merges the data by customer name"
- "Customer List provides emails, Sales Summary provides amounts"
- Point out the statistics cards: Customers, Total Donations, Fees, Net Amount

### **Step 3: Customize Branding (2 min)**

1. Click **"Customize Branding"** button
2. Show the customization options:
   - Change Organization Name (e.g., "Your Organization Name")
   - Update Tax ID
   - Change signer name/title
   - Pick a different primary color
3. Click **"Save Changes"**

**Key Points:**
- "Every organization can use their own branding"
- "The color picker makes it easy to match your brand"
- "All letters will use these settings"

### **Step 4: Generate Letters (3 min)**

1. Click **"Generate Letters"** button
2. Show **Summary (Merged)** view:
   - "One letter per donor with all their donations"
   - Point out the professional formatting
   - Show the donation amount highlight
   - Show the IRS compliance statement at the bottom

3. Switch to **Individual** view:
   - "Separate letter for each donation"
   - "Useful for monthly donors who want individual receipts"

4. Demonstrate features:
   - **Print All** button - "Print-optimized with page breaks"
   - **Send via Email** button - "Mock email for demo, ready for SMTP integration"

**Key Points:**
- "IRS-compliant format with all required information"
- "Professional letterhead with custom branding"
- "Tax ID displayed for donor records"
- "Clean, print-ready layout"

### **Step 5: Show Data Table (1 min)**

Go back to dashboard, scroll to table:
- "All data merged and ready"
- "Emails pulled from Customer List"
- "Amounts from Sales Summary"
- "Everything in one place"

---

## 💡 Key Selling Points

### **Problem Solved:**
❌ **Before:** Manually creating 100+ donation letters, copying/pasting data, missing emails
✅ **After:** Upload 2 files, click Generate, done in 60 seconds

### **Benefits:**
1. **Saves Time** - 10+ hours of manual work → 2 minutes
2. **Reduces Errors** - No manual copy/paste mistakes
3. **IRS Compliant** - Proper format with all required fields
4. **Professional** - Custom branding, clean design
5. **Flexible** - Works with QuickBooks exports you already have

### **Technical Highlights:**
- Built with Next.js (modern, fast, scalable)
- Excel file support (.xlsx)
- Print-optimized layout
- Responsive design
- Local data storage (secure)

---

## 🎨 Demo Tips

### **What to Emphasize:**
- Speed and ease of use
- Professional output quality
- Customization options (branding)
- How it solves Brandie's specific pain points from the meeting

### **Expected Questions:**

**Q: "Can it handle more than 15 donors?"**
A: "Absolutely! The architecture supports hundreds or thousands. We used 15 for the demo, but it scales."

**Q: "Can we actually send emails?"**
A: "The email button is mocked for the POC. Phase 2 will integrate with email services like SendGrid or Mailgun for actual sending."

**Q: "What about PDF downloads?"**
A: "Currently it's print-to-PDF, but we can add direct PDF download in Phase 2 with a Download button."

**Q: "Does it work with other platforms besides QuickBooks?"**
A: "Yes! The parser already supports PayPal, Network For Good, and other platforms. We can add more as needed."

**Q: "What's next after Phase 1?"**
A: "Phase 2: Email integration, PDF downloads, support for PayPal/other platforms
Phase 3: QuickBooks API integration, allocation management, batch processing"

---

## 📊 Sample Donors in Demo Files

| Name | Email | Donation |
|------|-------|----------|
| John Smith | john.smith@email.com | $1,250.00 |
| Sarah Johnson | sarah.j@email.com | $500.00 |
| Michael Brown | mbrown@email.com | $2,500.00 |
| Robert Taylor | robert.t@email.com | $5,000.00 |
| Christopher White | cwhite@email.com | $3,200.00 |
| ... and 10 more | | |

**Total: $22,800.00** across 15 donors

---

## 🚀 Starting the Demo

```bash
# Start the development server
npm run dev

# Open in browser
http://localhost:3000
```

**Before the demo:**
1. Clear browser localStorage (fresh start)
2. Have both demo files ready on desktop
3. Have the app running at localhost:3000
4. Test the full flow once

---

## ✅ Success Criteria

By the end of the demo, Brandie should understand:
- ✅ How to upload QuickBooks data
- ✅ How to customize branding
- ✅ How letters are generated
- ✅ What the output looks like
- ✅ Next steps for Phase 2

---

## 🎯 Closing

"This POC demonstrates the core functionality for Phase 1. Based on your feedback, we can:
- Add PDF download
- Integrate real email sending
- Support additional data sources
- Scale to handle your full donor base

What would you like to prioritize for Phase 2?"

---

**Good luck with your demo! 🎊**
