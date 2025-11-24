/* ----------------------------------
    Lógica para Panel de Alumno
* Versión conectada a Supabase
---------------------------------- */
'use strict';

// 1. Importas la conexión a la Base de Datos (Configuración)
import { supabase } from '../config/supabaseClient.js';



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

    // Helper para limpiar el 549 (definido aquí o globalmente)
    const cleanPhone = (num) => num ? num.toString().replace(/^549/, '') : '';

    if (authError || !user) {
        console.error('Error al obtener el usuario:', authError);
        window.location.href = '/index.html';
        return;
    }

    // 3. CONSULTAR LA BASE DE DATOS (AGREGANDO tutor_email y tutor_telefono)
    const { data, error: dbError } = await supabase
        .from('usuarios')
        .select(`
            id_usuario,
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
                tutor_email,      
                tutor_telefono,    
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

    datosUsuarioActual = data;

    // 4. POPULAR (RELLENAR) EL HTML
    try {
        const alumnoInfo = data.alumnos || {};
        const gradoInfo = alumnoInfo.grado || {};
        const nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`;
        const userNameDisplay = document.getElementById('user-name-display');
        
        if (userNameDisplay) {
            userNameDisplay.textContent = nombreCompleto;
        }

        // Llenar datos básicos
        fillData('profile-name', nombreCompleto);
        fillData('profile-matricula', 'Matrícula: ' + (data.dni || 'N/A'));
        fillData('profile-grado', gradoInfo.nombre_grado);
        fillData('profile-seccion', 'A'); // Asumiendo sección A por ahora
        fillData('profile-promedio-card', 'N/A'); // Se calcula luego

        // Llenar tarjeta de información
        fillData('info-nombre', nombreCompleto);
        fillData('info-email', data.email);
        fillData('info-dni', data.dni);
        fillData('info-direccion', alumnoInfo.direccion);
        fillData('info-telefono', cleanPhone(alumnoInfo.telefono));
        fillData('info-fecha-nacimiento', alumnoInfo.fecha_nacimiento);
        
        // --- DATOS DEL TUTOR ---
        fillData('info-tutor-nombre', alumnoInfo.tutor_nombre);
        fillData('info-tutor-trabajo', alumnoInfo.tutor_trabajo);
        fillData('info-tutor-educacion', alumnoInfo.tutor_educacion);
        fillData('info-tutor-telefono', cleanPhone(alumnoInfo.tutor_telefono)); 
        fillData('info-tutor-email', alumnoInfo.tutor_email);


        // Datos CUD
        fillData('info-cud-estado', alumnoInfo.tiene_cud ? 'Sí' : 'No');
        fillData('info-cud-diagnostico', alumnoInfo.cud_diagnostico);

        // Inicializar N/A en las estadísticas antes de calcular
        fillData('stat-promedio-valor', 'N/A');
        fillData('stat-asistencia-valor', 'N/A');
        fillData('stat-cursos-valor', 'N/A');
        fillData('stat-tareas-valor', 'N/A');
        
        // Ejecutar cálculos de tarjetas
        cargarEstadisticasResumen();

    } catch (e) {
        console.error("Error al rellenar los datos en el DOM:", e);
    }
}

