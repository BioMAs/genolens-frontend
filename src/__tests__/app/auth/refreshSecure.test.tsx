/**
 * @jest-environment-options {"url": "https://app.example.test/auth/refresh"}
 *
 * The same page served over https: the renewal marker is then `Secure`.
 */
import { render, waitFor } from '@testing-library/react';

import RefreshPage from '@/app/auth/refresh/page';
import { refreshSession } from '@/utils/auth/client';
import { replaceLocation } from '@/utils/auth/navigation';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/utils/auth/client', () => ({ refreshSession: jest.fn() }));
jest.mock('@/utils/auth/navigation', () => ({ replaceLocation: jest.fn(), navigate: jest.fn() }));

it('marks the renewal with a Secure cookie', async () => {
  (refreshSession as jest.Mock).mockResolvedValue(true);
  const written = jest.spyOn(document, 'cookie', 'set');

  render(<RefreshPage />);

  await waitFor(() => expect(replaceLocation).toHaveBeenCalled());
  expect(written).toHaveBeenCalledWith('gl_renewed=1; Path=/; Max-Age=30; SameSite=Lax; Secure');
  written.mockRestore();
  document.cookie = 'gl_renewed=; Path=/; Max-Age=0; Secure';
});
