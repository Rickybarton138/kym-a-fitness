import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// One id per build, shared by the compiled-in constant and the emitted
// version.json so a running client can tell whether it has fallen behind a
// deploy (see src/UpdatePrompt.jsx for why that matters for installed PWAs).
const BUILD_ID = Date.now().toString(36)

function buildVersion() {
  return {
    name: 'build-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
    },
  }
}

// Unique dev port (avoids clashing with sibling Vite/Next projects on 5173/3000)
export default defineConfig({
  plugins: [react(), buildVersion()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { port: 5220, strictPort: true },
})
