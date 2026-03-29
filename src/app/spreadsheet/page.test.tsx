import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpreadsheetPage from './page';

jest.mock('@/components/AppNav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}));

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
  });
});

test('renders page heading', () => {
  render(<SpreadsheetPage />);
  expect(screen.getByRole('heading', { name: 'Spreadsheet Sync' })).toBeInTheDocument();
});

test('renders Export, Templates, and Import tab buttons', () => {
  render(<SpreadsheetPage />);
  expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
});

test('Export tab shows export button by default', () => {
  render(<SpreadsheetPage />);
  expect(
    screen.getByRole('button', { name: /export invoices to xlsx/i })
  ).toBeInTheDocument();
});

test('Import tab shows file upload zone', async () => {
  const user = userEvent.setup();
  render(<SpreadsheetPage />);

  await user.click(screen.getByRole('button', { name: /import/i }));

  await waitFor(() =>
    expect(screen.getByText(/drop your file here or click to browse/i)).toBeInTheDocument()
  );
});

test('Templates tab shows Download Template button', async () => {
  const user = userEvent.setup();
  render(<SpreadsheetPage />);

  await user.click(screen.getByRole('button', { name: /templates/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /download.*template/i })
    ).toBeInTheDocument()
  );
});
