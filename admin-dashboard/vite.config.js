import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Required for Android WebView + file:// loading:
    // Vite injects type="module" and crossorigin on scripts — both break file://
    // loading. We strip them and add defer so the script runs after DOM is ready
    // (type="module" defers automatically; plain scripts don't).
    {
      name: 'android-webview-compat',
      apply: 'build',
      transformIndexHtml(html) {
        return html
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/<script type="module"/g, '<script defer')
          .replace(/ crossorigin/g, '');
      },
    },
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'VXTApp',
        inlineDynamicImports: true,
      },
    },
  },
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
