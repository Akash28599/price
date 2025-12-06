import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/barchart': {
        target: 'https://historical-quotes.aws.barchart.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
