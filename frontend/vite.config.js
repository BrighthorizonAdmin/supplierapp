import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5001,
    proxy: {
      '/api': {
        target: 'http://34.131.73.5:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://34.131.73.5:3001',
        changeOrigin: true,
      },
      // Proxy dealer-app document files 
      '/dealer-uploads': {
        target: 'http://34.131.73.5:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dealer-uploads/, '/uploads'),
      },
    },
  },
})