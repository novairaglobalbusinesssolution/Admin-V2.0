import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // important for electron
  server: {
    proxy: {
      '/api': {
        target: 'https://admin-v2-backend.onrender.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
