// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { glob } from 'glob';

// Encuentra todos los archivos .html en la raíz del proyecto
const htmlFiles = glob.sync('*.html');

// Genera el objeto de entrada (input) para Rollup (el empaquetador de Vite)
const input = htmlFiles.reduce((acc, file) => {
    // Genera un nombre de "entrada" basado en el nombre del archivo
    // 'index.html' -> 'main'
    // 'alumnos.html' -> 'alumnos'
    const name = file === 'index.html' ? 'main' : file.replace('.html', '');
    acc[name] = resolve(__dirname, file);
    return acc;
}, {});

export default defineConfig({
    build: {
        rollupOptions: {
            input: input, // Le dice a Vite cuáles son todas tus "páginas"
        },
    },
});