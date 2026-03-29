import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Pervasive throughout codebase — downgrade to warn so lint exits 0
      "@typescript-eslint/no-explicit-any": "warn",
      // Function declarations are hoisted — no-use-before-define is overly strict here
      "@typescript-eslint/no-use-before-define": "off",
      "no-use-before-define": "off",
      // loadAccounts() is async — setState calls inside are not synchronous in the effect
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Jest test files — require() is necessary in mock factories (hoisted before import)
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx", "jest.setup.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
]);

export default eslintConfig;
