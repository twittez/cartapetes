import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/winnerpay-api': {
        target: 'https://api.winnerpayy.com.br/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/winnerpay-api/, '')
      }
    }
  }
})
