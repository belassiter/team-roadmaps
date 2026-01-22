import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["dist/**", "node_modules/**"]
    },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // Override or add specific rules here
      "vue/multi-word-component-names": "off", // Common in small projects
      "no-unused-vars": "warn",
      "vue/html-indent": ["error", 4], // Match existing 4-space indent
      "vue/script-indent": ["error", 4], // Match existing 4-space indent
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
