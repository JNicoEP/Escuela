import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // 1. Tu página principal en la raíz
        main: resolve(__dirname, 'index.html'),

        // 2. Todas tus páginas dentro de /pages
        // (Debes tener una línea por CADA archivo .html)
        adminPanel: resolve(__dirname, 'pages/admin_panel.html'),
        alumnos: resolve(__dirname, 'pages/alumnos.html'),
        archivos: resolve(__dirname, 'pages/archivos.html'),
        aulasPrimero: resolve(__dirname, 'pages/aulas-primero.html'),
        aulas: resolve(__dirname, 'pages/aulas.html'),
        docentes: resolve(__dirname, 'pages/docentes.html'),
        historia: resolve(__dirname, 'pages/historia.html'),
        horarios: resolve(__dirname, 'pages/horarios.html'),
        novedades: resolve(__dirname, 'pages/novedades.html'),
        padres: resolve(__dirname, 'pages/padres.html'),
        panelAdmin: resolve(__dirname, 'pages/panel-admin.html'),
        panelAlumno: resolve(__dirname, 'pages/panel-alumno.html'),
        panelPadres: resolve(__dirname, 'pages/panel-padres.html'),
        pei: resolve(__dirname, 'pages/pei.html'),
        profesores: resolve(__dirname, 'pages/profesores.html'),
        proyecto_e: resolve(__dirname, 'pages/proyecto-e.html'),
        talleres: resolve(__dirname, 'pages/talleres.html')
      }
    }
  }
})