module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  rules: {
    // Disable most rules for test files since Vitest handles module resolution
    "no-unused-vars": "warn",
    "no-undef": "off"
  },
  globals: {
    vi: "readonly",
    describe: "readonly",
    it: "readonly",
    expect: "readonly",
    beforeEach: "readonly",
    afterEach: "readonly",
    global: "readonly",
    module: "readonly",
    exports: "readonly",
    require: "readonly"
  }
};
