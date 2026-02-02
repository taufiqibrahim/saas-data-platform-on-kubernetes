import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  moduleNameMapper: pathsToModuleNameMapper(Object.fromEntries(Object.entries(compilerOptions.paths || {}).filter(([key]) => !key.startsWith('@prisma/'))), {
    prefix: '<rootDir>/',
  }),
  modulePathIgnorePatterns: ['<rootDir>/build/', '<rootDir>/dist/'],
  setupFilesAfterEnv: [
    // '<rootDir>/tests/jest.setup.ts',
    '<rootDir>/jest.setup.ts',
  ],
  testMatch: [
    // '**/tests/**/*.test.ts',
    '**/src/**/*.test.ts',
    '**/tests/integrations/**/*.test.ts',
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '<rootDir>/build/**/*',
    '<rootDir>/src/index.ts',
    '<rootDir>/src/helpers/bootstrap',
    '<rootDir>/src/config/clients',
    '<rootDir>/src/config/express.ts',
  ],
  collectCoverageFrom: ['src/**/*.{js,ts}', '!**/*.test.{js,ts}'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default config;
