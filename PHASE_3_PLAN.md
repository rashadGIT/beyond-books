# Phase 3: QuickBooks API Integration & Advanced Features

**Status:** Planned (Post-Phase 2)
**Timeline:** 4-6 weeks after Phase 2 completion
**Priority:** High

---

## 🎯 Goals

1. Direct QuickBooks API integration (no manual CSV import)
2. Allocation management for nonprofit accounting
3. Automated reconciliation & discrepancy detection
4. Advanced reporting and analytics
5. Batch processing for large donor bases
6. Multi-user support with role-based permissions

---

## 📋 Features

### **1. QuickBooks API Integration**

#### **API Access:**
- Use QuickBooks Online API (OAuth 2.0)
- Intuit Developer Account required
- SDK: `node-quickbooks` or direct REST API

#### **Capabilities:**
- **Read:** Pull customer list, sales data, invoices
- **Write:** Create sales receipts, invoices, customers
- **Sync:** Two-way data synchronization
- **Validate:** Check for duplicates before import

#### **Implementation:**

**OAuth Setup:**
```typescript
// src/lib/quickbooks-auth.ts
import QuickBooks from 'node-quickbooks';

export const initiateOAuth = () => {
  const authUri = qb.authorizeUrl({
    scope: [QuickBooks.scopes.Accounting],
    state: 'testState'
  });
  // Redirect user to authUri
}

export const handleCallback = async (code: string) => {
  const token = await qb.createToken(code);
  // Save token to database (encrypted)
  return token;
}

export const refreshToken = async (refreshToken: string) => {
  const newToken = await qb.refreshAccessToken(refreshToken);
  return newToken;
}
```

**Direct Data Import:**
```typescript
// src/lib/quickbooks-api.ts
export const createSalesReceipt = async (
  transaction: StandardizedTransaction,
  qbClient: QuickBooks
) => {
  const salesReceipt = {
    CustomerRef: { value: await getOrCreateCustomer(transaction.donorName) },
    Line: [
      {
        Amount: transaction.grossAmount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: donationItemId },
          Qty: 1,
          UnitPrice: transaction.grossAmount
        }
      },
      {
        Amount: transaction.fee,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: feeItemId },
          Qty: 1,
          UnitPrice: transaction.fee
        }
      }
    ],
    TxnDate: transaction.date
  };

  return await qbClient.createSalesReceipt(salesReceipt);
}
```

**Customer Management:**
```typescript
export const getOrCreateCustomer = async (
  donorName: string,
  donorEmail: string,
  qbClient: QuickBooks
) => {
  // Search for existing customer
  const existing = await qbClient.findCustomers([
    { field: 'DisplayName', value: donorName }
  ]);

  if (existing.length > 0) {
    return existing[0].Id;
  }

  // Create new customer
  const customer = await qbClient.createCustomer({
    DisplayName: donorName,
    PrimaryEmailAddr: { Address: donorEmail },
    // ... other fields
  });

  return customer.Id;
}
```

**Files to Create:**
- `src/lib/quickbooks-auth.ts` - OAuth flow
- `src/lib/quickbooks-api.ts` - API operations
- `src/lib/quickbooks-sync.ts` - Sync logic
- `src/app/api/qb-connect/route.ts` - OAuth callback
- `src/app/settings/quickbooks/page.tsx` - QB settings UI

**Dependencies:**
```bash
npm install node-quickbooks
npm install @prisma/client  # For token storage
```

---

### **2. Allocation Management**

#### **Problem (from Meeting Notes):**
Nonprofits must allocate expenses across multiple programs/locations:
- Program A: 40%
- Program B: 35%
- Administration: 25%

Same for revenue (donations, grants).

#### **Features:**
- Define allocation rules per customer/project
- Simple equal division or percentage-based
- Multi-level allocations (Program → Location)
- Allocation templates (reusable rules)
- Allocation validation (totals to 100%)

#### **Data Model:**

