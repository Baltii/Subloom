const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  { ignores: ["dist/**", "supabase/**", ".expo/**"] },
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
]);
