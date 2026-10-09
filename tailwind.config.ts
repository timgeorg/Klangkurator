import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import klangkurator from "./design-system/tailwind/preset.js";

export default {
  presets: [klangkurator],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  plugins: [animate],
} satisfies Config;