```typescript
// src/lib/types.ts
export interface AllocationRule {
  id: string;
  name: string;
  type: 'equal' | 'percentage' | 'fixed';
  allocations: Allocation[];
}

export interface Allocation {
  id: string;
  programId: string;
  programName: string;
  locationId?: string;
  locationName?: string;
  percentage?: number;
  fixedAmount?: number;
}

export interface AllocatedTransaction extends StandardizedTransaction {
  allocations: TransactionAllocation[];
}

export interface TransactionAllocation {
  amount: number;
  program: string;
  location?: string;
  percentage: number;
}
```

#### **UI:**

**Allocation Rule Builder:**
```tsx
<AllocationRuleBuilder>
  <RuleName>General Operating Expenses</RuleName>
  <AllocationType>
    <Option>Equal Division</Option>
    <Option selected>Percentage-Based</Option>
    <Option>Fixed Amount</Option>
  </AllocationType>

  <AllocationList>
    <AllocationRow>
      <ProgramSelect>Youth Programs</ProgramSelect>
      <LocationSelect>Dallas Campus</LocationSelect>
      <PercentageInput>40%</PercentageInput>
    </AllocationRow>
    <AllocationRow>
      <ProgramSelect>Community Outreach</ProgramSelect>
      <LocationSelect>All Locations</LocationSelect>
      <PercentageInput>35%</PercentageInput>
    </AllocationRow>
    <AllocationRow>
      <ProgramSelect>Administration</ProgramSelect>
      <LocationSelect>-</LocationSelect>
      <PercentageInput>25%</PercentageInput>
    </AllocationRow>
  </AllocationList>

  <Total>100%</Total>
  <ValidationStatus>✅ Valid</ValidationStatus>
</AllocationRuleBuilder>
```

**Apply Allocations:**
```typescript
// src/lib/allocations.ts
export const applyAllocation = (
  transaction: StandardizedTransaction,
  rule: AllocationRule
): AllocatedTransaction => {
  const allocated = rule.allocations.map(alloc => ({
    amount: calculateAmount(transaction.grossAmount, alloc),
    program: alloc.programName,
    location: alloc.locationName,
    percentage: alloc.percentage || 0
  }));

  return {
    ...transaction,
    allocations: allocated
  };
}

const calculateAmount = (total: number, alloc: Allocation) => {
  if (alloc.type === 'percentage') {
    return total * (alloc.percentage! / 100);
  }
  if (alloc.type === 'fixed') {
    return alloc.fixedAmount!;
  }
  // Equal division
  return total / rule.allocations.length;
}
```

**QuickBooks Export with Allocations:**
```typescript
// Each allocation becomes a separate line item in QB
export const generateAllocatedSalesReceipt = (
  transaction: AllocatedTransaction
) => {
  const lines = transaction.allocations.map(alloc => ({
    Amount: alloc.amount,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: { value: alloc.programId },
      ClassRef: { value: alloc.locationId }, // QB Class for location
      Qty: 1,
      UnitPrice: alloc.amount
    },
    Description: `${alloc.program} - ${alloc.location || 'All'}`
  }));

  // Add fee line
  lines.push({ ... fee line ... });

  return { Line: lines, ... };
}
```

**Files to Create:**
- `src/lib/allocations.ts` - Allocation logic
- `src/components/AllocationRuleBuilder.tsx` - Rule builder UI
- `src/components/AllocationPreview.tsx` - Preview allocations
- `src/app/allocations/page.tsx` - Allocation management page

---

### **3. Automated Reconciliation**

#### **Problem (from Meeting Notes):**
Discrepancies between sub-ledger and general ledger can be thousands of dollars.

#### **Features:**
- Compare sub-ledger totals vs general ledger
- Flag discrepancies above threshold
- Transaction-level reconciliation
- Suggested corrections
- Audit trail

#### **Implementation:**

