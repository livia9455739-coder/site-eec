import { defineConfig } from 'vite'

export default defineConfig({
    publicDir: 'public',
    build:{
        copyPublicDir: true,
        emptyOutDir: false,
        outDir: 'dist/public'
    }
})