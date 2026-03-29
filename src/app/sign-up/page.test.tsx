import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignUpPage from './page';
import { useRouter } from 'next/navigation';

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ message: 'Check your email for a verification code.' }),
  });
});

test('renders name, email, and password fields', () => {
  render(<SignUpPage />);
  expect(screen.getByPlaceholderText('Jane Smith')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Min 8 characters')).toBeInTheDocument();
});

test('renders create account button', () => {
  render(<SignUpPage />);
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
});

test('shows verification code step after successful registration', async () => {
  render(<SignUpPage />);

  await userEvent.type(screen.getByPlaceholderText('Jane Smith'), 'Jane Smith');
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'jane@example.com');
  await userEvent.type(screen.getByPlaceholderText('Min 8 characters'), 'Password123!');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument()
  );
});

test('shows error message when API returns registration error', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue({ error: 'Email already in use' }),
  });

  render(<SignUpPage />);
  await userEvent.type(screen.getByPlaceholderText('Jane Smith'), 'Jane Smith');
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'existing@example.com');
  await userEvent.type(screen.getByPlaceholderText('Min 8 characters'), 'Password123!');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() =>
    expect(screen.getByText('Email already in use')).toBeInTheDocument()
  );
});

test('shows link to sign-in page', () => {
  render(<SignUpPage />);
  expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
});

test('verify email step calls router.push on success', async () => {
  const mockPush = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn() });

  // First call: registration succeeds
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ message: 'Check your email.' }),
    })
    // Second call: confirm succeeds
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

  render(<SignUpPage />);

  await userEvent.type(screen.getByPlaceholderText('Jane Smith'), 'Jane Smith');
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'jane@example.com');
  await userEvent.type(screen.getByPlaceholderText('Min 8 characters'), 'Password123!');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));

  // Now on verify step
  await waitFor(() => screen.getByPlaceholderText('123456'));
  await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
  await userEvent.click(screen.getByRole('button', { name: /verify email/i }));

  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith('/sign-in?verified=true')
  );
});
