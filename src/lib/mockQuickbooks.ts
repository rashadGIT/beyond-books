export interface QBCustomer {
  id: string;
  name: string;
  email: string;
  subledgerBalance: number;
}

export interface QBResponse<T> {
  data: T;
  latency: string;
  timestamp: string;
}

// Simulated QuickBooks Database
const MOCK_CUSTOMERS: QBCustomer[] = [
  { id: '552', name: 'Alice Smith', email: 'alice.smith@example.com', subledgerBalance: 1250.00 },
  { id: '881', name: 'Bob Johnson', email: 'bob.j@provider.net', subledgerBalance: 400.00 },
  { id: '102', name: 'Charlie Brown', email: 'charles.b@webmail.com', subledgerBalance: 3200.50 },
  { id: '992', name: 'Diana Prince', email: 'diana@themyscira.io', subledgerBalance: 10.25 },
];

/**
 * Mock Service to mimic QuickBooks Online API behavior
 * Includes artificial delays to simulate real-world API latency
 */
export const MockQuickBooksService = {
  // Mimic fetching the customer list for identity matching
  getCustomers: async (): Promise<QBResponse<QBCustomer[]>> => {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulated network latency
    return {
      data: MOCK_CUSTOMERS,
      latency: `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    };
  },

  // Mimic creating a sales receipt in the subledger
  createSalesReceipt: async (customerId: string, amount: number): Promise<QBResponse<{ success: boolean; refNo: string }>> => {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Heavy API operation simulation
    return {
      data: { success: true, refNo: `SR-${Math.floor(Math.random() * 10000)}` },
      latency: `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    };
  },

  // Mimic identity resolution using LLM reasoning (Simulated)
  resolveIdentity: async (gatewayName: string, gatewayEmail: string): Promise<QBResponse<{ match: QBCustomer | null; confidence: number }>> => {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const match = MOCK_CUSTOMERS.find(c => 
      c.email.toLowerCase() === gatewayEmail.toLowerCase() || 
      c.name.toLowerCase().includes(gatewayName.toLowerCase())
    );

    return {
      data: { 
        match: match || null, 
        confidence: match ? 0.98 : 0.12 
      },
      latency: `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    };
  }
};
