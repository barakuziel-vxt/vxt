import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: '0.0.0.0',
    proxy: {
      '/api/telemetry': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/events/range': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/eventlog': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/entitycategories': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/entities': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/customers': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/events': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/subscriptions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/customersubscriptions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/protocols': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/providers': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/providerevents': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
