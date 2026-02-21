# AI Assistant Development Roadmap: Nonprofit Accounting Automation

This plan outlines the creation of an AI Assistant designed to eliminate manual data entry for Brandie by bridging payment gateways and QuickBooks.

## 1. Define Scope
**Objective:** A "Human-in-the-loop" AI agent that automates the transition from raw payment gateway exports to QuickBooks Customer Subledger entries.
- **In-Scope:** PayPal, Stripe (Unified), and Communities Foundation CSV processing; QuickBooks Online integration; Donor letter generation.
- **Out-of-Scope:** Tax filing, full bank reconciliation (initially), payroll.

## 2. Specify Functionality
- **Conversational Ingestion:** User uploads a file and tells the assistant: "Process this and prep for QuickBooks."
- **AI-Powered Mapping:** Intelligent detection of donor intent and categorization (e.g., "Is this a restricted donation or general fund?").
- **Subledger Sync:** Automated creation of "Sales Receipts" or "Invoices" in QuickBooks, mapped to the correct Customer ID.
- **Exception Handling:** The AI flags missing data (e.g., "I don't recognize this donor email") and asks for clarification rather than failing.

## 3. Select Model
- **Primary Model:** **Gemini 1.5 Pro** or **GPT-4o**.
- **Reasoning:** These models excel at "Reasoning over Structured Data." They can take a messy CSV row and accurately map it to a QuickBooks Chart of Accounts based on the description text.

## 4. Integrate API
- **QuickBooks Online API:** Use OAuth 2.0 for secure access. Focus on the `/salesreceipt` and `/customer` endpoints.
- **File System API:** Continue using the existing Next.js ingestion engine for local file handling.
- **Communication:** Resend API for the "Send via Email" functionality for letters.

## 5. Test Performance
- **Unit Testing:** Validate the mapping engine against all 15+ sample files in the `samples/` directory.
- **Integration Testing:** Use a QuickBooks Sandbox environment to verify that no duplicate customers are created and amounts match to the penny.
- **User Acceptance (UAT):** Have Brandie review the "Preview" screen before any live sync to QB.

## 6. Deploy Solution
- **Frontend/Backend:** Vercel (Next.js).
- **Security:** Implement Auth0 or NextAuth for secure login (Brandie only).
- **Environment:** Production AWS/RDS for data persistence.

---

## Immediate Next Task (The "Brain" of the Assistant)
Build a `lib/assistant.ts` utility that uses an LLM to take the `StandardizedTransaction` data and decide which QuickBooks category it belongs to.
