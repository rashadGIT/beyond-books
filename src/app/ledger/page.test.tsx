import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LedgerPage from './page';

jest.mock('@/components/AppNav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}));

beforeEach(() => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/integrations/quickbooks/status') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ connected: true }),
      });
    }
    if (url === '/api/ledger/accounts') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { Id: '1', Name: 'Checking Account', AccountType: 'Asset', CurrentBalance: 5000, Active: true },
        ]),
      });
    }
    return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue({}) });
  });
});

test('renders all five tab navigation buttons', async () => {
  render(<LedgerPage />);
  await waitFor(() => screen.getByRole('button', { name: /chart of accounts/i }));

  expect(screen.getByRole('button', { name: /chart of accounts/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /general ledger/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /trial balance/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ar subledger/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ap subledger/i })).toBeInTheDocument();
});

test('shows loading state while checking QB connection', () => {
  // Delay the QB status fetch so we can observe the loading state
  (global.fetch as jest.Mock).mockImplementation(
    () => new Promise(() => {}) // never resolves
  );
  render(<LedgerPage />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

test('loads and displays account data on Chart of Accounts tab', async () => {
  render(<LedgerPage />);
  await waitFor(() =>
    expect(screen.getByText('Checking Account')).toBeInTheDocument()
  );
});

test('General Ledger tab shows date filter inputs when clicked', async () => {
  const user = userEvent.setup();
  render(<LedgerPage />);

  await waitFor(() => screen.getByRole('button', { name: /general ledger/i }));
  await user.click(screen.getByRole('button', { name: /general ledger/i }));

  // After switching tabs, two date inputs should be present for the GL range
  const dateInputs = screen.getAllByDisplayValue(/.*/);
  // At minimum two inputs exist for start/end date (they have default values)
  expect(dateInputs.length).toBeGreaterThanOrEqual(2);
});

test('search input renders on Chart of Accounts tab', async () => {
  render(<LedgerPage />);
  await waitFor(() => screen.getByPlaceholderText(/search/i));
  expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
});
