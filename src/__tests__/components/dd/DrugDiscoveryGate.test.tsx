import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import DrugDiscovery from '@/components/tools/DrugDiscovery';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/tools/drug-discovery',
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('DrugDiscovery — garde de plan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('montre l\'écran d\'upgrade à un STARTER et n\'appelle pas le module', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'STARTER' },
        });
      }
      throw new Error(`appel inattendu : ${url}`);
    });

    render(<DrugDiscovery />, { wrapper });

    await waitFor(() => expect(screen.getByText(/plan TEAM/i)).toBeInTheDocument());
    // La garde évite l'aller-retour à 403 ; le backend reste l'autorité.
    expect(mockedApi.get).not.toHaveBeenCalledWith('/drug-discovery/indications');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
