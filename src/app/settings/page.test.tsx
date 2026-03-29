import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from './page';

jest.mock('@/components/AppNav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}));

beforeEach(() => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/integrations/quickbooks/status') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ connected: false }),
      });
    }
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
    if (url === '/api/settings/sync-schedule') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ autoSyncEnabled: false, autoSyncCron: null }),
      });
    }
    if (url === '/api/settings/ai') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
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

test('renders Settings page heading', async () => {
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  );
});

test('renders Connect QuickBooks link when not connected', async () => {
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /connect quickbooks/i })).toBeInTheDocument()
  );
});

test('renders organization name input in Letter Branding form', async () => {
  render(<SettingsPage />);
  // The branding section uses the label "Organization Name" distinct from the email section
  await waitFor(() => {
    const labels = screen.getAllByText('Organization Name');
    expect(labels.length).toBeGreaterThan(0);
  });
});

test('renders Save Branding button', async () => {
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /save branding/i })).toBeInTheDocument()
  );
});

test('renders Email Sending section heading', async () => {
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByText('Email Sending')).toBeInTheDocument()
  );
});

test('renders QuickBooks section heading', async () => {
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByText('QuickBooks')).toBeInTheDocument()
  );
});
