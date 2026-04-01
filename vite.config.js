import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const yahooProxy = {
  '/yahoo': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/yahoo/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
  '/yahoo2': {
    target: 'https://query2.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/yahoo2/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: yahooProxy,
  },
  preview: {
    proxy: yahooProxy,
  },
})
