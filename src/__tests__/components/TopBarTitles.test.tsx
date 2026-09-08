/**
 * Le titre de page du TopBar est une table de correspondance manuelle :
 * une route ajoutée sans y être déclarée s'affiche « GenoLens ».
 */
import { render, screen } from '@testing-library/react';
import TopBar from '@/components/TopBar';

jest.mock('@/components/GlobalGeneSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="gene-search" />,
}));

jest.mock('@/components/onboarding/HelpTourButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { usePathname } = require('next/navigation');

it('titles the documentation index', () => {
  usePathname.mockReturnValue('/docs');
  render(<TopBar />);
  expect(screen.getByRole('heading', { name: 'Documentation' })).toBeInTheDocument();
});

it('titles a single guide', () => {
  usePathname.mockReturnValue('/docs/gsea');
  render(<TopBar />);
  expect(screen.getByRole('heading', { name: 'Guide' })).toBeInTheDocument();
});

// Les règles `/docs` ont été ajoutées après un bloc de `includes()` : le slug
// d'un guide qui contient un mot-clé d'analyse était capté par la règle
// antérieure, et la page de documentation s'intitulait « Multi-Comparison ».
it('titles a guide whose slug contains an analysis keyword', () => {
  usePathname.mockReturnValue('/docs/multi-comparison');
  render(<TopBar />);
  expect(screen.getByRole('heading', { name: 'Guide' })).toBeInTheDocument();
});

it('still titles the analysis page itself', () => {
  usePathname.mockReturnValue('/projects/p1/multi-comparison');
  render(<TopBar />);
  expect(screen.getByRole('heading', { name: 'Multi-Comparison' })).toBeInTheDocument();
});
