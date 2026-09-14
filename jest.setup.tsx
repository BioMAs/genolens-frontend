import '@testing-library/jest-dom';

// Mock next/navigation — common in App Router components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/link to render a plain <a> in tests
jest.mock('next/link', () => {
  const Link = ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  Link.displayName = 'Link';
  return Link;
});

/**
 * jsdom n'implemente pas `matchMedia`. `ThemeProvider` s'en sert pour lire la
 * preference systeme quand rien n'est stocke, donc tout test qui monte un
 * arbre theme tombait ici. Le defaut est `light` : c'est ce que rend le
 * serveur, et un test ne doit pas dependre du reglage de la machine.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Silence known noisy console.error from React Testing Library
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('act('))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
