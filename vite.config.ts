import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@unopsitg/page-assistant-core': path.resolve(__dirname, 'packages/core/src'),
      '@unopsitg/page-assistant-react': path.resolve(__dirname, 'packages/react/src'),
      '@unopsitg/page-assistant-web-component': path.resolve(__dirname, 'packages/web-component/src'),
    },
  },
})
