// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 基本公共路径
  base: './',
  
  // 构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 生成静态资源的存放路径
    assetsInlineLimit: 4096, // 4kb以下的资源内联为base64
    // 启用/禁用CSS代码拆分
    cssCodeSplit: true,
    // 构建后是否生成source map文件
    sourcemap: false,
    // 自定义底层的Rollup打包配置
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // 静态资源分类打包
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
  
  // 服务器选项
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true,
  },
});