```typescript
// src/lib/reconciliation.ts
export interface ReconciliationReport {
  period: { start: Date; end: Date };
  subLedgerTotal: number;
  generalLedgerTotal: number;
  difference: number;
  discrepancies: Discrepancy[];
  status: 'matched' | 'minor' | 'major';
}

export interface Discrepancy {
  transactionId: string;
  date: string;
  customer: string;
  subLedgerAmount: number;
  generalLedgerAmount: number;
  difference: number;
  suggestion: string;
}

export const reconcile = async (
  startDate: Date,
  endDate: Date,
  qbClient: QuickBooks
): Promise<ReconciliationReport> => {
  // Pull sub-ledger data
  const subLedger = await getSubLedgerData(startDate, endDate, qbClient);

  // Pull general ledger data
  const generalLedger = await getGeneralLedgerData(startDate, endDate, qbClient);

  // Compare and identify discrepancies
  const discrepancies = findDiscrepancies(subLedger, generalLedger);

  // Calculate totals
  const subTotal = sum(subLedger.map(t => t.amount));
  const glTotal = sum(generalLedger.map(t => t.amount));

  return {
    period: { start: startDate, end: endDate },
    subLedgerTotal: subTotal,
    generalLedgerTotal: glTotal,
    difference: Math.abs(subTotal - glTotal),
    discrepancies,
    status: categorizeStatus(Math.abs(subTotal - glTotal))
  };
}

const findDiscrepancies = (subLedger: any[], generalLedger: any[]) => {
  const discrepancies: Discrepancy[] = [];

  subLedger.forEach(slTx => {
    const glTx = generalLedger.find(gl => gl.id === slTx.id);

    if (!glTx) {
      discrepancies.push({
        transactionId: slTx.id,
        date: slTx.date,
        customer: slTx.customer,
        subLedgerAmount: slTx.amount,
        generalLedgerAmount: 0,
        difference: slTx.amount,
        suggestion: 'Transaction missing from general ledger'
      });
    } else if (Math.abs(slTx.amount - glTx.amount) > 0.01) {
      discrepancies.push({
        transactionId: slTx.id,
        date: slTx.date,
        customer: slTx.customer,
        subLedgerAmount: slTx.amount,
        generalLedgerAmount: glTx.amount,
        difference: slTx.amount - glTx.amount,
        suggestion: 'Amount mismatch - review transaction'
      });
    }
  });

  return discrepancies;
}
```

**UI:**
```tsx
<ReconciliationDashboard>
  <PeriodSelector>
    <DateRange>Jan 1, 2026 - Dec 31, 2026</DateRange>
  </PeriodSelector>

  <ReconciliationSummary>
    <Metric>
      <Label>Sub-Ledger Total</Label>
      <Value>$152,847.92</Value>
    </Metric>
    <Metric>
      <Label>General Ledger Total</Label>
      <Value>$149,523.18</Value>
    </Metric>
    <Metric alert="high">
      <Label>Difference</Label>
      <Value>$3,324.74</Value>
    </Metric>
    <Status alert="high">⚠️ Major Discrepancy</Status>
  </ReconciliationSummary>

  <DiscrepancyList>
    <Discrepancy>
      <Date>Mar 15, 2026</Date>
      <Customer>John Smith</Customer>
      <SubLedger>$500.00</SubLedger>
      <GeneralLedger>$0.00</GeneralLedger>
      <Difference>$500.00</Difference>
      <Suggestion>Transaction missing from GL</Suggestion>
      <Action>Fix</Action>
    </Discrepancy>
    {/* ... more discrepancies */}
  </DiscrepancyList>
</ReconciliationDashboard>
```

**Files to Create:**
- `src/lib/reconciliation.ts` - Reconciliation logic
- `src/components/ReconciliationDashboard.tsx` - UI
- `src/app/reconciliation/page.tsx` - Page

---

### **4. Advanced Reporting & Analytics**

#### **Reports:**
1. **Donation Trends**
   - Monthly/yearly donation totals
   - Top donors
   - Donation frequency
   - Average donation amount
   - Growth rate

2. **Revenue by Program**
   - Allocation breakdown
   - Program performance
   - Funding gaps

3. **Fee Analysis**
   - Platform fees by source
   - Total fees vs net revenue
   - Cost per transaction

4. **Donor Retention**
   - First-time vs repeat donors
   - Retention rate
   - Lapsed donors (need re-engagement)

#### **Implementation:**

