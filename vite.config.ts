import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Injects Firebase config env vars into public/firebase-messaging-sw.js.
 * Service workers can't use import.meta.env, so we replace %%VAR%% placeholders
 * with actual values at dev-serve time and at build time.
 */
function firebaseMessagingSWPlugin(env: Record<string, string>): Plugin {
  const templatePath = path.resolve('public/firebase-messaging-sw.js');

  function inject(content: string): string {
    return content.replace(/%%(\w+)%%/g, (_, key) => env[key] ?? '');
  }

  return {
    name: 'firebase-messaging-sw',

    // Dev server: intercept /firebase-messaging-sw.js and serve with injected env
    configureServer(server) {
      server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => {
        const raw = fs.readFileSync(templatePath, 'utf-8');
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-store');
        res.end(inject(raw));
      });
    },

    // Build: write the injected file into dist/ after the bundle is written
    closeBundle() {
      const raw = fs.readFileSync(templatePath, 'utf-8');
      const outDir = path.resolve('dist');
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, 'firebase-messaging-sw.js'), inject(raw));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  server: {
    host: "::",
    port: 8080,
    headers: {
      // Allow Google OAuth popup to communicate back to the opener
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/*.png'],
      manifest: {
        name: 'Malleabite',
        short_name: 'Malleabite',
        description: 'Intelligent Productivity Platform - Master your time with AI-powered scheduling',
        theme_color: '#8b5cf6',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'assets/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        // Exclude large images from precache, they'll be cached at runtime
        globIgnores: ['**/assets/**', 'firebase-messaging-sw.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/assets\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    firebaseMessagingSWPlugin(env),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Production build optimizations
    target: 'esnext',
    minify: 'terser',
    sourcemap: mode === 'development',
    cssCodeSplit: true,
    
    // Rollup options for code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast'
          ],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
            'firebase/storage'
          ],
          'chart-vendor': ['recharts'],
          'date-vendor': ['date-fns', 'dayjs'],
          'animation-vendor': ['framer-motion'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // Terser options for production
    terserOptions: {
      compress: {
        drop_console: false, // Temporarily disabled for debugging
        drop_debugger: true,
        pure_funcs: [], // Temporarily disabled for debugging
      },
      format: {
        comments: false,
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
  
  // Environment variables prefix
  envPrefix: 'VITE_',
  
  // Optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore'
    ],
  },
}; // end config object
}); // end defineConfig
