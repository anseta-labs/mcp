import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Config files sit outside the tsconfig projects, so they are not type-checked.
  { ignores: ["dist/**", "node_modules/**", "eslint.config.js", "vitest.config.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { "@stylistic": stylistic },
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // There is no formatter in this repo, so the few style rules that matter
      // are enforced here rather than left to convention. A guard clause is
      // easier to miss when its body shares the line with the condition, so
      // every branch gets braces and its own line.
      curly: ["error", "all"],

      // A multi-line statement is a block of thought; the next one starts after
      // a blank line. This is the "don't condense code too much" rule from
      // CLAUDE.md, made mechanical for the cases a linter can see.
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "multiline-const", next: "*" },
        { blankLine: "always", prev: "multiline-let", next: "*" },
        { blankLine: "always", prev: "multiline-expression", next: "*" },
        { blankLine: "always", prev: "multiline-block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
      ],

      // The point of this config: keep the type system honest. `any` and type
      // assertions are how the previous version of this code lied about shapes
      // it had not actually checked.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
    },
  },
  {
    // Tests construct deliberately partial upstream payloads and stub SDK
    // methods by name, which needs assertions the source does not.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      // Stubs stand in for async SDK methods, so they are async without awaiting.
      "@typescript-eslint/require-await": "off",
    },
  },
);