```typescript
// src/lib/analytics.ts
export const generateDonationTrends = (
  transactions: StandardizedTransaction[],
  period: 'monthly' | 'yearly'
) => {
  const grouped = groupBy(transactions, tx => formatDate(tx.date, period));

  return Object.entries(grouped).map(([period, txs]) => ({
    period,
    count: txs.length,
    total: sum(txs.map(t => t.grossAmount)),
    average: average(txs.map(t => t.grossAmount)),
    fees: sum(txs.map(t => t.fee))
  }));
}

export const getTopDonors = (
  transactions: StandardizedTransaction[],
  limit: number = 10
) => {
  const byDonor = groupBy(transactions, tx => tx.donorEmail);

  return Object.entries(byDonor)
    .map(([email, txs]) => ({
      name: txs[0].donorName,
      email,
      count: txs.length,
      total: sum(txs.map(t => t.grossAmount)),
      firstDonation: min(txs.map(t => new Date(t.date))),
      lastDonation: max(txs.map(t => new Date(t.date)))
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export const calculateRetention = (
  transactions: StandardizedTransaction[]
) => {
  const byYear = groupBy(transactions, tx => new Date(tx.date).getFullYear());

  const retention = Object.keys(byYear).map(year => {
    const currentYear = byYear[year];
    const nextYear = byYear[String(+year + 1)];

    if (!nextYear) return null;

    const currentEmails = new Set(currentYear.map(t => t.donorEmail));
    const nextEmails = new Set(nextYear.map(t => t.donorEmail));

    const retained = [...currentEmails].filter(e => nextEmails.has(e)).length;
    const retentionRate = (retained / currentEmails.size) * 100;

    return {
      year,
      totalDonors: currentEmails.size,
      retainedDonors: retained,
      retentionRate
    };
  }).filter(Boolean);

  return retention;
}
```

**Visualization:**
```tsx
// Use Chart.js or Recharts
import { LineChart, BarChart, PieChart } from 'recharts';

<DonationTrendsChart>
  <LineChart data={trends}>
    <Line dataKey="total" stroke="#2563eb" />
    <XAxis dataKey="period" />
    <YAxis />
  </LineChart>
</DonationTrendsChart>
```

**Files to Create:**
- `src/lib/analytics.ts` - Analytics calculations
- `src/components/charts/` - Chart components
- `src/app/analytics/page.tsx` - Analytics dashboard

**Dependencies:**
```bash
npm install recharts
# OR
npm install chart.js react-chartjs-2
```

---

### **5. Batch Processing**

#### **Features:**
- Process 1000+ transactions at once
- Progress tracking
- Error handling (partial success)
- Retry failed transactions
- Background processing (queue)

#### **Implementation:**

```typescript
// src/lib/batch-processor.ts
export const processBatch = async (
  transactions: StandardizedTransaction[],
  operation: 'import' | 'email' | 'export',
  onProgress: (progress: BatchProgress) => void
) => {
  const batchSize = 50; // Process 50 at a time
  const batches = chunk(transactions, batchSize);

  const results: BatchResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const batchResults = await Promise.allSettled(
        batch.map(tx => processSingle(tx, operation))
      );

      results.push(...batchResults.map((r, idx) => ({
        transaction: batch[idx],
        success: r.status === 'fulfilled',
        error: r.status === 'rejected' ? r.reason : null
      })));

      onProgress({
        current: (i + 1) * batchSize,
        total: transactions.length,
        percentage: ((i + 1) / batches.length) * 100,
        successes: results.filter(r => r.success).length,
        failures: results.filter(r => !r.success).length
      });

      // Rate limiting
      await sleep(1000); // Wait 1s between batches
    } catch (error) {
      console.error(`Batch ${i} failed:`, error);
    }
  }

  return results;
}
```

**UI with Progress:**
```tsx
<BatchProcessor>
  <ProgressBar value={progress.percentage} />
  <Stats>
    <Stat>
      <Label>Processed</Label>
      <Value>{progress.current} / {progress.total}</Value>
    </Stat>
    <Stat success>
      <Label>Successes</Label>
      <Value>{progress.successes}</Value>
    </Stat>
    <Stat error>
      <Label>Failures</Label>
      <Value>{progress.failures}</Value>
    </Stat>
  </Stats>

  <ErrorList>
    {failures.map(fail => (
      <ErrorItem key={fail.transaction.id}>
        <Customer>{fail.transaction.donorName}</Customer>
        <Error>{fail.error.message}</Error>
        <Action>Retry</Action>
      </ErrorItem>
    ))}
  </ErrorList>
</BatchProcessor>
```

