import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// VS Code 등 Electron 기반 호스트가 이 값을 상속시키면 Electron이 순수 Node로 실행되어 앱이 뜨지 않는다.
delete process.env.ELECTRON_RUN_AS_NODE

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { output: { format: 'cjs' } } } },
  renderer: { plugins: [react()] }
})
