import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: './.vite-cache',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['ffmpeg-static', 'fluent-ffmpeg'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        camera: 'camera.html',
        settings: 'settings.html',
      },
    },
  },
})
