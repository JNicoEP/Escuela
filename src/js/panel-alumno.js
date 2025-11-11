/* ----------------------------------
   Lógica para Panel de Alumno
* Versión conectada a Supabase
---------------------------------- */
'use strict';

// 1. IMPORTAR SUPABASE
// ¡Ajusta esta ruta! Depende de dónde esté tu archivo.
import { supabase } from '../../src/js/supabaseClient.js';

// --- NUEVO: Variable para guardar los datos cargados ---
// La necesitamos fuera de la función para que el modal pueda acceder a ella
let datosUsuarioActual = null;

/**
 * Función para rellenar un elemento del DOM de forma segura.
 */
const fillData = (id, text) => {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text || 'No disponible';
    } else {
        console.warn(`Elemento con ID "${id}" no encontrado.`);
    }
};

/**
 * Función principal para cargar y mostrar los datos del estudiante.
 */
async function cargarDatosEstudiante() {
    // 2. OBTENER EL USUARIO AUTENTICADO
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('Error al obtener el usuario:', authError);
        alert('No se pudo verificar tu sesión. Serás redirigido.');
        window.location.href = '/index.html';
        return;
    }

    // 3. CONSULTAR LA BASE DE DATOS (CORREGIDO)
    const { data, error: dbError } = await supabase
        .from('usuarios')
        .select(`
            nombre,
            apellido,
            email,
            dni,
            alumnos ( 
                estatus_inscripcion,
                fecha_nacimiento,  
                direccion,         
                telefono,          
                grado ( nombre_grado ) 
            )
      _ `)
        .eq('id_usuario', user.id)
        .single();

    if (dbError) {
        console.error('Error al cargar el perfil del alumno:', dbError);
        alert('Error al cargar tu perfil: ' + dbError.message);
        return;
    }

    if (!data) {
        console.error('No se encontraron datos de perfil para el usuario:', user.id);
        alert('No se encontró un perfil de alumno asociado a tu cuenta.');
        return;
    }

    // --- NUEVO: Guardar los datos en la variable global ---
    datosUsuarioActual = data;

    // 4. POPULAR (RELLENAR) EL HTML (CORREGIDO)
    try {
        const alumnoInfo = data.alumnos[0] || {};
        const gradoInfo = alumnoInfo.grado || {};
        const nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`;

        // 1. Barra de Navegación
        fillData('nav-matricula', 'N/A');

        // 2. Fila 1: Tarjetas de Estadísticas (Simuladas)
        fillData('stat-promedio-valor', 'N/A');
        fillData('stat-asistencia-valor', 'N/A');
        fillData('stat-cursos-valor', 'N/A');
        fillData('stat-tareas-valor', 'N/A');

        // 3. Fila 3: Pestaña Perfil (Tarjeta Izquierda)
        fillData('profile-name', nombreCompleto);
        fillData('profile-matricula', 'Matrícula: N/A');
        fillData('profile-grado', gradoInfo.nombre_grado);
        fillData('profile-seccion', 'N/A');
        fillData('profile-promedio-card', 'N/A');

        // 4. Fila 3: Pestaña Perfil (Tarjeta Derecha - Info Personal)
        fillData('info-nombre', nombreCompleto);
        fillData('info-email', data.email);
        fillData('info-dni', data.dni); // Añadido en el paso anterior
        fillData('info-direccion', alumnoInfo.direccion);
        fillData('info-telefono', alumnoInfo.telefono);
        fillData('info-fecha-nacimiento', alumnoInfo.fecha_nacimiento);
        fillData('info-tutor', 'N/A');

        // 5. Fila 4: Resumen Académico (Simulado)
        fillData('summary-promedio', 'N/A');
        fillData('summary-mejor-materia-val', 'N/A');
        fillData('summary-mejor-materia-label', 'N/A');
        fillData('summary-materias', 'N/A');

    } catch (e) {
        console.error("Error al rellenar los datos en el DOM:", e);
        alert('Ocurrió un error al mostrar tus datos.');
    }
}

/**
 * --- NUEVO: Función para guardar los cambios del perfil ---
 */
async function guardarCambiosPerfil(e) {
    e.preventDefault(); // Prevenir recarga de página
    console.log("Guardando cambios...");

    // 1. Obtener el ID del usuario
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Sesión expirada, por favor inicia sesión de nuevo.");
        return;
    }
    const userId = user.id;

    // 2. Obtener valores de los inputs del modal
    const nuevoNombre = document.getElementById('input-nombre-modal').value;
    const nuevoApellido = document.getElementById('input-apellido-modal').value;
    const nuevoDNI = document.getElementById('input-dni-modal').value;
    const nuevoTelefono = document.getElementById('input-telefono-modal').value;
    const nuevaFecha = document.getElementById('input-fecha-nacimiento-modal').value;
    const nuevaDireccion = document.getElementById('input-direccion-modal').value;

    try {
        // 3. Actualizar la tabla 'usuarios' (Nombre y Apellido)
        const { error: userError } = await supabase
            .from('usuarios')
            .update({ nombre: nuevoNombre, apellido: nuevoApellido })
            .eq('id_usuario', userId);
        if (userError) throw userError;

        // 4. Actualizar la tabla 'alumnos' (Teléfono, Fecha, Dirección)
        const { error: alumnoError } = await supabase
            .from('alumnos')
            .update({
                telefono: nuevoTelefono,
                fecha_nacimiento: nuevaFecha,
                direccion: nuevaDireccion
            })
            .eq('id_alumno', userId); // Asumiendo que id_alumno es el mismo que id_usuario
        if (alumnoError) throw alumnoError;

        // 5. Éxito
        alert("¡Perfil actualizado con éxito!");

        // Ocultar el modal (usando el objeto global de Bootstrap)
        const modalEl = document.getElementById('modalEditarPerfil');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Recargar los datos del panel para mostrar los cambios
        cargarDatosEstudiante();

    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
        alert('Error al actualizar: ' + error.message);
    }
}


/**
 * Función principal que se ejecuta cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Iniciar la carga de datos (como ya estaba)
    cargarDatosEstudiante();

    // --- NUEVO: Lógica para el modal de edición ---

    const modalEditarPerfil = document.getElementById('modalEditarPerfil');
    const formEditarPerfil = document.getElementById('formEditarPerfil');

    // 1. Rellenar el modal cuando se abre
    if (modalEditarPerfil) {
        // Evento que se dispara ANTES de que el modal se muestre
        modalEditarPerfil.addEventListener('show.bs.modal', () => {
            // Rellenamos el modal con los datos actuales
            if (datosUsuarioActual) {
                const alumnoInfo = datosUsuarioActual.alumnos[0] || {};
                document.getElementById('input-nombre-modal').value = datosUsuarioActual.nombre || '';
                document.getElementById('input-apellido-modal').value = datosUsuarioActual.apellido || '';
                document.getElementById('input-dni-modal').value = datosUsuarioActual.dni || '';
                document.getElementById('input-telefono-modal').value = alumnoInfo.telefono || '';
                document.getElementById('input-fecha-nacimiento-modal').value = alumnoInfo.fecha_nacimiento || '';
                document.getElementById('input-direccion-modal').value = alumnoInfo.direccion || '';
            } else {
                console.error("No se pudieron cargar los datos del usuario para editar.");
                // Opcional: cerrar el modal si no hay datos
            }
        });
    }

    // 2. Guardar los cambios al enviar el formulario
    if (formEditarPerfil) {
        // Evento que se dispara al ENVIAR el formulario
        formEditarPerfil.addEventListener('submit', guardarCambiosPerfil);
    }

    // --- FIN de la lógica del modal ---
});