import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { IssueAttestation } from '@/pages/IssueAttestation';
import { VerifyAttestation } from '@/pages/VerifyAttestation';
import { RevokeAttestation } from '@/pages/RevokeAttestation';
import { SelectiveDisclosure } from '@/pages/SelectiveDisclosure';
import { AttestationRegistry } from '@/pages/AttestationRegistry';
import { EscrowDemo } from '@/pages/EscrowDemo';
import { restoreWallet } from '@/store/wallet';

export function App() {
  // Best-effort restore of the previously connected wallet.
  useEffect(() => {
    void restoreWallet();
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/issue" element={<IssueAttestation />} />
        <Route path="/verify" element={<VerifyAttestation />} />
        <Route path="/revoke" element={<RevokeAttestation />} />
        <Route path="/disclose" element={<SelectiveDisclosure />} />
        <Route path="/registry" element={<AttestationRegistry />} />
        <Route path="/escrow" element={<EscrowDemo />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}