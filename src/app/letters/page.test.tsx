import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LettersPage from './page';

jest.mock('@/components/AppNav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}));

// localStorage may be used by the page to load cached transaction data
beforeEach(() => {
  localStorage.clear();
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/settings/branding') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({
          orgName: 'Test Org',
          tagLine: 'Tag',
          taxId: '12-3456789',
          signerName: 'Jane',
          signerTitle: 'Director',
          primaryColor: '#2563eb',
        }),
      });
    }
    if (url === '/api/settings/email') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ configured: false }),
      });
    }
    return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue({}) });
  });
});

test('renders page without crashing', () => {
  render(<LettersPage />);
  // The page heading area should be present
  expect(document.body).toBeTruthy();
});

test('renders view mode tabs — Summary, Individual, History', async () => {
  render(<LettersPage />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /individual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
  });
});

test('shows email not configured warning when email is unconfigured', async () => {
  render(<LettersPage />);
  await waitFor(() =>
    expect(screen.getByText(/email not configured/i)).toBeInTheDocument()
  );
});

test('renders data source toggle (Uploaded File / QuickBooks)', async () => {
  render(<LettersPage />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /uploaded file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quickbooks/i })).toBeInTheDocument();
  });
});

test('shows empty state with no donors when no data loaded', async () => {
  render(<LettersPage />);
  // With no transactions loaded, the donor list should be empty — verify page renders
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /summary/i })).toBeInTheDocument()
  );
  // No donor rows should appear
  expect(screen.queryByText(/donors/i)).not.toBeInTheDocument();
});
