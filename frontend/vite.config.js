import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5001,
    proxy: {
      '/api': {
        target: 'http://34.131.27.112:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://34.131.27.112:3001',
        changeOrigin: true,
      },
      // Proxy dealer-app document files 
      '/dealer-uploads': {
        target: 'http://136.110.133.115:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dealer-uploads/, '/uploads'),
      },
    },
  },
})