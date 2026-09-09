import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TxPanel } from '@/components/TxPanel';
import type { TxResult } from '@/lib/contract';

const sampleResult: TxResult = {
  hash: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
  status: 'SUCCESS',
  ledger: 42_424_242,
  events: [
    {
      contractId: null,
      topics: ['attestation_issued', 1],
      data: { subject: 'G...', claim_type: 'kyc_verified' },
    },
  ],
};

describe('TxPanel', () => {
  it('renders the transaction status, ledger, and hash', () => {
    render(<TxPanel result={sampleResult} contractLabel="Attestation contract" methodLabel="issue_attestation" />);

    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('42424242')).toBeInTheDocument();
    expect(screen.getByText(sampleResult.hash)).toBeInTheDocument();
    expect(screen.getByText('View on explorer ↗')).toHaveAttribute(
      'href',
      expect.stringContaining('stellar.expert'),
    );
  });

  it('renders decoded contract events', () => {
    render(<TxPanel result={sampleResult} contractLabel="c" methodLabel="m" />);
    expect(screen.getByText('attestation_issued')).toBeInTheDocument();
    expect(screen.getByText(/kyc_verified/)).toBeInTheDocument();
  });

  it('shows a friendly note when no events were emitted', () => {
    render(
      <TxPanel
        result={{ ...sampleResult, events: [] }}
        contractLabel="c"
        methodLabel="m"
      />,
    );
    expect(screen.getByText('No contract events emitted.')).toBeInTheDocument();
  });

  it('renders FAILED status', () => {
    render(
      <TxPanel
        result={{ ...sampleResult, status: 'FAILED' }}
        contractLabel="c"
        methodLabel="m"
      />,
    );
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });
});