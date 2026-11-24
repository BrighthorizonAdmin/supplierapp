import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001'

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5001,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiProxyTarget,
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