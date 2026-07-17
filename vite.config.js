import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/myincolab-refont/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    global: 'globalThis',   // ← ajoute cette ligne
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'http://localhost:8080',
        ws: true
      }
    }
  }
})
