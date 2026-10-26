import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 3001}` },
    watch: {
      ignored: [
        "**/.tools/**",
        "**/output/**",
        "**/uploads/**",
        "**/test-results/**",
        "**/.playwright-cli/**",
        "**/backups/**",
      ],
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(
              id,
            )
          )
            return "framework";
          if (id.includes("@radix-ui") || id.includes("tailwind-merge"))
            return "ui";
        },
      },
    },
  },
});
