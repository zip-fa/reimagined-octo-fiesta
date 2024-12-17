import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/ggdrop': {
        target: 'https://ggdrop.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ggdrop/, '/api/cases'),
      },
      '/api/keydrop': {
        target: 'https://key-drop.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/keydrop/, '/en/apiData/Cases'),
      },
    },
  },
})