/**
 * Cierra la sesión del usuario y redirige al inicio.
 */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error al salir:', error);
    }
    window.location.href = '/index.html';
}
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

    // 1. Referencias a elementos del DOM (Validamos que existan)
    const elTelefono = document.getElementById('input-telefono-modal');
    const elTutorTel = document.getElementById('input-tutor-telefono');
    const elTutorEmail = document.getElementById('input-tutor-email');

    // Si falta algún elemento en el HTML, avisamos para evitar el crash
    if (!elTelefono || !elTutorTel || !elTutorEmail) {
        console.error("Faltan elementos en el HTML. Verifica los IDs: input-telefono-modal, input-tutor-telefono, input-tutor-email");
        alert("Error interno: Faltan campos en el formulario.");
        return;
    }

    // 2. Función para formatear el teléfono (agregar 549)
    const formatPhone = (val) => {
        if (!val) return null;
        const limpio = val.trim();
        if (!limpio) return null;
        return limpio.startsWith('549') ? limpio : `549${limpio}`;
    };

    // 3. Obtener valores
    const nuevoNombre = document.getElementById('input-nombre-modal').value;
    const nuevoApellido = document.getElementById('input-apellido-modal').value;
    const nuevoDNI = document.getElementById('input-dni-modal').value;
    const nuevaDireccion = document.getElementById('input-direccion-modal').value;
    
    const nuevoTutorNombre = document.getElementById('input-tutor-nombre-modal').value;
    const nuevoTutorEducacion = document.getElementById('input-tutor-educacion-modal').value;
    const nuevoTutorTrabajo = document.getElementById('input-tutor-trabajo-modal').value;

    const nuevaFechaRaw = document.getElementById('input-fecha-nacimiento-modal').value;
    const nuevoIdGradoRaw = document.getElementById('input-grado-modal').value;
    
    // Valores procesados
    const nuevoTelefono = formatPhone(elTelefono.value);
    const nuevoTutorTelefono = formatPhone(elTutorTel.value);
    const nuevoTutorEmail = elTutorEmail.value;
    
    const nuevaFecha = nuevaFechaRaw === "" ? null : nuevaFechaRaw;
    const nuevoIdGrado = nuevoIdGradoRaw === "" ? null : nuevoIdGradoRaw;

    // Datos CUD
    const nuevoCudTiene = document.getElementById('input-cud-tiene').value === 'true';
    const nuevoCudDiagnostico = document.getElementById('input-cud-diagnostico').value || null;
    const nuevoCudVencimientoRaw = document.getElementById('input-cud-vencimiento').value;
    const nuevoCudVencimiento = nuevoCudVencimientoRaw === "" ? null : nuevoCudVencimientoRaw;

    try {
        // 4. Actualizar tabla 'usuarios'
        const { error: userError } = await supabase
            .from('usuarios')
            .update({ nombre: nuevoNombre, apellido: nuevoApellido })
            .eq('id_usuario', userId);
        if (userError) throw userError;

        // 5. Actualizar tabla 'alumnos'
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
                cud_vencimiento: nuevoCudVencimiento,
                tutor_telefono: nuevoTutorTelefono,
                tutor_email: nuevoTutorEmail
            })
            .eq('id_alumno', userId);
        
        if (alumnoError) throw alumnoError;

        alert("¡Perfil actualizado con éxito!");

        const modalEl = document.getElementById('modalEditarPerfil');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        cargarDatosEstudiante();

    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
        alert('Error al actualizar: ' + error.message);
    }
}
/**
 * Carga las calificaciones con diseño de Acordeón y cálculo de promedios
 */
