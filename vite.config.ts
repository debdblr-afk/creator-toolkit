import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works both on the custom domain (served from /)
// and on the default GitHub Pages project URL (served from /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
