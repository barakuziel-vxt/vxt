export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    watch: {
      usePolling: true,
    },
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      clientPort: 3000
    }
  },
  ...
})