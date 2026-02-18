import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f1a17",
        parchment: "#f2e8d9",
        stampblue: "#394249",
        accent: "#9f5f36"
      }
    }
  },
  plugins: []
};

export default config;
