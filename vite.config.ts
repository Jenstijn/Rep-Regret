//vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // EXACT jouw repo-pad (hoofdletters tellen) voor GitHub Pages:
  base: '/Rep-Regret/',
  // Laat Vite naar 'docs/' bouwen i.p.v. 'dist/'
  build: { outDir: 'docs' }
})