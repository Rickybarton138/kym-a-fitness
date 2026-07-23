import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Unique dev port (avoids clashing with sibling Vite/Next projects on 5173/3000)
export default defineConfig({
  plugins: [react()],
  server: { port: 5220, strictPort: true },
})
