import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {}, // This provides a fallback for "process.env"
    'process.browser': true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",   // IMPORTANT (Docker / VM / k8s safe)
    port: 5001,
    hmr: {
      protocol: "ws",
      host: "localhost", // change if accessing via IP / domain
      port: 5001,
    },
  },
})
