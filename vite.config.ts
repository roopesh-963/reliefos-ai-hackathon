import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (
              id.includes('@react-three') ||
              id.includes('@dimforge/rapier3d-compat') ||
              id.includes('/three/')
            ) {
              return 'react-three-fiber';
            }

            if (id.includes('/recharts/')) {
              return 'recharts';
            }

            if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) {
              return 'leaflet';
            }

            if (id.includes('/motion/') || id.includes('/framer-motion/')) {
              return 'motion';
            }

            if (id.includes('/lucide-react/')) {
              return 'icons';
            }

            if (id.includes('/react-router/') || id.includes('/react-router-dom/')) {
              return 'router';
            }

            if (id.includes('/socket.io-client/')) {
              return 'socket';
            }

            return undefined;
          },
        },
      },
    },
  };
});
