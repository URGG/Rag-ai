import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true // This allows you to install it even while running localhost
            },
            manifest: {
                name: 'Kernel Workspace',
                short_name: 'Kernel',
                description: 'Local AI RAG IDE',
                theme_color: '#0A0A0B',
                background_color: '#0A0A0B',
                display: 'standalone',
                icons: [{
                    src: 'https://cdn-icons-png.flaticon.com/512/1162/1162815.png', // Temporary placeholder icon
                    sizes: '512x512',
                    type: 'image/png'
                }]
            }
        })
    ],
})