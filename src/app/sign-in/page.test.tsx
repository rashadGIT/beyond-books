import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInPage from './page';
import { useRouter } from 'next/navigation';

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
  });
});

test('renders email and password input fields', () => {
  render(<SignInPage />);
  expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
});

test('renders sign-in submit button', () => {
  render(<SignInPage />);
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});

test('calls router.push on successful login', async () => {
  const mockPush = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush, refresh: jest.fn() });

  render(<SignInPage />);
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'test@example.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
});

test('shows error message when API returns an error', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: jest.fn().mockResolvedValue({ error: 'Invalid credentials' }),
  });

  render(<SignInPage />);
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'wrong@example.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() =>
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  );
});

test('shows link to sign-up page', () => {
  render(<SignInPage />);
  expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
});

test('shows verification step when API indicates unverified email', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue({ error: 'Please verify your email before signing in' }),
  });

  render(<SignInPage />);
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'unverified@example.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /verify & sign in/i })).toBeInTheDocument()
  );
});
