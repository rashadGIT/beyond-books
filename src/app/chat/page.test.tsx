import { render, screen, waitFor } from '@testing-library/react';
import ChatRedirect from './page';
import { useRouter } from 'next/navigation';

test('renders redirecting message', () => {
  render(<ChatRedirect />);
  expect(screen.getByText(/redirecting to dashboard/i)).toBeInTheDocument();
});

test('calls router.replace with "/" on mount', async () => {
  const mockReplace = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: jest.fn() });

  render(<ChatRedirect />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});
