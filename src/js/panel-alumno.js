/* ----------------------------------
    Lógica para Panel de Alumno
* Versión conectada a Supabase
---------------------------------- */
'use strict';

// 1. IMPORTAR SUPABASE
import { supabase } from '../../src/js/supabaseClient.js';

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
 * Carga el horario desde Supabase y lo dibuja como una grilla (tabla HTML)
 * @param {number} idGrado - El ID del grado del alumno
 */
async function cargarHorarioGrid(idGrado) {
    const contenedor = document.getElementById('contenedor-horario');
    if (!contenedor) return;

    contenedor.innerHTML = `<p class="text-center p-5"><span class="spinner-border spinner-border-sm" role="status"></span> Cargando horario...</p>`;

    try {
        const { data: clases, error } = await supabase
            .from('horarios')
            .select('dia_semana, hora_inicio, hora_fin, materia_nombre, profesor_nombre')
            .eq('id_grado', idGrado)
            .order('hora_inicio');

        if (error) throw error;

        if (!clases || clases.length === 0) {
            contenedor.innerHTML = '<p class="text-muted text-center p-4">No hay un horario asignado para este grado.</p>';
            return;
        }

        // Esta función interna decide qué clase CSS usar
        const getMateriaClass = (materia) => {
            if (!materia) return 'materia-celda'; // Clase por defecto
            const m = materia.toLowerCase();

            if (m.includes('recreo')) return 'recreo';
            
            // Materias especiales (las que ya tenías)
            if (m.includes('plástica') || m.includes('artística')) return 'materia-plastica';
            if (m.includes('física')) return 'materia-efisica';
            if (m.includes('religión') || m.includes('formación ética')) return 'materia-religion';
            if (m.includes('música')) return 'materia-musica';
            if (m.includes('tecnolo')) return 'materia-tecnologia';
            if (m.includes('diversas')) return 'materia-diversas';
            if (m.includes('inglés')) return 'materia-ingles';
            if (m.includes('agropecuaria')) return 'materia-agro';

            // =============================================
            //        ▼▼ ¡NUEVAS MATERIAS! ▼▼
            // =============================================
            if (m.includes('matemática')) return 'materia-matematica'; // Naranja pastel
            if (m.includes('lengua')) return 'materia-lengua';       // Azul claro
            if (m.includes('naturales')) return 'materia-naturales';  // Menta/Verde
            if (m.includes('sociales')) return 'materia-sociales';   // Beige/Crema
            // =============================================
            //        ▲▲ ¡FIN DE MATERIAS! ▲▲
            // =============================================

            return 'materia-celda'; // Clase por defecto
        };

        const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
        const bloquesHorarios = [...new Map(clases.map(c =>
            [c.hora_inicio, c])).values()].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

        let html = '<table class="table table-bordered horario-table">';
        html += '<thead class="table-light"><tr><th>Hora</th>';
        diasSemana.forEach(dia => {
            html += `<th>${dia}</th>`;
        });
        html += '</tr></thead>';
        html += '<tbody>';

        bloquesHorarios.forEach(bloque => {
            const horaInicio = bloque.hora_inicio.substring(0, 5);
            const horaFin = bloque.hora_fin.substring(0, 5);
            html += `<tr><td>${horaInicio}<br>${horaFin}</td>`;

            diasSemana.forEach(dia => {
                const clase = clases.find(c =>
                    c.dia_semana === dia && c.hora_inicio === bloque.hora_inicio
                );
                if (clase) {
                    const claseCSS = getMateriaClass(clase.materia_nombre);
                    html += `<td class="${claseCSS}">`; // La clase se aplica aquí

                    if (claseCSS !== 'recreo') { // Si no es recreo, muestra normal
                        html += `<strong>${clase.materia_nombre || ''}</strong>`;
                        if (clase.profesor_nombre) {
                            html += `<br><small>${clase.profesor_nombre}</small>`;
                        }
                    } else {
                        html += `${clase.materia_nombre}`; // Si es recreo, solo el texto
                    }
                    html += `</td>`;

                } else {
                    html += '<td></td>';
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        contenedor.innerHTML = html;

    } catch (error) {
        console.error("Error al cargar horario:", error);
        contenedor.innerHTML = `<p class="text-danger text-center p-4"><b>Error al cargar el horario:</b><br>${error.message}</p>`;
    }
}

/**
 * Carga la lista de grados desde Supabase y la pone en un dropdown
 * @param {string} selectElementId - El ID del <select> a rellenar
 */
async function poblarDropdownGrados(selectElementId) {
    const selectEl = document.getElementById(selectElementId);
    if (!selectEl) return;

    try {
        const { data: grados, error } = await supabase
            .from('grado')
            .select('id_grado, nombre_grado')
            .order('id_grado', { ascending: true }); // Ordena por ID (1°, 2°, 3°)

        if (error) throw error;

        selectEl.innerHTML = '<option value="" disabled>Selecciona un grado...</option>';

        grados.forEach(grado => {
            const option = document.createElement('option');
            option.value = grado.id_grado;
            option.textContent = grado.nombre_grado;
            selectEl.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar grados:', error.message);
        selectEl.innerHTML = '<option value="">Error al cargar grados</option>';
    }
}

/**
 * Función principal para cargar y mostrar los datos del estudiante.
 */
/**
 * Función principal para cargar y mostrar los datos del estudiante.
 */
async function cargarDatosEstudiante() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('Error al obtener el usuario:', authError);
        alert('No se pudo verificar tu sesión. Serás redirigido.');
        window.location.href = '/index.html';
        return;
    }

    // 3. CONSULTAR LA BASE DE DATOS (CON CAMPOS CUD)
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
                tutor_nombre,       
                tutor_educacion,    
                tutor_trabajo,
                tiene_cud,         
                cud_diagnostico,   
                cud_vencimiento,   
                grado ( 
                    id_grado, 
                    nombre_grado 
                ) 
            )
        `)
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

    datosUsuarioActual = data;

    // 4. POPULAR (RELLENAR) EL HTML
    try {
        const alumnoInfo = data.alumnos || {};
        const gradoInfo = alumnoInfo.grado || {};
        const nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`;

        fillData('nav-matricula', 'N/A');
        fillData('stat-promedio-valor', 'N/A');
        fillData('stat-asistencia-valor', 'N/A');
        fillData('stat-cursos-valor', 'N/A');
        fillData('stat-tareas-valor', 'N/A');
        fillData('profile-name', nombreCompleto);
        fillData('profile-matricula', 'Matrícula: N/A');
        fillData('profile-grado', gradoInfo.nombre_grado);
        fillData('profile-seccion', 'N/A');
        fillData('profile-promedio-card', 'N/A');
        fillData('info-nombre', nombreCompleto);
        fillData('info-email', data.email);
        fillData('info-dni', data.dni);
        fillData('info-direccion', alumnoInfo.direccion);
        fillData('info-telefono', alumnoInfo.telefono);
        fillData('info-fecha-nacimiento', alumnoInfo.fecha_nacimiento);
        fillData('info-tutor-nombre', alumnoInfo.tutor_nombre);
        fillData('info-tutor-trabajo', alumnoInfo.tutor_trabajo);
        fillData('info-tutor-educacion', alumnoInfo.tutor_educacion);
        
        // --- NUEVO CAMPO CUD ---
        fillData('info-cud-diagnostico', alumnoInfo.cud_diagnostico);
        
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
 * Función para guardar los cambios del perfil
 */
/**
 * Función para guardar los cambios del perfil
 */
async function guardarCambiosPerfil(e) {
    e.preventDefault();
    console.log("Guardando cambios...");

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
    const nuevaDireccion = document.getElementById('input-direccion-modal').value;
    const nuevoTutorNombre = document.getElementById('input-tutor-nombre-modal').value;
    const nuevoTutorEducacion = document.getElementById('input-tutor-educacion-modal').value;
    const nuevoTutorTrabajo = document.getElementById('input-tutor-trabajo-modal').value;
    const nuevaFechaRaw = document.getElementById('input-fecha-nacimiento-modal').value;
    const nuevoIdGradoRaw = document.getElementById('input-grado-modal').value;

    // Convertir "" a null para la base de datos
    const nuevaFecha = nuevaFechaRaw === "" ? null : nuevaFechaRaw;
    const nuevoIdGrado = nuevoIdGradoRaw === "" ? null : nuevoIdGradoRaw;

    // --- NUEVOS VALORES CUD ---
    const nuevoCudTiene = document.getElementById('input-cud-tiene').value === 'true';
    const nuevoCudDiagnostico = document.getElementById('input-cud-diagnostico').value || null;
    const nuevoCudVencimientoRaw = document.getElementById('input-cud-vencimiento').value;
    const nuevoCudVencimiento = nuevoCudVencimientoRaw === "" ? null : nuevoCudVencimientoRaw;
    
    try {
        // 3. Actualizar la tabla 'usuarios'
        const { error: userError } = await supabase
            .from('usuarios')
            .update({ nombre: nuevoNombre, apellido: nuevoApellido })
            .eq('id_usuario', userId);
        if (userError) throw userError;

        // 4. Actualizar la tabla 'alumnos' (CON CAMPOS CUD)
        const { error: alumnoError } = await supabase
            .from('alumnos')
            .update({
                telefono: nuevoTelefono,
                fecha_nacimiento: nuevaFecha,
                direccion: nuevaDireccion,
                tutor_nombre: nuevoTutorNombre,
                tutor_educacion: nuevoTutorEducacion,
                tutor_trabajo: nuevoTutorTrabajo,
                id_grado: nuevoIdGrado,
                tiene_cud: nuevoCudTiene,
                cud_diagnostico: nuevoCudDiagnostico,
                cud_vencimiento: nuevoCudVencimiento
            })
            .eq('id_alumno', userId);
        if (alumnoError) throw alumnoError;

        // 5. Éxito
        alert("¡Perfil actualizado con éxito!");

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
    // Iniciar la carga de datos
    cargarDatosEstudiante();

    const modalEditarPerfil = document.getElementById('modalEditarPerfil');
    const formEditarPerfil = document.getElementById('formEditarPerfil');

    // 1. Rellenar el modal cuando se abre
    if (modalEditarPerfil) {
        modalEditarPerfil.addEventListener('show.bs.modal', async () => {
            // Carga los grados en el dropdown ANTES de rellenar
            await poblarDropdownGrados('input-grado-modal');
            
            if (datosUsuarioActual) {
                const alumnoInfo = datosUsuarioActual.alumnos || {}; // Esta es la corrección clave
                
                document.getElementById('input-nombre-modal').value = datosUsuarioActual.nombre || '';
                document.getElementById('input-apellido-modal').value = datosUsuarioActual.apellido || '';
                document.getElementById('input-dni-modal').value = datosUsuarioActual.dni || '';
                document.getElementById('input-telefono-modal').value = alumnoInfo.telefono || '';
                document.getElementById('input-fecha-nacimiento-modal').value = alumnoInfo.fecha_nacimiento || '';
                document.getElementById('input-direccion-modal').value = alumnoInfo.direccion || '';
                document.getElementById('input-tutor-nombre-modal').value = alumnoInfo.tutor_nombre || '';
                document.getElementById('input-tutor-educacion-modal').value = alumnoInfo.tutor_educacion || '';
                document.getElementById('input-tutor-trabajo-modal').value = alumnoInfo.tutor_trabajo || '';

                // Selecciona el grado actual del alumno
                if (alumnoInfo.grado) {
                    document.getElementById('input-grado-modal').value = alumnoInfo.grado.id_grado;
                }

                // --- NUEVO: Rellenar campos CUD y lógica de visibilidad ---
                const selectorCud = document.getElementById('input-cud-tiene');
                const detallesCud = document.getElementById('cud-detalles-container');

                // 1. Rellenar los campos
                selectorCud.value = alumnoInfo.tiene_cud ? 'true' : 'false';
                document.getElementById('input-cud-diagnostico').value = alumnoInfo.cud_diagnostico || '';
                document.getElementById('input-cud-vencimiento').value = alumnoInfo.cud_vencimiento || '';

                // 2. Mostrar/ocultar el contenedor basado en el valor
                detallesCud.style.display = alumnoInfo.tiene_cud ? 'block' : 'none';

            } else {
                console.error("No se pudieron cargar los datos del usuario para editar.");
            }
        });
    }

    // --- NUEVO: Listener para el dropdown de CUD ---
    const selectorCud = document.getElementById('input-cud-tiene');
    if (selectorCud) {
        selectorCud.addEventListener('change', () => {
            const detallesCud = document.getElementById('cud-detalles-container');
            if (selectorCud.value === 'true') {
                detallesCud.style.display = 'block';
            } else {
                detallesCud.style.display = 'none';
            }
        });
    }

    // 2. Guardar los cambios al enviar el formulario
    if (formEditarPerfil) {
        formEditarPerfil.addEventListener('submit', guardarCambiosPerfil);
    }

    // --- Lógica para cargar el horario SÓLO al hacer clic en la pestaña ---
    const tabHorario = document.getElementById('horario-tab');
    if (tabHorario) {
        tabHorario.addEventListener('shown.bs.tab', () => {
            if (datosUsuarioActual && datosUsuarioActual.alumnos && datosUsuarioActual.alumnos.grado) {
                const idGrado = datosUsuarioActual.alumnos.grado.id_grado;
                cargarHorarioGrid(idGrado);
            } else {
                console.warn("No se pudieron cargar los datos del alumno para ver el horario.");
                document.getElementById('contenedor-horario').innerHTML =
                    '<p class="text-danger p-4">No se pudo identificar tu grado para cargar el horario. <br>Por favor, asigna un grado a este alumno en la pestaña "Perfil".</p>';
            }
        }, { once: true });
    }
});