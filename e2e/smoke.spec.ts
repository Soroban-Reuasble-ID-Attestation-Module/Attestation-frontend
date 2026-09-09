import { test, expect } from '@playwright/test';

test.describe('attestation frontend shell', () => {
  test('loads the dashboard and shows the wallet prompt', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Identity Dashboard' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connect freighter wallet/i }),
    ).toBeVisible();
  });

  test('navigates between all main sections', async ({ page }) => {
    await page.goto('/');
    const sections = [
      { nav: 'Issue', heading: 'Issue Attestation' },
      { nav: 'Verify', heading: 'Verify Attestation' },
      { nav: 'Revoke', heading: 'Revoke Attestation' },
      { nav: 'Selective Disclosure', heading: 'Selective Disclosure' },
      { nav: 'Registry', heading: 'Attestation Registry' },
      { nav: 'USDC Escrow', heading: 'USDC Escrow Demonstration' },
    ];
    for (const { nav, heading } of sections) {
      await page.getByRole('link', { name: nav, exact: true }).click();
      await expect(
        page.getByRole('heading', { name: heading }),
      ).toBeVisible();
    }
  });

  test('shows the deployment configuration on the escrow page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'USDC Escrow', exact: true }).click();
    await expect(
      page.getByText(/escrow contract itself/i).first(),
    ).toBeVisible();
  });
});