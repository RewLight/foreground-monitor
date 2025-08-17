// Plugins
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import Fonts from 'unplugin-fonts/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VueRouter({ dts: 'src/typed-router.d.ts' }),
    Vue({ template: { transformAssetUrls } }),
    Vuetify({
      autoImport: true,
      styles: { configFile: 'src/styles/settings.scss' },
    }),
    Components({ dts: 'src/components.d.ts' }),
    Fonts({
      google: {
        families: [
          { name: 'Rubik', styles: 'wght@400;500;700' },
          { name: 'Noto+Sans+SC', styles: 'wght@400;500;700' },
        ],
        display: 'swap',
      },
    }),
    VitePWA({
      strategies: 'injectManifest',      // 改为 injectManifest
      srcDir: 'src',                      // SW 源文件目录
      filename: 'sw.js',                  // SW 文件名
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      manifest: {
        name: '前台应用监控',
        short_name: '前台监控',
        description: '监控设备前台应用状态',
        theme_color: '#1976D2',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          // 缓存 Google Fonts 样式表
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // 缓存 Google Fonts 字体文件
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: [
      'vuetify',
      'vue-router',
      'unplugin-vue-router/runtime',
      'unplugin-vue-router/data-loaders',
      'unplugin-vue-router/data-loaders/basic',
    ],
  },
  define: { 'process.env': {} },
  resolve: {
    alias: { '@': fileURLToPath(new URL('src', import.meta.url)) },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
  },
  server: { port: 3000 },
  css: {
    preprocessorOptions: {
      sass: { api: 'modern-compiler' },
      scss: { api: 'modern-compiler' },
    },
  },
  build: {
    minify: 'esbuild', // 避免 terser 与 injectManifest 冲突
    target: 'es2018',
  },
})

