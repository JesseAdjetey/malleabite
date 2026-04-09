// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/anagb/malleabite/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/anagb/malleabite/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import fs from "fs";
import { VitePWA } from "file:///C:/Users/anagb/malleabite/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\anagb\\malleabite";
function firebaseMessagingSWPlugin(env) {
  const templatePath = path.resolve("public/firebase-messaging-sw.js");
  function inject(content) {
    return content.replace(/%%(\w+)%%/g, (_, key) => env[key] ?? "");
  }
  return {
    name: "firebase-messaging-sw",
    // Dev server: intercept /firebase-messaging-sw.js and serve with injected env
    configureServer(server) {
      server.middlewares.use("/firebase-messaging-sw.js", (_req, res) => {
        const raw = fs.readFileSync(templatePath, "utf-8");
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(inject(raw));
      });
    },
    // Build: write the injected file into dist/ after the bundle is written
    closeBundle() {
      const raw = fs.readFileSync(templatePath, "utf-8");
      const outDir = path.resolve("dist");
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, "firebase-messaging-sw.js"), inject(raw));
      }
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
      headers: {
        // Allow Google OAuth popup to communicate back to the opener
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["assets/*.png"],
        manifest: {
          name: "Malleabite",
          short_name: "Malleabite",
          description: "Intelligent Productivity Platform - Master your time with AI-powered scheduling",
          theme_color: "#8b5cf6",
          background_color: "#0a0a0a",
          display: "standalone",
          icons: [
            {
              src: "assets/logo.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "assets/logo.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
          // Exclude large images from precache, they'll be cached at runtime
          globIgnores: ["**/assets/**", "firebase-messaging-sw.js"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // 5MB limit
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                  // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\/assets\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "image-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                  // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      }),
      firebaseMessagingSWPlugin(env)
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    build: {
      // Production build optimizations
      target: "esnext",
      minify: "terser",
      sourcemap: mode === "development",
      cssCodeSplit: true,
      // Rollup options for code splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for better caching
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "ui-vendor": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast"
            ],
            "firebase-vendor": [
              "firebase/app",
              "firebase/auth",
              "firebase/firestore",
              "firebase/functions",
              "firebase/storage",
              "firebase/messaging"
            ],
            "chart-vendor": ["recharts"],
            "date-vendor": ["date-fns", "dayjs"],
            "animation-vendor": ["framer-motion"],
            "capacitor-vendor": [
              "@capacitor/core",
              "@capacitor/app",
              "@capacitor/haptics",
              "@capacitor/keyboard",
              "@capacitor/local-notifications",
              "@capacitor/network",
              "@capacitor/splash-screen",
              "@capacitor/status-bar"
            ]
          },
          // Optimize chunk file names
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash].[ext]"
        }
      },
      // Terser options for production
      terserOptions: {
        compress: {
          drop_console: mode === "production",
          drop_debugger: true,
          pure_funcs: mode === "production" ? ["console.log", "console.debug", "console.info"] : []
        },
        format: {
          comments: false
        }
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1e3
    },
    // Environment variables prefix
    envPrefix: "VITE_",
    // Optimizations
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore"
      ]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbmFnYlxcXFxtYWxsZWFiaXRlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbmFnYlxcXFxtYWxsZWFiaXRlXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbmFnYi9tYWxsZWFiaXRlL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52LCB0eXBlIFBsdWdpbiB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XHJcblxyXG4vKipcclxuICogSW5qZWN0cyBGaXJlYmFzZSBjb25maWcgZW52IHZhcnMgaW50byBwdWJsaWMvZmlyZWJhc2UtbWVzc2FnaW5nLXN3LmpzLlxyXG4gKiBTZXJ2aWNlIHdvcmtlcnMgY2FuJ3QgdXNlIGltcG9ydC5tZXRhLmVudiwgc28gd2UgcmVwbGFjZSAlJVZBUiUlIHBsYWNlaG9sZGVyc1xyXG4gKiB3aXRoIGFjdHVhbCB2YWx1ZXMgYXQgZGV2LXNlcnZlIHRpbWUgYW5kIGF0IGJ1aWxkIHRpbWUuXHJcbiAqL1xyXG5mdW5jdGlvbiBmaXJlYmFzZU1lc3NhZ2luZ1NXUGx1Z2luKGVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IFBsdWdpbiB7XHJcbiAgY29uc3QgdGVtcGxhdGVQYXRoID0gcGF0aC5yZXNvbHZlKCdwdWJsaWMvZmlyZWJhc2UtbWVzc2FnaW5nLXN3LmpzJyk7XHJcblxyXG4gIGZ1bmN0aW9uIGluamVjdChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZSgvJSUoXFx3KyklJS9nLCAoXywga2V5KSA9PiBlbnZba2V5XSA/PyAnJyk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ2ZpcmViYXNlLW1lc3NhZ2luZy1zdycsXHJcblxyXG4gICAgLy8gRGV2IHNlcnZlcjogaW50ZXJjZXB0IC9maXJlYmFzZS1tZXNzYWdpbmctc3cuanMgYW5kIHNlcnZlIHdpdGggaW5qZWN0ZWQgZW52XHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoJy9maXJlYmFzZS1tZXNzYWdpbmctc3cuanMnLCAoX3JlcSwgcmVzKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKHRlbXBsYXRlUGF0aCwgJ3V0Zi04Jyk7XHJcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnKTtcclxuICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLXN0b3JlJyk7XHJcbiAgICAgICAgcmVzLmVuZChpbmplY3QocmF3KSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvLyBCdWlsZDogd3JpdGUgdGhlIGluamVjdGVkIGZpbGUgaW50byBkaXN0LyBhZnRlciB0aGUgYnVuZGxlIGlzIHdyaXR0ZW5cclxuICAgIGNsb3NlQnVuZGxlKCkge1xyXG4gICAgICBjb25zdCByYXcgPSBmcy5yZWFkRmlsZVN5bmModGVtcGxhdGVQYXRoLCAndXRmLTgnKTtcclxuICAgICAgY29uc3Qgb3V0RGlyID0gcGF0aC5yZXNvbHZlKCdkaXN0Jyk7XHJcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKG91dERpcikpIHtcclxuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihvdXREaXIsICdmaXJlYmFzZS1tZXNzYWdpbmctc3cuanMnKSwgaW5qZWN0KHJhdykpO1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gIH07XHJcbn1cclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcclxuICByZXR1cm4ge1xyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogODA4MCxcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgLy8gQWxsb3cgR29vZ2xlIE9BdXRoIHBvcHVwIHRvIGNvbW11bmljYXRlIGJhY2sgdG8gdGhlIG9wZW5lclxyXG4gICAgICAnQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3knOiAnc2FtZS1vcmlnaW4tYWxsb3ctcG9wdXBzJyxcclxuICAgIH0sXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Fzc2V0cy8qLnBuZyddLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6ICdNYWxsZWFiaXRlJyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnTWFsbGVhYml0ZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdJbnRlbGxpZ2VudCBQcm9kdWN0aXZpdHkgUGxhdGZvcm0gLSBNYXN0ZXIgeW91ciB0aW1lIHdpdGggQUktcG93ZXJlZCBzY2hlZHVsaW5nJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyM4YjVjZjYnLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMGEwYTBhJyxcclxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnYXNzZXRzL2xvZ28ucG5nJyxcclxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJ2Fzc2V0cy9sb2dvLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxzdmcsd29mZjJ9J10sXHJcbiAgICAgICAgLy8gRXhjbHVkZSBsYXJnZSBpbWFnZXMgZnJvbSBwcmVjYWNoZSwgdGhleSdsbCBiZSBjYWNoZWQgYXQgcnVudGltZVxyXG4gICAgICAgIGdsb2JJZ25vcmVzOiBbJyoqL2Fzc2V0cy8qKicsICdmaXJlYmFzZS1tZXNzYWdpbmctc3cuanMnXSxcclxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LCAvLyA1TUIgbGltaXRcclxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ29vZ2xlYXBpc1xcLmNvbVxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2dvb2dsZS1mb250cy1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUgLy8gMSB5ZWFyXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwvYXNzZXRzXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnaW1hZ2UtY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDIwLFxyXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzAgLy8gMzAgZGF5c1xyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgfVxyXG4gICAgfSksXHJcbiAgICBmaXJlYmFzZU1lc3NhZ2luZ1NXUGx1Z2luKGVudiksXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIC8vIFByb2R1Y3Rpb24gYnVpbGQgb3B0aW1pemF0aW9uc1xyXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgIG1pbmlmeTogJ3RlcnNlcicsXHJcbiAgICBzb3VyY2VtYXA6IG1vZGUgPT09ICdkZXZlbG9wbWVudCcsXHJcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXHJcbiAgICBcclxuICAgIC8vIFJvbGx1cCBvcHRpb25zIGZvciBjb2RlIHNwbGl0dGluZ1xyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgIC8vIFZlbmRvciBjaHVua3MgZm9yIGJldHRlciBjYWNoaW5nXHJcbiAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3VpLXZlbmRvcic6IFtcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnUnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXNlbGVjdCcsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdGFicycsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9hc3QnLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgICdmaXJlYmFzZS12ZW5kb3InOiBbXHJcbiAgICAgICAgICAgICdmaXJlYmFzZS9hcHAnLFxyXG4gICAgICAgICAgICAnZmlyZWJhc2UvYXV0aCcsXHJcbiAgICAgICAgICAgICdmaXJlYmFzZS9maXJlc3RvcmUnLFxyXG4gICAgICAgICAgICAnZmlyZWJhc2UvZnVuY3Rpb25zJyxcclxuICAgICAgICAgICAgJ2ZpcmViYXNlL3N0b3JhZ2UnLFxyXG4gICAgICAgICAgICAnZmlyZWJhc2UvbWVzc2FnaW5nJyxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICAnY2hhcnQtdmVuZG9yJzogWydyZWNoYXJ0cyddLFxyXG4gICAgICAgICAgJ2RhdGUtdmVuZG9yJzogWydkYXRlLWZucycsICdkYXlqcyddLFxyXG4gICAgICAgICAgJ2FuaW1hdGlvbi12ZW5kb3InOiBbJ2ZyYW1lci1tb3Rpb24nXSxcclxuICAgICAgICAgICdjYXBhY2l0b3ItdmVuZG9yJzogW1xyXG4gICAgICAgICAgICAnQGNhcGFjaXRvci9jb3JlJyxcclxuICAgICAgICAgICAgJ0BjYXBhY2l0b3IvYXBwJyxcclxuICAgICAgICAgICAgJ0BjYXBhY2l0b3IvaGFwdGljcycsXHJcbiAgICAgICAgICAgICdAY2FwYWNpdG9yL2tleWJvYXJkJyxcclxuICAgICAgICAgICAgJ0BjYXBhY2l0b3IvbG9jYWwtbm90aWZpY2F0aW9ucycsXHJcbiAgICAgICAgICAgICdAY2FwYWNpdG9yL25ldHdvcmsnLFxyXG4gICAgICAgICAgICAnQGNhcGFjaXRvci9zcGxhc2gtc2NyZWVuJyxcclxuICAgICAgICAgICAgJ0BjYXBhY2l0b3Ivc3RhdHVzLWJhcicsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLy8gT3B0aW1pemUgY2h1bmsgZmlsZSBuYW1lc1xyXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxyXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxyXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tleHRdL1tuYW1lXS1baGFzaF0uW2V4dF0nLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIFxyXG4gICAgLy8gVGVyc2VyIG9wdGlvbnMgZm9yIHByb2R1Y3Rpb25cclxuICAgIHRlcnNlck9wdGlvbnM6IHtcclxuICAgICAgY29tcHJlc3M6IHtcclxuICAgICAgICBkcm9wX2NvbnNvbGU6IG1vZGUgPT09ICdwcm9kdWN0aW9uJyxcclxuICAgICAgICBkcm9wX2RlYnVnZ2VyOiB0cnVlLFxyXG4gICAgICAgIHB1cmVfZnVuY3M6IG1vZGUgPT09ICdwcm9kdWN0aW9uJyA/IFsnY29uc29sZS5sb2cnLCAnY29uc29sZS5kZWJ1ZycsICdjb25zb2xlLmluZm8nXSA6IFtdLFxyXG4gICAgICB9LFxyXG4gICAgICBmb3JtYXQ6IHtcclxuICAgICAgICBjb21tZW50czogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICAvLyBDaHVuayBzaXplIHdhcm5pbmdzXHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgfSxcclxuICBcclxuICAvLyBFbnZpcm9ubWVudCB2YXJpYWJsZXMgcHJlZml4XHJcbiAgZW52UHJlZml4OiAnVklURV8nLFxyXG4gIFxyXG4gIC8vIE9wdGltaXphdGlvbnNcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFtcclxuICAgICAgJ3JlYWN0JyxcclxuICAgICAgJ3JlYWN0LWRvbScsXHJcbiAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcclxuICAgICAgJ2ZpcmViYXNlL2FwcCcsXHJcbiAgICAgICdmaXJlYmFzZS9hdXRoJyxcclxuICAgICAgJ2ZpcmViYXNlL2ZpcmVzdG9yZSdcclxuICAgIF0sXHJcbiAgfSxcclxufTsgLy8gZW5kIGNvbmZpZyBvYmplY3RcclxufSk7IC8vIGVuZCBkZWZpbmVDb25maWdcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxUSxTQUFTLGNBQWMsZUFBNEI7QUFDeFQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFDZixTQUFTLGVBQWU7QUFKeEIsSUFBTSxt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
