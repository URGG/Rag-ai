import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    base: './',
    build: {
        outDir: 'ui-build',
        emptyOutDir: true
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true
            },
            manifest: {
                name: 'Kernel Workspace',
                short_name: 'Kernel',
                description: 'Local AI RAG IDE',
                theme_color: '#0A0A0B',
                background_color: '#0A0A0B',
                display: 'standalone',
                icons: [{
                    src: '/logo.png',
                    sizes: '512x512',
                    type: 'image/png'
                }]
            }
        })
    ],
})