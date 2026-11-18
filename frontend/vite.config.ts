import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// /api se redirige al backend de NestJS: así frontend y API comparten origen
// y la cookie de sesión (httpOnly, SameSite=strict) funciona sin problemas.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
})
