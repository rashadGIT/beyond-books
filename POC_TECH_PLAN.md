# Phase 1: Proof of Concept (POC) Technical Plan

## Goal
Build a functional prototype that demonstrates the ability to ingest disparate accounting/donation reports and map them to a standardized format.

## Technology Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn UI (for a polished look)
- **CSV Parsing:** PapaParse
- **Icons:** Lucide React

## Data Mapping Strategy
I will implement a `StandardizedTransaction` interface:
```typescript
interface StandardizedTransaction {
  date: string;
  source: string; // e.g., 'PayPal', 'Communities Foundation', 'Stripe'
  donorName: string;
  donorEmail: string;
  grossAmount: number;
  fee: number;
  netAmount: number;
  description: string;
  originalData: any; // For auditability
}
```

### Supported Mappings (Phase 1)
1. **Communities Foundation (Disbursement):**
   - `Donor First Name` + `Donor Last Name` -> `donorName`
   - `Amount` -> `grossAmount`
   - `Transaction Fee Cost` -> `fee`
   - `Net Amount` -> `netAmount`
2. **PayPal:**
   - `Name` -> `donorName`
   - `Gross` -> `grossAmount`
   - `Fee` -> `fee`
   - `Net` -> `netAmount`
3. **Unified/Stripe:**
   - `Customer Description` -> `donorName`
   - `Amount` -> `grossAmount`
   - `Fee` -> `fee`

## Deliverables
1. **File Dropzone:** Interactive UI to upload CSV samples.
2. **Auto-Detection:** Logic to identify source based on CSV headers.
3. **Mapped Data Table:** A clean view showing the "Normalized" data.
4. **Export Preview:** A glimpse of how this data will look when prepared for QuickBooks (Phase 2 bridge).

## Next Steps
- [ ] Initialize Next.js project.
- [ ] Build parsing and mapping utility.
- [ ] Create UI for upload and visualization.
- [ ] Test with provided `samples/` files.
