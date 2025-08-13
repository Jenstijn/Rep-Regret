//vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Let op: EXACT de repo-naam (hoofdletters en streepje)
  base: '/Rep-Regret/',
})