import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import js from "@eslint/js";

export default [
    {
        ignores: ["dist/**", "node_modules/**"]
    },
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
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
      "vue/script-indent": ["error", 4] // Match existing 4-space indent
    }
  }
];
