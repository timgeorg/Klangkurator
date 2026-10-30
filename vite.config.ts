import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // KLANGKURATOR_API points the dev server at another backend (e.g. a sandbox copy).
      // The literal IPv4 address, not `localhost`: on hosts that resolve
      // `localhost` to `::1` first, the proxy reached nothing while uvicorn
      // listened on 127.0.0.1 only, and every request answered 500.
      "/api": process.env.KLANGKURATOR_API ?? "http://127.0.0.1:8000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
