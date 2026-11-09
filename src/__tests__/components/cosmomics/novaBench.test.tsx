/**
 * The development bench (/cosmomics-check) draws fixtures, synthetic and injected
 * payloads: whatever it exports must say it is not a study result.
 */
import { render, screen } from '@testing-library/react';
import CosmOmicsCheckPage from '@/app/cosmomics-check/page';
import { benchMarking } from '@/components/cosmomics/novaSynthetic';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import honest from '../../fixtures/cosmomics/honestNova.json';

const mockParams = jest.fn();
jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
  useSearchParams: () => mockParams(),
}));
// The page hands its marking to the view; what the view does with it is the export tests' business.
jest.mock('@/components/cosmomics/CosmOmicsNovaView', () => {
  const View = ({ footer }: { footer?: string }) => <div data-testid="view" data-footer={footer} />;
  View.displayName = 'View';
  return View;
});

afterEach(() => {
  delete window.__COSMOMICS_DATA__;
});

describe('bench marking', () => {
  it('names each source as not being a study result', () => {
    expect(benchMarking('reference fixture')).toBe('Illustrative data · not study results');
    expect(benchMarking('synthetic')).toBe('Synthetic data · not study results');
    expect(benchMarking('injected')).toBe('Injected payload · development bench, not a GenoLens export');
  });

  it('the bench marks the reference fixture, the synthetic source and an injected payload', async () => {
    mockParams.mockReturnValue(new URLSearchParams(''));
    const fixture = render(<CosmOmicsCheckPage />);
    expect(await screen.findByTestId('view')).toHaveAttribute('data-footer', benchMarking('reference fixture'));
    fixture.unmount();

    mockParams.mockReturnValue(new URLSearchParams('perf=1'));
    const synthetic = render(<CosmOmicsCheckPage />);
    expect(await screen.findByTestId('view')).toHaveAttribute('data-footer', benchMarking('synthetic'));
    synthetic.unmount();

    mockParams.mockReturnValue(new URLSearchParams(''));
    window.__COSMOMICS_DATA__ = honest as unknown as CosmOmicsNovaData;
    render(<CosmOmicsCheckPage />);
    expect(await screen.findByTestId('view')).toHaveAttribute('data-footer', benchMarking('injected'));
  });
});
