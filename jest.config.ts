import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const sharedModuleNameMapper = {
  // Specific overrides must come BEFORE the catch-all @/ alias
  '^@/lib/prisma$': '<rootDir>/__mocks__/prisma.ts',
  // Resolve any relative import of __mocks__/prisma regardless of nesting depth
  '.*[/\\\\]__mocks__[/\\\\]prisma$': '<rootDir>/__mocks__/prisma.ts',
  '^@/(.*)$': '<rootDir>/src/$1',
  '\\.css$': 'identity-obj-proxy',
  '\\.(jpg|jpeg|png|gif|svg|ico|webp)$': '<rootDir>/__mocks__/fileMock.ts',
};

// Base config passed through next/jest for component tests
const baseConfig: Config = {
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
    // API route contract tests are handled by a separate project below
    '/src/app/api/.*/__tests__/',
  ],
  moduleNameMapper: sharedModuleNameMapper,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types.ts',
    '!src/lib/mock*.ts',
    '!src/lib/prisma.ts',
    '!src/app/layout.tsx',
  ],
  coverageThreshold: {
    global: { branches: 85, functions: 90, lines: 90, statements: 90 },
  },
  testTimeout: 10000,
};

// API route contract test project — uses node environment directly (no next/jest wrapper)
const apiProjectConfig = {
  displayName: 'api',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/app/api/**/__tests__/route.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleNameMapper: sharedModuleNameMapper,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  testTimeout: 10000,
};

// next/jest wraps the base config for component tests
const nextConfig = createJestConfig(baseConfig);

// Export a merged config that adds the API project alongside the next/jest config
// We use an async function so next/jest can resolve its async config
module.exports = async () => {
  const resolvedNextConfig = typeof nextConfig === 'function'
    ? await nextConfig()
    : nextConfig;

  return {
    ...resolvedNextConfig,
    projects: [
      // UI / component tests — use the resolved next/jest config
      {
        displayName: 'jsdom',
        ...resolvedNextConfig,
        testEnvironment: 'jest-environment-jsdom',
        testPathIgnorePatterns: [
          '/node_modules/',
          '/.next/',
          '/e2e/',
          '/src/app/api/.*/__tests__/',
        ],
      },
      // API route contract tests — pure node, no next/jest wrapping
      apiProjectConfig,
    ],
    collectCoverageFrom: baseConfig.collectCoverageFrom,
    coverageThreshold: baseConfig.coverageThreshold,
  };
};
