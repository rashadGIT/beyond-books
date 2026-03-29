import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from './page';
import { useRouter } from 'next/navigation';

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ message: 'Reset code sent to your email.' }),
  });
});

test('renders email address input', () => {
  render(<ForgotPasswordPage />);
  expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
});

test('renders send reset code button', () => {
  render(<ForgotPasswordPage />);
  expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument();
});

test('advances to reset step after successful email submission', async () => {
  render(<ForgotPasswordPage />);

  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  );
  expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
});

test('shows error message when API returns an error', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue({ error: 'User not found' }),
  });

  render(<ForgotPasswordPage />);
  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'nobody@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() =>
    expect(screen.getByText('User not found')).toBeInTheDocument()
  );
});

test('shows link to sign-in page', () => {
  render(<ForgotPasswordPage />);
  expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
});

test('redirects to sign-in after successful password reset', async () => {
  const mockPush = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn() });

  // First fetch: send code
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ message: 'Code sent.' }),
    })
    // Second fetch: reset password
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

  render(<ForgotPasswordPage />);

  await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  await waitFor(() => screen.getByPlaceholderText('123456'));

  await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
  await userEvent.type(
    screen.getByPlaceholderText('Min 8 chars, upper, lower, number'),
    'NewPassword1!'
  );
  await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith('/sign-in?reset=true')
  );
});