async function cargarCalificaciones() {
    const container = document.getElementById('accordionCalificaciones');
    
    // Si no existe el contenedor, salimos
    if (!container) return;

    try {
        // Consulta a Supabase
        const { data: inscripciones, error } = await supabase
            .from('inscripciones')
            .select(`
                id_inscripcion,
                materias ( nombre_materia ),
                calificaciones ( 
                    id_calificacion,
                    nota, 
                    tipo_evaluacion, 
                    fecha, 
                    periodo, 
                    observaciones 
                )
            `)
            .eq('id_alumno', datosUsuarioActual.id_usuario)
            // Ordenamos para que aparezcan las materias alfabéticamente (opcional)
            //.order('materias(nombre_materia)', { ascending: true }); // Nota: Supabase a veces complica ordenar por relaciones, lo haremos por JS si hace falta.

        if (error) throw error;

        if (!inscripciones || inscripciones.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-book-open fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No estás inscrito en ninguna materia todavía.</p>
                </div>`;
            return;
        }

        let html = '';

        // Recorremos cada materia
        inscripciones.forEach((insc, index) => {
            if (!insc.materias) return;

            const nombreMateria = insc.materias.nombre_materia;
            const notas = insc.calificaciones || [];
            const idCollapse = `collapseMateria${index}`;
            const idHeading = `headingMateria${index}`;

            // 1. Calcular Promedio
            let promedio = 0;
            let colorClase = 'secondary'; // Gris por defecto
            let estadoTexto = 'Sin notas';
            let porcentajeBarra = 0;

            if (notas.length > 0) {
                const suma = notas.reduce((acc, curr) => acc + curr.nota, 0);
                promedio = (suma / notas.length).toFixed(1); // 1 decimal
                porcentajeBarra = promedio * 10; // Si es 8.5 -> 85%

                // Determinar color (Asumimos 6 como nota de aprobación)
                if (promedio >= 6) {
                    colorClase = 'success'; // Verde
                    estadoTexto = 'Aprobado';
                } else {
                    colorClase = 'danger'; // Rojo
                    estadoTexto = 'Desaprobado';
                }
            }

            // 2. Construir el HTML del Item del Acordeón
            html += `
                <div class="accordion-item mb-2 border rounded overflow-hidden shadow-sm">
                    <h2 class="accordion-header" id="${idHeading}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${idCollapse}" aria-expanded="false" aria-controls="${idCollapse}">
                            <div class="d-flex w-100 justify-content-between align-items-center me-3">
                                <div class="d-flex align-items-center">
                                    <div class="rounded-circle bg-${colorClase}-subtle text-${colorClase} p-2 me-3 d-flex justify-content-center align-items-center" style="width: 45px; height: 45px;">
                                        <span class="fw-bold">${promedio > 0 ? promedio : '-'}</span>
                                    </div>
                                    <div>
                                        <h6 class="mb-0 fw-bold text-dark">${nombreMateria}</h6>
                                        <small class="text-${colorClase}">${notas.length} evaluaciones</small>
                                    </div>
                                </div>
                                
                                <div class="d-none d-md-block w-25 mx-3">
                                    <div class="progress" style="height: 6px;">
                                        <div class="progress-bar bg-${colorClase}" role="progressbar" style="width: ${porcentajeBarra}%" aria-valuenow="${promedio}" aria-valuemin="0" aria-valuemax="10"></div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </h2>
                    <div id="${idCollapse}" class="accordion-collapse collapse" aria-labelledby="${idHeading}" data-bs-parent="#accordionCalificaciones">
                        <div class="accordion-body bg-light">
                            ${generarTablaNotas(notas)}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error al cargar calificaciones:', error);
        container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

/**
 * Función auxiliar para generar la tabla interna de notas
 */
function generarTablaNotas(notas) {
    if (!notas || notas.length === 0) {
        return '<p class="text-muted text-center fst-italic mb-0">No hay notas registradas para esta materia.</p>';
    }

    // Ordenamos las notas por fecha descendente (la más nueva arriba)
    notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    let filas = '';
    notas.forEach(nota => {
        const badgeColor = nota.nota >= 6 ? 'success' : 'danger';
        const fechaFmt = new Date(nota.fecha).toLocaleDateString();
        
        filas += `
            <tr>
                <td>
                    <span class="fw-bold text-dark">${nota.tipo_evaluacion || 'Examen'}</span>
                    <br>
                    <small class="text-muted">${nota.periodo || '-'}</small>
                </td>
                <td class="text-muted small align-middle">${fechaFmt}</td>
                <td class="text-muted small align-middle fst-italic">${nota.observaciones || '-'}</td>
                <td class="text-end align-middle">
                    <span class="badge bg-${badgeColor} fs-6">${nota.nota}</span>
                </td>
            </tr>
        `;
    });

    return `
        <div class="table-responsive bg-white rounded shadow-sm border">
            <table class="table table-borderless mb-0 table-hover">
                <thead class="table-light border-bottom">
                    <tr class="small text-uppercase text-muted">
                        <th>Evaluación</th>
                        <th>Fecha</th>
                        <th>Observación</th>
                        <th class="text-end">Nota</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Carga las asistencias del alumno desde Supabase
 */
async function cargarAsistencia() {
    const container = document.getElementById('asistencia-container');
    container.innerHTML = '<p class="text-center text-muted">Cargando asistencias...</p>';

    try {
        // Pedimos asistencias y unimos la materia. La RLS filtra por alumno.
        const { data: asistencias, error } = await supabase
            .from('asistencias')
            .select(`
                fecha,
                estado,
                inscripciones ( materias ( nombre_materia ) )
            `)
            .order('fecha', { ascending: false })
            .limit(50); // Traemos las últimas 50 asistencias

        if (error) throw error;

        if (!asistencias || asistencias.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No tienes registros de asistencia.</p>';
            return;
        }

        let html = `
            <table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Fecha</th>
                        <th>Materia</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;

        asistencias.forEach(asist => {
            const materia = asist.inscripciones?.materias?.nombre_materia || 'Materia no disponible';
            const estado = asist.estado;
            let badgeClass = 'text-secondary';
            if (estado === 'presente') badgeClass = 'text-success';
            if (estado === 'ausente') badgeClass = 'text-danger';
            if (estado === 'tarde') badgeClass = 'text-warning';

            html += `
                <tr>
                    <td>${new Date(asist.fecha).toLocaleDateString()}</td>
                    <td>${materia}</td>
                    <td>
                        <span class="fw-bold ${badgeClass}">${estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error al cargar asistencias:', error);
        container.innerHTML = `<p class="text-center text-danger">Error al cargar asistencias: ${error.message}</p>`;
    }
}
/**
 * Calcula y muestra las estadísticas en las tarjetas superiores y el resumen inferior
 */
async function cargarEstadisticasResumen() {
    if (!datosUsuarioActual) return;
    const idAlumno = datosUsuarioActual.id_usuario;
    const idGrado = datosUsuarioActual.alumnos.grado.id_grado;

    try {
        // 1. CALCULAR CANTIDAD DE MATERIAS
        const { count: cantidadMaterias } = await supabase
            .from('materias')
            .select('*', { count: 'exact', head: true })
            .eq('id_grado', idGrado);

        const elMaterias = document.getElementById('stat-cursos-valor');
        if (elMaterias) elMaterias.textContent = cantidadMaterias || 0;
        // También actualiza el resumen de abajo
        const elMateriasResumen = document.getElementById('summary-materias');
        if (elMateriasResumen) elMateriasResumen.textContent = cantidadMaterias || 0;


        // 2. CALCULAR PROMEDIO GENERAL
        // Traemos todas las calificaciones del alumno
        const { data: notas } = await supabase
            .from('calificaciones')
            .select('nota')
            // La RLS ya filtra por el usuario logueado, pero aseguramos el join si es necesario
            // o confiamos en la RLS que creamos: "Alumnos ven sus propias calificaciones"
            ;

        let promedioTexto = 'N/A';
        let mejorMateriaNota = 0;

        if (notas && notas.length > 0) {
            const suma = notas.reduce((acc, curr) => acc + curr.nota, 0);
            const promedio = (suma / notas.length).toFixed(1); // 1 decimal
            promedioTexto = promedio;
        }

        const elPromedio = document.getElementById('stat-promedio-valor');
        if (elPromedio) elPromedio.textContent = promedioTexto;
        // Resumen de abajo
        const elPromedioResumen = document.getElementById('summary-promedio');
        if (elPromedioResumen) elPromedioResumen.textContent = promedioTexto;


        // 3. CALCULAR PORCENTAJE DE ASISTENCIA
        // Traemos todas las asistencias del alumno
        const { data: asistencias } = await supabase
            .from('asistencias')
            .select('estado');

        let asistenciaTexto = 'N/A';

        if (asistencias && asistencias.length > 0) {
            const totalClases = asistencias.length;
            // Contamos cuántas veces dice 'presente'
            const totalPresentes = asistencias.filter(a => a.estado === 'presente').length;

            // Regla de 3 simple
            const porcentaje = Math.round((totalPresentes / totalClases) * 100);
            asistenciaTexto = `${porcentaje}%`;
        }

        const elAsistencia = document.getElementById('stat-asistencia-valor');
        if (elAsistencia) elAsistencia.textContent = asistenciaTexto;


        // 4. CALCULAR TAREAS PENDIENTES
        // Traemos tareas del grado y verificamos si NO están entregadas
        const { data: tareas } = await supabase
            .from('tareas')
            .select('id_tarea, entregas(id_entrega)')
            // La RLS "Alumnos ven tareas por su grado" se encarga del filtro
            ;

        let tareasPendientes = 0;
        if (tareas) {
            // Contamos las que tienen el array de entregas vacío
            tareasPendientes = tareas.filter(t => !t.entregas || t.entregas.length === 0).length;
        }

        const elTareas = document.getElementById('stat-tareas-valor');
        if (elTareas) elTareas.textContent = tareasPendientes;


        // 5. EXTRA: MEJOR MATERIA (Para el resumen de abajo)
        // Esto requeriría una consulta más compleja agrupando por materia,
        // por ahora podemos poner un guion o calcularlo si traemos las inscripciones.
        // Para simplificar y que no falle, dejaremos un valor por defecto o calcularemos simple.

        // Lógica rápida para Mejor Materia:
        // (Requeriría traer notas con materia, lo omitimos por simplicidad para no sobrecargar, 
        // pero actualizamos el DOM para que no diga N/A feo)
        const elMejorMateria = document.getElementById('summary-mejor-materia-val');
        if (elMejorMateria && promedioTexto !== 'N/A') {
            elMejorMateria.textContent = "-"; // O puedes poner "Ver Boleta"
        }

    } catch (error) {
        console.error("Error calculando estadísticas:", error);
    }
}

// Función para subir el certificado médico
async function handleSubirCertificado(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando...";

    // Obtener valores
    const fechaInicio = document.getElementById('cert-fecha-inicio').value;
    const fechaFin = document.getElementById('cert-fecha-fin').value;
    const archivo = document.getElementById('cert-archivo').files[0];
    const comentario = document.getElementById('cert-comentario').value;
    const userId = datosUsuarioActual.id_usuario;

    // Validaciones simples
    if (new Date(fechaInicio) > new Date(fechaFin)) {
        alert("La fecha de inicio no puede ser mayor a la fecha de fin.");
        btn.disabled = false;
        btn.textContent = originalText;
        return;
    }

    try {
        let filePath = null;
        if (archivo) {
            // Ruta: certificados/ID_ALUMNO/TIMESTAMP_NOMBRE
            filePath = `certificados/${userId}/${Date.now()}_${archivo.name}`;

            // Subir al bucket 'materiales' (o el que uses)
            const { error: uploadError } = await supabase.storage
                .from('materiales')
                .upload(filePath, archivo);

            if (uploadError) throw uploadError;
        }

        // Insertar en base de datos
        const { error: dbError } = await supabase
            .from('certificados_medicos')
            .insert({
                id_alumno: userId,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                archivo_path: filePath,
                comentario: comentario,
                estado: 'pendiente'
            });

        if (dbError) throw dbError;

        alert('¡Certificado enviado correctamente! Estará pendiente de revisión.');

        // Limpiar y cerrar
        const modalEl = document.getElementById('modalSubirCertificado');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        document.getElementById('form-subir-certificado').reset();

        // Recargar historial si implementas la función de ver historial
        cargarHistorialCertificados();

    } catch (error) {
        console.error(error);
        alert('Error al subir certificado: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// (Opcional) Función para mostrar los certificados que ya subió
async function cargarHistorialCertificados() {
    const container = document.getElementById('certificados-history-container');
    if (!container) return;

    const { data: certificados } = await supabase
        .from('certificados_medicos')
        .select('*')
        .eq('id_alumno', datosUsuarioActual.id_usuario)
        .order('created_at', { ascending: false });

    if (!certificados || certificados.length === 0) {
        container.innerHTML = '<small class="text-muted">No has enviado certificados aún.</small>';
        return;
    }

    let html = '<ul class="list-group list-group-flush">';
    certificados.forEach(cert => {
        let badgeColor = 'bg-warning'; // pendiente
        if (cert.estado === 'aprobado') badgeColor = 'bg-success';
        if (cert.estado === 'rechazado') badgeColor = 'bg-danger';

        html += `
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                <div>
                    <small class="d-block fw-bold">Del ${cert.fecha_inicio} al ${cert.fecha_fin}</small>
                    <small class="text-muted">${cert.comentario || 'Sin comentario'}</small>
                </div>
                <span class="badge ${badgeColor}">${cert.estado.toUpperCase()}</span>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

/**
 * Carga las tareas del alumno (VERSIÓN SEGURA CON SIGNED URL)
 */
async function cargarTareas() {
    const container = document.getElementById('tareas-container');
    container.innerHTML = '<div class="text-center text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando...</div>';

    try {
        if (!datosUsuarioActual || !datosUsuarioActual.alumnos) throw new Error("No se identificó al alumno.");

        // Traemos también los datos del tutor para armar el mensaje
        const telefonoTutor = datosUsuarioActual.alumnos.tutor_telefono;
        const nombreAlumno = datosUsuarioActual.nombre;

        const { data: tareas, error } = await supabase
            .from('tareas')
            .select(`
                id_tarea, titulo, descripcion, fecha_entrega, puntaje_maximo, archivo_path,
                materias ( nombre_materia ),
                entregas ( id_entrega ) 
            `)
            .order('fecha_entrega', { ascending: true });

        if (error) throw error;

        if (!tareas || tareas.length === 0) {
            container.innerHTML = '<div class="list-group-item text-center text-muted">¡No tienes tareas pendientes para tu grado!</div>';
            return;
        }

        let html = '';

        for (const tarea of tareas) {
            const yaEntrego = tarea.entregas && tarea.entregas.length > 0;
            const hoy = new Date();
            const fechaEntrega = new Date(tarea.fecha_entrega);
            // Resetear horas para comparar solo fechas
            hoy.setHours(0,0,0,0);
            const fechaEntregaSinHora = new Date(fechaEntrega);
            fechaEntregaSinHora.setHours(0,0,0,0);

            const estaVencida = !yaEntrego && (fechaEntregaSinHora < hoy);
            
            let botonAccion = '';
            let estadoClase = '';
            let mensajeVencido = '';

            if (yaEntrego) {
                botonAccion = `<button class="btn btn-success btn-sm" disabled><i class="fas fa-check"></i> Entregado</button>`;
            } else if (estaVencida) {
                // TAREA VENCIDA
                estadoClase = 'border-danger border-start border-4'; // Borde rojo
                
                // Lógica de WhatsApp
                if (telefonoTutor) {
                    const mensaje = `Hola, soy el sistema del Colegio. Informamos que el alumno ${nombreAlumno} tiene vencida la tarea "${tarea.titulo}" de ${tarea.materias?.nombre_materia}. Fecha límite fue: ${fechaEntrega.toLocaleDateString()}. Por favor regularizar.`;
                    const linkWsp = `https://wa.me/${telefonoTutor}?text=${encodeURIComponent(mensaje)}`;
                    
                    mensajeVencido = `
                        <div class="alert alert-danger d-flex align-items-center justify-content-between mt-2 py-2 mb-0">
                            <small><i class="fas fa-exclamation-circle"></i> Tarea Vencida</small>
                            <a href="${linkWsp}" target="_blank" class="btn btn-outline-danger btn-sm" style="font-size: 0.75rem;">
                                <i class="fab fa-whatsapp"></i> Notificar Tutor
                            </a>
                        </div>
                    `;
                } else {
                    mensajeVencido = `<div class="text-danger small mt-2"><i class="fas fa-exclamation-circle"></i> Vencida (Cargue tel. tutor en perfil para notificar)</div>`;
                }

                // Aún permitimos subir, pero con advertencia
                botonAccion = `<button class="btn btn-primary btn-sm btn-subir-entrega" data-id="${tarea.id_tarea}">Subir Atrasado</button>`;
            
            } else {
                // Tarea normal
                botonAccion = `<button class="btn btn-primary btn-sm btn-subir-entrega" data-id="${tarea.id_tarea}">Subir Respuesta</button>`;
            }

            // Descarga de material
            let btnDescarga = '';
            if (tarea.archivo_path) {
                const { data: signedData } = await supabase.storage.from('materiales').createSignedUrl(tarea.archivo_path, 3600);
                if (signedData) {
                    btnDescarga = `<a href="${signedData.signedUrl}" target="_blank" class="btn btn-outline-secondary btn-sm me-2"><i class="fas fa-download"></i> Material</a>`;
                }
            }

            html += `
                <div class="list-group-item list-group-item-action mb-3 shadow-sm rounded ${estadoClase}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 fw-bold">${tarea.titulo} <span class="badge bg-info text-dark">${tarea.materias?.nombre_materia || 'Materia'}</span></h6>
                        <small class="${estaVencida ? 'text-danger fw-bold' : 'text-muted'}">
                            Vence: ${new Date(tarea.fecha_entrega).toLocaleDateString()}
                        </small>
                    </div>
                    <p class="mb-1 small">${tarea.descripcion || 'Sin descripción.'}</p>
                    
                    ${mensajeVencido}

                    <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                        <span class="badge bg-light text-dark border">Pts: ${tarea.puntaje_maximo}</span>
                        <div>
                            ${btnDescarga}
                            ${botonAccion}
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Listeners
        document.querySelectorAll('.btn-subir-entrega').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                document.getElementById('entrega-id-tarea').value = id;
                const modal = new bootstrap.Modal(document.getElementById('modalSubirEntrega'));
                modal.show();
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

// Función para enviar la entrega a Supabase
async function handleSubirEntrega(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Subiendo...";

    const idTarea = document.getElementById('entrega-id-tarea').value;
    const archivo = document.getElementById('entrega-archivo').files[0];
    const comentario = document.getElementById('entrega-comentario').value;
    const userId = datosUsuarioActual.id_usuario;

    try {
        let filePath = null;
        if (archivo) {
            // Subir archivo: entregas/ID_ALUMNO/ID_TAREA_NOMBRE.ext
            filePath = `entregas/${userId}/${idTarea}_${Date.now()}_${archivo.name}`;
            const { error: uploadError } = await supabase.storage
                .from('materiales')
                .upload(filePath, archivo);
            if (uploadError) throw uploadError;
        }

        const { error: dbError } = await supabase
            .from('entregas')
            .insert({
                id_tarea: idTarea,
                id_alumno: userId,
                archivo_path: filePath,
                comentario_alumno: comentario
            });

        if (dbError) throw dbError;

        alert('¡Tarea entregada con éxito!');

        // Cerrar modal y recargar
        const modalEl = document.getElementById('modalSubirEntrega');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        document.getElementById('form-subir-entrega').reset();
        cargarTareas();

    } catch (error) {
        console.error(error);
        alert('Error al entregar: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
/**
 * Función principal que se ejecuta cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', () => {
    const cleanPhone = (num) => {
        if (!num) return '';
        return num.toString().replace(/^549/, '');
    };
    // Iniciar la carga de datos generales
    cargarDatosEstudiante();

    // 1. Referencias al DOM
    const modalEditarPerfil = document.getElementById('modalEditarPerfil');
    const formEditarPerfil = document.getElementById('formEditarPerfil');
    const formEntrega = document.getElementById('form-subir-entrega');
    const formCertificado = document.getElementById('form-subir-certificado');
    const btnLogout = document.getElementById('btn-logout');
    
    // Referencias a las Pestañas
    const tabAsistencia = document.getElementById('asistencia-tab');
    const tabHorario = document.getElementById('horario-tab');
    const tabCalificaciones = document.getElementById('calificaciones-tab');
    const tabTareas = document.getElementById('tareas-tab');
    

    // 2. Listeners Generales (Botones y Formularios)
    if (btnLogout) {
        btnLogout.addEventListener('click', handleLogout);
    }
    if (formEntrega) {
        formEntrega.addEventListener('submit', handleSubirEntrega);
    }
    if (formEditarPerfil) {
        formEditarPerfil.addEventListener('submit', guardarCambiosPerfil);
    }
    // Nuevo: Listener para subir certificado
    if (formCertificado) {
        formCertificado.addEventListener('submit', handleSubirCertificado);
    }

    // 3. Lógica de Pestañas (Tabs)

    // Pestaña: ASISTENCIA (Combinada: Carga asistencia y certificados)
    if (tabAsistencia) {
        tabAsistencia.addEventListener('shown.bs.tab', () => {
            if (datosUsuarioActual) {
                cargarAsistencia();
                cargarHistorialCertificados(); // <--- Ahora carga ambas cosas
            }
        }); 
        // Nota: Se quitó {once: true} para que actualice los datos cada vez que entras a la pestaña
    }

    // Pestaña: HORARIO
    if (tabHorario) {
        tabHorario.addEventListener('shown.bs.tab', () => {
            if (datosUsuarioActual && datosUsuarioActual.alumnos && datosUsuarioActual.alumnos.grado) {
                const idGrado = datosUsuarioActual.alumnos.grado.id_grado;
                cargarHorarioGrid(idGrado);
            } else {
                console.warn("No se pudieron cargar los datos del alumno para ver el horario.");
                const contenedorHorario = document.getElementById('contenedor-horario');
                if(contenedorHorario) {
                    contenedorHorario.innerHTML = '<p class="text-danger p-4">No se pudo identificar tu grado para cargar el horario. <br>Por favor, asigna un grado a este alumno en la pestaña "Perfil".</p>';
                }
            }
        }, { once: true });
    }

    // Pestaña: CALIFICACIONES
    if (tabCalificaciones) {
        tabCalificaciones.addEventListener('shown.bs.tab', () => {
            if (datosUsuarioActual) {
                cargarCalificaciones();
            }
        }, { once: true });
    }

    // Pestaña: TAREAS
    if (tabTareas) {
        tabTareas.addEventListener('shown.bs.tab', () => {
            if (datosUsuarioActual) {
                cargarTareas();
            }
        }, { once: true });
    }

    // 4. Lógica del Modal de Perfil (Carga de datos al abrir)
    if (modalEditarPerfil) {
        modalEditarPerfil.addEventListener('show.bs.modal', async () => {
            // Carga los grados en el dropdown ANTES de rellenar
            await poblarDropdownGrados('input-grado-modal');

            if (datosUsuarioActual) {
                const alumnoInfo = datosUsuarioActual.alumnos || {};

                document.getElementById('input-nombre-modal').value = datosUsuarioActual.nombre || '';
                document.getElementById('input-apellido-modal').value = datosUsuarioActual.apellido || '';
                document.getElementById('input-dni-modal').value = datosUsuarioActual.dni || '';
                document.getElementById('input-telefono-modal').value = alumnoInfo.telefono || '';
                document.getElementById('input-fecha-nacimiento-modal').value = alumnoInfo.fecha_nacimiento || '';
                document.getElementById('input-direccion-modal').value = alumnoInfo.direccion || '';
                document.getElementById('input-tutor-nombre-modal').value = alumnoInfo.tutor_nombre || '';
                document.getElementById('input-tutor-telefono').value = cleanPhone(alumnoInfo.tutor_telefono);
                document.getElementById('input-tutor-educacion-modal').value = alumnoInfo.tutor_educacion || '';
                document.getElementById('input-tutor-trabajo-modal').value = alumnoInfo.tutor_trabajo || '';
                document.getElementById('input-tutor-email').value = alumnoInfo.tutor_email || '';
                // Selecciona el grado actual del alumno
                if (alumnoInfo.grado) {
                    document.getElementById('input-grado-modal').value = alumnoInfo.grado.id_grado;
                }

                // Rellenar campos CUD y lógica de visibilidad
                const selectorCud = document.getElementById('input-cud-tiene');
                const detallesCud = document.getElementById('cud-detalles-container');

                // Rellenar los campos
                if(selectorCud) selectorCud.value = alumnoInfo.tiene_cud ? 'true' : 'false';
                document.getElementById('input-cud-diagnostico').value = alumnoInfo.cud_diagnostico || '';
                document.getElementById('input-cud-vencimiento').value = alumnoInfo.cud_vencimiento || '';

                // Mostrar/ocultar el contenedor basado en el valor
                if(detallesCud) detallesCud.style.display = alumnoInfo.tiene_cud ? 'block' : 'none';

            } else {
                console.error("No se pudieron cargar los datos del usuario para editar.");
            }
        });
    }

    // Listener para el cambio en el dropdown de CUD (dentro del modal)
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
});