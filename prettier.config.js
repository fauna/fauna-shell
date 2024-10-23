import basePrettierConfig from "@fauna/typescript/config/prettierrc";

/**
 * @type {import("prettier").Config}
 */
const config = {
  ...basePrettierConfig,
  semi: false,
};

export default config;
