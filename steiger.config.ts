import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["./src/entities/**", "./src/features/**", "./src/widgets/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    files: ["./src/app/providers/**"],
    rules: { "fsd/segments-by-purpose": "off" },
  },
  {
    files: ["./src/shared/config/test/**"],
    rules: { "fsd/public-api": "off" },
  },
]);
