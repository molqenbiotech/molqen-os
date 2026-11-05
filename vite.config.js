import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/molqen-os/',
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase'
          }
          if (id.includes('node_modules/chart.js/') || id.includes('node_modules/react-chartjs-2/')) {
            return 'vendor-charts'
          }
          if (id.includes('node_modules/katex/') || id.includes('node_modules/remark-') || id.includes('node_modules/rehype-') || id.includes('node_modules/react-markdown/')) {
            return 'vendor-markdown-math'
          }
          if (id.includes('node_modules/docx/') || id.includes('node_modules/mammoth/') || id.includes('node_modules/xlsx/')) {
            return 'vendor-docs'
          }
        }
      }
    }
  }
})