---

### **6. Multi-User Support & Permissions**

#### **Roles:**
- **Admin** - Full access
- **Manager** - Read/write, no QB connection
- **Staff** - Read-only, can send letters
- **Auditor** - Read-only, access to reconciliation

#### **Implementation:**

**Database (Prisma):**
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id])
  createdAt DateTime @default(now())
}

enum Role {
  ADMIN
  MANAGER
  STAFF
  AUDITOR
}

model Organization {
  id              String   @id @default(cuid())
  name            String
  taxId           String
  qbAccessToken   String?  @encrypted
  qbRefreshToken  String?  @encrypted
  users           User[]
  branding        Json
}
```

**Middleware:**
```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.redirect('/login');
  }

  // Check permissions
  const path = request.nextUrl.pathname;
  const requiredRole = getRequiredRole(path);

  if (!hasPermission(session.user.role, requiredRole)) {
    return NextResponse.redirect('/unauthorized');
  }

  return NextResponse.next();
}
```

**Files to Create:**
- `prisma/schema.prisma` - Database schema
- `src/lib/auth.ts` - Authentication logic
- `src/lib/permissions.ts` - Permission checks
- `src/app/admin/users/page.tsx` - User management

**Dependencies:**
```bash
npm install @prisma/client
npm install next-auth
```

---

## 🏗️ Technical Architecture

### **Database (PostgreSQL via Prisma):**
```
Organizations
├── Users
├── Branding Config
├── QB Tokens (encrypted)
└── Allocation Rules

Transactions
├── Original Data
├── Allocations
└── Reconciliation Status

Audit Log
└── All actions tracked
```

### **Background Jobs (Optional):**
```bash
npm install bull  # Redis-based queue
```

```typescript
// src/jobs/sync-qb.ts
import Queue from 'bull';

const syncQueue = new Queue('qb-sync');

syncQueue.process(async (job) => {
  const { orgId, startDate, endDate } = job.data;
  await syncQuickBooksData(orgId, startDate, endDate);
});

// Schedule daily sync
syncQueue.add({}, { repeat: { cron: '0 2 * * *' } }); // 2am daily
```

---

## 📦 Full Dependency List

```json
{
  "dependencies": {
    "node-quickbooks": "^2.0.0",
    "@prisma/client": "^5.0.0",
    "next-auth": "^4.24.0",
    "recharts": "^2.10.0",
    "bull": "^4.12.0",
    "fuse.js": "^7.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0"
  }
}
```

---

## 🔐 Security Considerations

1. **QB Tokens:** Encrypt at rest, never log
2. **API Rate Limits:** Respect QB API limits (500 calls/min)
3. **Data Privacy:** HIPAA/PCI compliance if needed
4. **Audit Trail:** Log all QB writes
5. **Role-Based Access:** Strict permission checks
6. **Input Validation:** Sanitize all user inputs

---

## 📊 Success Metrics

- [ ] QB API connection success rate >99%
- [ ] Allocation accuracy 100%
- [ ] Reconciliation accuracy >99%
- [ ] Batch processing: 100+ tx/minute
- [ ] Multi-user concurrent access: 10+ users
- [ ] Zero data loss

---

## 💰 Cost Estimate

### **Development Time:**
- QB API integration: 2 weeks
- Allocation management: 1.5 weeks
- Reconciliation: 1 week
- Analytics: 1 week
- Batch processing: 3 days
- Multi-user: 1 week
- Testing: 1 week

**Total: 6-8 weeks**

### **Recurring Costs:**
- Database (Supabase/PlanetScale): $25/month
- QB API: Free (basic tier)
- Redis (for queues): $10/month
- Total: ~$35/month

---

## 📝 Migration from Phase 2

- Export all localStorage data to database
- Import branding configs
- Create default organization
- Migrate users (email invites)

---

**Previous Phase:** [Phase 2: Multi-Platform Import & Email](./PHASE_2_PLAN.md)
