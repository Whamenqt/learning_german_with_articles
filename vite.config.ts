import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // When running `netlify dev`, Netlify proxies :8888 -> this port and
    // rewrites /.netlify/functions/* to the local functions server.
    port: 5173,
  },
})
