/* ----------------------------------
   Lógica para Panel de Alumno
   (panel-alumno.js - Módulo ESM)
---------------------------------- */
'use strict';

/**
 * Objeto estático con los datos simulados del estudiante.
 * (En un proyecto real, esto vendría de una API/Supabase)
 */
const datosEstudiante = {
    nombre: "Juan Carlos Pérez García",
    matricula: "2024-001",
    promedioGeneral: 20.0,
    asistencia: "100%",
    cursosActivos: 5,
    tareasPendientes: 1,
    perfilStats: {
        grado: "10mo",
        seccion: "A",
        promedio: 20.0
    },
    infoPersonal: {
        nombreCompleto: "Juan Carlos Pérez García",
        email: "juan.perez@escuela.edu",
        direccion: "Calle Principal 123, Ciudad",
        telefono: "555-0101",
        fechaNacimiento: "2008-05-15",
        tutor: "María García"
    },
    resumen: {
        promedioAcumulado: 20.0,
        mejorMateria: "Matemáticas",
        totalMaterias: 8
    }
};

/**
 * Función principal que se ejecuta cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    /**
     * Rellena todos los elementos del DOM con los datos del estudiante.
     */
    const popularDatos = () => {
        try {
            // 1. Barra de Navegación
            document.getElementById('nav-matricula').textContent = datosEstudiante.matricula;

            // 2. Fila 1: Tarjetas de Estadísticas
            document.getElementById('stat-promedio-valor').textContent = datosEstudiante.promedioGeneral;
            document.getElementById('stat-asistencia-valor').textContent = datosEstudiante.asistencia;
            document.getElementById('stat-cursos-valor').textContent = datosEstudiante.cursosActivos;
            document.getElementById('stat-tareas-valor').textContent = datosEstudiante.tareasPendientes;

            // 3. Fila 3: Pestaña Perfil (Tarjeta Izquierda)
            document.getElementById('profile-name').textContent = datosEstudiante.nombre;
            document.getElementById('profile-matricula').textContent = `Matrícula: ${datosEstudiante.matricula}`;
            document.getElementById('profile-grado').textContent = datosEstudiante.perfilStats.grado;
            document.getElementById('profile-seccion').textContent = datosEstudiante.perfilStats.seccion;
            document.getElementById('profile-promedio-card').textContent = datosEstudiante.perfilStats.promedio;

            // 4. Fila 3: Pestaña Perfil (Tarjeta Derecha - Info Personal)
            document.getElementById('info-nombre').textContent = datosEstudiante.infoPersonal.nombreCompleto;
            document.getElementById('info-email').textContent = datosEstudiante.infoPersonal.email;
            document.getElementById('info-direccion').textContent = datosEstudiante.infoPersonal.direccion;
            document.getElementById('info-telefono').textContent = datosEstudiante.infoPersonal.telefono;
            document.getElementById('info-fecha-nacimiento').textContent = datosEstudiante.infoPersonal.fechaNacimiento;
            document.getElementById('info-tutor').textContent = datosEstudiante.infoPersonal.tutor;

            // 5. Fila 4: Resumen Académico
            document.getElementById('summary-promedio').textContent = datosEstudiante.resumen.promedioAcumulado;
            document.getElementById('summary-mejor-materia-val').textContent = "A+"; // Valor simulado
            document.getElementById('summary-mejor-materia-label').textContent = datosEstudiante.resumen.mejorMateria;
            document.getElementById('summary-materias').textContent = datosEstudiante.resumen.totalMaterias;

        } catch (e) {
            console.error("Error al poblar los datos del estudiante:", e);
            // Aquí podrías mostrar un error al usuario
        }
    };

    // Iniciar la carga de datos
    popularDatos();

});