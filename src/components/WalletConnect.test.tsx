import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletConnect } from '@/components/WalletConnect';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
  getAddress: vi.fn(),
}));

import { isConnected } from '@stellar/freighter-api';

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WalletConnect />
    </QueryClientProvider>,
  );
}

describe('WalletConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isConnected).mockResolvedValue({ isConnected: false });
  });

  it('offers to connect when no wallet is connected', () => {
    renderWithProviders();
    expect(
      screen.getByRole('button', { name: /connect freighter wallet/i }),
    ).toBeInTheDocument();
  });

  it('surfaces a helpful error when Freighter is missing', async () => {
    vi.mocked(isConnected).mockResolvedValue({ isConnected: false });
    renderWithProviders();
    // isConnected resolves to false, so clicking connect surfaces the error.
    const button = screen.getByRole('button', { name: /connect freighter wallet/i });
    button.click();
    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/freighter is not connected/i);
  });
});