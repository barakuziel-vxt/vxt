import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api/telemetry': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/api/events/range': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/api/eventlog': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/entitycategories': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/entities': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/customers': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/events': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/subscriptions': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/protocols': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/protocolattributes': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/providers': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/providerevents': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
