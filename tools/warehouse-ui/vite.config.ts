import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4322,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4323",
        changeOrigin: false,
      },
    },
  },
  // @ts-ignore
  test: {
    environment: "jsdom",
  },
});
