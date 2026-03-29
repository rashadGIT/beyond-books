import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowDashboard from './page';

jest.mock('@/components/MarkdownMessage', () => ({
  MarkdownMessage: ({ content }: { content: string }) => <span>{content}</span>,
}));

jest.mock('@/components/AppNav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}));

function makeFetchMock(qbConnected = false) {
  (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
    if (url === '/api/jobs') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ jobs: [], history: [] }),
      });
    }
    if (url === '/api/chat' && (!options || options.method !== 'POST')) {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      });
    }
    if (url === '/api/chat' && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({
          userMessage: { id: '1', role: 'user', content: 'Hello AI', timestamp: new Date().toISOString() },
          assistantMessage: { id: '2', role: 'assistant', content: 'Hello!', timestamp: new Date().toISOString() },
        }),
      });
    }
    if (url === '/api/integrations/quickbooks/status') {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ connected: qbConnected, lastSyncAt: null, error: null }),
      });
    }
    if (url === '/api/settings/ai') {
      return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue([]) });
    }
    if (url === '/api/auth/me') {
      return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue({ name: 'Test User' }) });
    }
    return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue({}) });
  });
}

beforeEach(() => {
  makeFetchMock(false);
});

test('renders without crashing', async () => {
  render(<WorkflowDashboard />);
  await waitFor(() =>
    expect(screen.getByPlaceholderText(/initialize system query/i)).toBeInTheDocument()
  );
});

test('renders message textarea', async () => {
  render(<WorkflowDashboard />);
  await waitFor(() =>
    expect(screen.getByPlaceholderText(/initialize system query/i)).toBeInTheDocument()
  );
});

test('shows QuickBooks not connected prompt when disconnected', async () => {
  render(<WorkflowDashboard />);
  await waitFor(() =>
    expect(screen.getByText('QuickBooks not connected')).toBeInTheDocument()
  );
});

test('shows QB connected indicator when connected', async () => {
  makeFetchMock(true);
  render(<WorkflowDashboard />);
  // When connected the status badge shows "Connected"
  await waitFor(() => {
    const connectedEls = screen.getAllByText('Connected');
    expect(connectedEls.length).toBeGreaterThan(0);
  });
});

test('submitting a message calls POST /api/chat', async () => {
  const user = userEvent.setup();
  render(<WorkflowDashboard />);

  const textarea = await screen.findByPlaceholderText(/initialize system query/i);
  await user.type(textarea, 'Hello AI');

  // Submit via the form (Enter key, since the submit button is icon-only)
  await user.keyboard('{Enter}');

  await waitFor(() => {
    const postCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url, opts]: [string, RequestInit?]) =>
        url === '/api/chat' && opts?.method === 'POST'
    );
    expect(postCalls.length).toBeGreaterThan(0);
  });
});
