import type { Config } from "tailwindcss";

// Only Tailwind's base reset is used (src/index.css); the game styles itself.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {},
  plugins: [],
} satisfies Config;
