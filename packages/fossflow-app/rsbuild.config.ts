import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
    plugins: [pluginReact()],
    html: {
        template: './public/index.html',
    },
    server: {
        // 前端路由使用 History 模式：/editor、/runtime 直接访问或刷新时
        // 都需要回退到 index.html，否则会 404
        htmlFallback: 'index',
        historyApiFallback: true,
        // 开发环境把接口转发到后端（生产由 nginx 代理 /api/）
        proxy: {
            '/api': {
                target: process.env.BACKEND_URL || 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    output: {
        distPath: {
            root: 'build',
        },
        // https://rsbuild.rs/guide/advanced/browser-compatibility
        polyfill: 'usage',
        assetPrefix: process.env.PUBLIC_URL || '/',
        copy: [
            {
                from: './src/i18n',
                to: 'i18n/app',
            },
        ]
    }
});
