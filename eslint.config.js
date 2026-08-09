import convexPlugin from "@convex-dev/eslint-plugin";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      "node_modules/",
      "dist/",
      "convex/_generated/",
      "docs/",
      ".agents/",
      ".cursor/",
      "eslint.config.js",
      "vite.config.ts",
    ],
  },

  ...tseslint.configs.recommended,

  // Type-aware linting so rules like explicit-table-ids can infer table
  // names from Id<"table"> types.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Convex best practice rules for everything in convex/.
  ...convexPlugin.configs.recommended,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
