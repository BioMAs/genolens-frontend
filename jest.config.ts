import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to the Next.js app to load next.config.js and .env files
  dir: './',
});

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx'],
  // Handle module aliases (matching tsconfig.json paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    // Playwright specs, like e2e/ above — Jest cannot load @playwright/test.
    '<rootDir>/e2e-capture/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/.next/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/app/**', // exclude Next.js app router pages (integration tests)
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

// react-markdown@10 / remark-gfm@4 (DocArticle, Task 3) pull in the whole
// unified/mdast/micromark ecosystem, which ships ESM-only — unlike the rest
// of node_modules, so Jest's default CJS transform chokes on their `export`
// syntax. next/jest only lets custom config *append* to its own
// transformIgnorePatterns (to keep node_modules excluded by default), which
// can't un-ignore a package matched by its own base pattern; the sanctioned
// lever is `transpilePackages` in next.config.ts, off-limits for this repo.
// So the resolved config is intercepted after next/jest builds it and its
// transformIgnorePatterns replaced outright with a list that lets this one
// dependency tree through for transformation.
const withMarkdownEsmSupport = async () => {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: [
      '/node_modules/(?!(react-markdown|remark-.*|rehype-.*|unified|unist-.*|vfile.*|mdast-util-.*|micromark.*|hast-util-.*|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|web-namespaces|zwitch|bail|is-plain-obj|trough|trim-lines|ccount|character-entities.*|character-reference-invalid|decode-named-character-reference|devlop|escape-string-regexp|estree-util-is-identifier-name|is-alphabetical|is-alphanumerical|is-decimal|is-hexadecimal|longest-streak|markdown-table|parse-entities|stringify-entities|style-to-js|style-to-object|inline-style-parser|dequal|@ungap/structured-clone|extend|ms|debug)/)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  };
};

export default withMarkdownEsmSupport;
