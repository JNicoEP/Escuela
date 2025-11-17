// Importar el cliente de Supabase y la función de mensajes
// Asegúrate que la ruta a tu archivo 'supabaseClient.js' sea correcta
import { supabase, showMessage } from './supabaseClient.js';

// --- VARIABLES GLOBALES ---
let currentUser = null; // Guardará el objeto 'user' de Supabase Auth
let currentDocenteId = null; // Guardará el UUID del docente
let bootstrap = window.bootstrap; // Acceso global a Bootstrap

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkUserSession();

    if (currentUser) {
        setupEventListeners();
        setupTabLogic();
        loadAllData();
    }
});

// --- AUTENTICACIÓN Y SESIÓN ---

/**
 * Verifica la sesión activa del usuario.
 * Si no hay sesión, redirige al login.
 * Si hay sesión, guarda los datos del usuario.
 */
async function checkUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error al obtener la sesión:', error);
        return;
    }

    if (!session) {
        // No hay sesión, redirigir a la página de login
        // Cambia '/index.html' por tu página de inicio de sesión
        window.location.href = '/index.html';
        return;
    }

    currentUser = session.user;
    currentDocenteId = currentUser.id; // Asumiendo que el auth.user.id es el id_docente

    // Actualizar la UI del header
    const userEmail = currentUser.email;
    document.getElementById('user-name-display').textContent = currentUser.user_metadata?.nombre || userEmail;

    const initials = (currentUser.user_metadata?.nombre?.[0] || '') + (currentUser.user_metadata?.apellido?.[0] || '');
    document.getElementById('user-initials-display').textContent = initials || userEmail[0].toUpperCase();
}

/**
 * Cierra la sesión del usuario y redirige al login.
 */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showMessage('Error al cerrar sesión: ' + error.message, 'Error');
    } else {
        window.location.href = '/login.html'; // Redirigir al login
    }
}

// --- LÓGICA DE NAVEGACIÓN (PESTAÑAS) ---

function setupTabLogic() {
    const tabLinks = document.querySelectorAll('#mainTabs .nav-link');
    const tabPanes = document.querySelectorAll('#mainTabsContent .tab-pane');

    tabLinks.forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();

            const targetId = this.getAttribute('data-target');

            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            document.querySelector(targetId).classList.add('active');
            this.classList.add('active');
        });
    });
}

// --- CONFIGURACIÓN DE EVENT LISTENERS ---

function setupEventListeners() {
    // Botón de Logout
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Formulario: Agregar Materia (NUEVO)
    document.getElementById('form-agregar-materia').addEventListener('submit', handleAgregarMateria);

    // Formulario: Crear Tarea
    // ! VER NOTA IMPORTANTE AL FINAL SOBRE LA TABLA 'tareas'
    document.getElementById('form-crear-tarea').addEventListener('submit', handleCrearTarea);

    // Formulario: Registrar Calificación
    document.getElementById('form-registrar-calificacion').addEventListener('submit', handleRegistrarCalificacion);

    // Formulario: Guardar Asistencia
    document.getElementById('form-control-asistencia').addEventListener('submit', handleGuardarAsistencia);

    // Formulario: Enviar Mensaje
    document.getElementById('form-redactar-mensaje').addEventListener('submit', handleEnviarMensaje);

    // Selects dinámicos (que cargan otros selects)
    document.getElementById('califMateria').addEventListener('change', (e) => loadEstudiantesParaSelect(e.target.value, 'califInscripcion'));

    // Selects que cargan listas
    document.getElementById('califSelectMateriaVer').addEventListener('change', (e) => loadCalificaciones(e.target.value));

    const asistenciaMateria = document.getElementById('asistenciaMateria');
    const asistenciaFecha = document.getElementById('asistenciaFecha');
    asistenciaMateria.addEventListener('change', () => loadEstudiantesParaAsistencia(asistenciaMateria.value, asistenciaFecha.value));
    asistenciaFecha.addEventListener('change', () => loadEstudiantesParaAsistencia(asistenciaMateria.value, asistenciaFecha.value));

    // Botones "Marcar Todos" en Asistencia
    document.getElementById('btn-marcar-presente').addEventListener('click', () => marcarTodosAsistencia('presente'));
    document.getElementById('btn-marcar-ausente').addEventListener('click', () => marcarTodosAsistencia('ausente'));
}

// --- CARGA DE DATOS INICIAL ---

/**
 * Carga todos los datos necesarios para el panel.
 */
async function loadAllData() {
    loadDashboardData(); // Cargar tarjetas de resumen
    loadCursosYMaterias(); // Cargar "Mis Cursos"
    loadTareas(); // Cargar lista de tareas
    // loadCalificaciones() se llama al cambiar el select
    loadMensajes(); // Cargar mensajes recibidos y enviados
    loadAllSelects(); // Cargar opciones de todos los dropdowns
}

/**
 * Carga los datos de resumen del Dashboard.
 */
async function loadDashboardData() {
    // 1. Conteo de Materias (Mis Cursos)
    const { count: materiasCount } = await supabase
        .from('materias')
        .select('*', { count: 'exact', head: true })
        .eq('id_docente', currentDocenteId);
    document.getElementById('summary-cursos').textContent = materiasCount || 0;

    // 2. Conteo de Estudiantes (total de inscripciones únicas)
    // Esto es más complejo, podría requerir una función RPC en Supabase
    // Por ahora, lo dejamos en 0
    document.getElementById('summary-estudiantes').textContent = '...';

    // 3. Conteo de Tareas Activas
    // ! Depende de la tabla 'tareas' que no existe
    document.getElementById('summary-tareas').textContent = '...';

    // 4. Conteo por Calificar
    // ! Depende de una lógica de entregas que no está en el schema
    document.getElementById('summary-calificar').textContent = '...';

    // 5. Actividad Reciente (ejemplo)
    const { data: ultimasCalificaciones } = await supabase
        .from('calificaciones')
        .select('tipo_evaluacion, fecha, inscripciones(materias(nombre_materia))')
        .limit(3)
        .order('fecha', { ascending: false }); // Faltaría filtrar por docente

    const container = document.getElementById('actividad-reciente-container');
    container.innerHTML = '';
    if (ultimasCalificaciones && ultimasCalificaciones.length > 0) {
        ultimasCalificaciones.forEach(act => {
            container.innerHTML += `
                <li class="list-group-item">
                    <span class="activity-icon icon-calificar"><i class="bi bi-patch-check-fill"></i></span>
                    <div>
                        <div class="fw-bold">Calificación registrada</div>
                        <div class="small text-muted">${act.tipo_evaluacion} en ${act.inscripciones.materias.nombre_materia} - ${new Date(act.fecha).toLocaleDateString()}</div>
                    </div>
                </li>
            `;
        });
    } else {
        container.innerHTML = '<div class="list-group-item text-muted">No hay actividad reciente.</div>';
    }
}

/**
 * Carga todos los dropdowns (selects) de los formularios.
 */
async function loadAllSelects() {
    // 1. Cargar TODOS los grados (para el modal "Agregar Materia")
    const { data: grados, error: errorGrados } = await supabase
        .from('grado')
        .select('id_grado, nombre_grado')
        .order('id_grado'); // Opcional: para ordenarlos 1°, 2°, 3°...

    if (errorGrados) {
        console.error('Error cargando grados:', errorGrados);
    }

    if (grados) {
        const selectGrado = document.getElementById('materiaGrado');
        selectGrado.innerHTML = '<option value="">Seleccione un grado</option>';
        grados.forEach(item => {
            // La estructura de 'item' es simple ahora: item.id_grado, item.nombre_grado
            selectGrado.innerHTML += `<option value="${item.id_grado}">${item.nombre_grado}</option>`;
        });
    }

    // 2. Cargar Materias asignadas al docente (para Tareas, Calificaciones, Asistencia)
    const { data: materias, error: errorMaterias } = await supabase
        .from('materias')
        .select('id_materia, nombre_materia, grado(nombre_grado)')
        .eq('id_docente', currentDocenteId);

    if (materias) {
        const selects = document.querySelectorAll('#tareaMateria, #califMateria, #asistenciaMateria, #califSelectMateriaVer');
        selects.forEach(select => {
            select.innerHTML = '<option value="">Seleccione una materia</option>';
            materias.forEach(materia => {
                select.innerHTML += `<option value="${materia.id_materia}">${materia.nombre_materia} (${materia.grado.nombre_grado})</option>`;
            });
        });
    }

    // 3. Cargar Destinatarios (Padres) para Mensajes
    // Asumimos que los padres tienen un rol específico (ej: id_rol = 3)
    const { data: padres, error: errorPadres } = await supabase
        .from('usuarios')
        .select('id_usuario, nombre, apellido')
        .eq('id_rol', 3); // ! Asunción: 3 es el id_rol de "Padre/Tutor"

    if (padres) {
        const selectPadres = document.getElementById('msgDestinatario');
        selectPadres.innerHTML = '<option value="">Seleccione un destinatario</option>';
        padres.forEach(padre => {
            selectPadres.innerHTML += `<option value="${padre.id_usuario}">${padre.nombre} ${padre.apellido}</option>`;
        });
    }
}

/**
 * Carga los estudiantes inscritos en una materia en un select.
 * @param {string} id_materia - El ID de la materia.
 * @param {string} selectId - El ID del <select> a poblar.
 */
async function loadEstudiantesParaSelect(id_materia, selectId) {
    const selectEstudiante = document.getElementById(selectId);
    if (!id_materia) {
        selectEstudiante.innerHTML = '<option value="">Seleccione una materia primero</option>';
        selectEstudiante.disabled = true;
        return;
    }

    const { data: inscripciones, error } = await supabase
        .from('inscripciones')
        .select('id_inscripcion, alumnos(usuarios(nombre, apellido)))')
        .eq('id_materia', id_materia);

    if (error) {
        showMessage('Error cargando estudiantes: ' + error.message, 'Error');
        return;
    }

    if (inscripciones && inscripciones.length > 0) {
        selectEstudiante.innerHTML = '<option value="">Seleccione un estudiante</option>';
        inscripciones.forEach(insc => {
            selectEstudiante.innerHTML += `<option value="${insc.id_inscripcion}">
                ${insc.alumnos.usuarios.nombre} ${insc.alumnos.usuarios.apellido}
            </option>`;
        });
        selectEstudiante.disabled = false;
    } else {
        selectEstudiante.innerHTML = '<option value="">No hay estudiantes inscritos</option>';
        selectEstudiante.disabled = true;
    }
}

// --- PESTAÑA 2: MIS CURSOS ---

/**
 * Carga las tarjetas de Cursos/Materias del docente.
 */
async function loadCursosYMaterias() {
    const container = document.getElementById('cursos-container');
    container.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>';

    const { data: materias, error } = await supabase
        .from('materias')
        .select('id_materia, nombre_materia, descripcion, grado(nombre_grado)')
        .eq('id_docente', currentDocenteId);

    if (error) {
        container.innerHTML = `<div class="alert alert-danger">Error al cargar materias: ${error.message}</div>`;
        return;
    }

    container.innerHTML = '';
    if (materias && materias.length > 0) {
        materias.forEach(materia => {
            container.innerHTML += `
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h5 class="card-title">${materia.nombre_materia}</h5>
                                <span class="badge bg-success-subtle text-success-emphasis">${materia.grado.nombre_grado}</span>
                            </div>
                            <p class="card-text">${materia.descripcion || 'Sin descripción.'}</p>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        container.innerHTML = '<div class="col-12"><div class="alert alert-info">Aún no tienes materias asignadas. Agrega una usando el botón "+ Agregar Materia".</div></div>';
    }
}

/**
 * Maneja el envío del formulario para agregar una nueva materia.
 */
async function handleAgregarMateria(e) {
    e.preventDefault();
    const form = e.target;
    const nombre = form.materiaNombre.value;
    const descripcion = form.materiaDescripcion.value;
    const id_grado = form.materiaGrado.value;

    const { error } = await supabase
        .from('materias')
        .insert({
            nombre_materia: nombre,
            descripcion: descripcion,
            id_grado: id_grado,
            id_docente: currentDocenteId
        });

    if (error) {
        showMessage('Error al agregar materia: ' + error.message, 'Error');
    } else {
        showMessage('Materia agregada exitosamente.', 'Éxito');
        form.reset();
        bootstrap.Modal.getInstance(document.getElementById('modalAgregarMateria')).hide();
        loadCursosYMaterias(); // Recargar la lista de cursos
        loadAllSelects(); // Recargar los selects
    }
}

// --- PESTAÑA 3: TAREAS ---
// ! NOTA: ESTO ASUME UNA TABLA 'tareas' QUE NO ESTÁ EN TU SCHEMA
// ! Deberás crearla en Supabase.

async function handleCrearTarea(e) {
    e.preventDefault();
    const form = e.target;
    const file = form.tareaArchivo.files[0];
    let filePath = null;

    if (file) {
        // 1. Subir archivo si existe
        filePath = `tareas/${currentDocenteId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('materiales') // Usamos el bucket 'materiales'
            .upload(filePath, file);

        if (uploadError) {
            showMessage('Error al subir el archivo: ' + uploadError.message, 'Error');
            return;
        }
    }

    // 2. Insertar en la tabla 'tareas' (tabla hipotética)
    const { error: insertError } = await supabase
        .from('tareas') // ! TABLA HIPOTÉTICA
        .insert({
            id_materia: form.tareaMateria.value,
            id_docente: currentDocenteId,
            titulo: form.tareaTitulo.value,
            descripcion: form.tareaDescripcion.value,
            fecha_entrega: form.tareaFechaEntrega.value,
            puntaje_maximo: form.tareaPuntaje.value,
            archivo_path: filePath // Guardamos la ruta del archivo
        });

    if (insertError) {
        showMessage('Error al crear la tarea: ' + insertError.message, 'Error');
    } else {
        showMessage('Tarea creada exitosamente.', 'Éxito');
        form.reset();
        bootstrap.Collapse.getInstance(document.getElementById('collapseCrearTarea')).hide();
        loadTareas(); // Recargar lista de tareas
    }
}

async function loadTareas() {
    const container = document.getElementById('tareas-container');
    container.innerHTML = '<div class="text-center text-muted">Cargando tareas...</div>';

    // ! Usando la tabla 'tareas' (HIPOTÉTICA)
    const { data, error } = await supabase
        .from('tareas') // ! TABLA HIPOTÉTICA
        .select('*, materias(nombre_materia)')
        .eq('id_docente', currentDocenteId)
        .order('fecha_entrega', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="alert alert-warning">No se pudo cargar tareas. (Asegúrate de tener una tabla 'tareas' en tu DB): ${error.message}</div>`;
        return;
    }

    container.innerHTML = '';
    if (data && data.length > 0) {
        data.forEach(tarea => {
            container.innerHTML += `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h4 class="h6">${tarea.titulo}</h4>
                                <p class="text-muted small mb-2">${tarea.descripcion || 'Sin descripción'}</p>
                                <span class="badge bg-success-subtle text-success-emphasis">${tarea.materias.nombre_materia}</span>
                            </div>
                            <a href="#" class="btn btn-outline-secondary btn-sm">Ver Entregas</a>
                        </div>
                        <hr>
                        <div class="d-flex justify-content-between align-items-center text-muted small">
                            <span><i class="bi bi-calendar-check me-1"></i> <strong>Entrega:</strong> ${new Date(tarea.fecha_entrega).toLocaleDateString()}</span>
                            <span class="fw-bold text-primary">${tarea.puntaje_maximo} pts</span>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        container.innerHTML = '<div class="alert alert-info">No hay tareas asignadas.</div>';
    }
}

// --- PESTAÑA 4: CALIFICACIONES ---

// --- PESTAÑA 4: CALIFICACIONES ---

async function handleRegistrarCalificacion(e) {
    e.preventDefault();
    const form = e.target;

    // CORREGIDO: Ahora 'periodo' y 'observaciones' se guardan en sus columnas correctas.
    const { error } = await supabase
        .from('calificaciones')
        .insert({
            id_inscripcion: form.califInscripcion.value,
            nota: form.califNota.value,
            tipo_evaluacion: form.califTipo.value,
            periodo: form.califPeriodo.value, // <-- CORRECCIÓN
            observaciones: form.califObservaciones.value, // <-- CORRECCIÓN
            fecha: new Date()
        });

    if (error) {
        showMessage('Error al registrar calificación: ' + error.message, 'Error');
    } else {
        showMessage('Calificación registrada exitosamente.', 'Éxito');
        form.reset();
        bootstrap.Collapse.getInstance(document.getElementById('collapseRegistrarCalificacion')).hide();
        // Recargar la lista de calificaciones de esa materia
        loadCalificaciones(document.getElementById('califSelectMateriaVer').value);
    }
}

async function loadCalificaciones(id_materia) {
    const container = document.getElementById('calificaciones-container');
    if (!id_materia) {
        container.innerHTML = '<div class="text-center text-muted">Seleccione una materia para ver las calificaciones.</div>';
        return;
    }

    container.innerHTML = '<div class="text-center text-muted">Cargando calificaciones...</div>';

    // 1. Obtener inscripciones de esa materia
    const { data: inscripciones, error } = await supabase
        .from('inscripciones')
        .select('id_inscripcion, alumnos(usuarios(nombre, apellido)), calificaciones(*)')
        .eq('id_materia', id_materia);

    if (error) {
        container.innerHTML = `<div class="alert alert-danger">Error al cargar calificaciones: ${error.message}</div>`;
        return;
    }

    container.innerHTML = '';
    if (inscripciones && inscripciones.length > 0) {
        inscripciones.forEach(insc => {
            const alumno = insc.alumnos.usuarios;
            const calificaciones = insc.calificaciones;

            // Calcular promedio
            let total = 0;
            calificaciones.forEach(c => total += c.nota);
            const promedio = calificaciones.length > 0 ? (total / calificaciones.length).toFixed(1) : 'N/A';
            const promedioColor = promedio >= 60 ? 'text-success' : 'text-danger';

            // Renderizar calificaciones individuales
            let calificacionesHtml = '';
            if (calificaciones.length > 0) {
                calificaciones.forEach(c => {
                    calificacionesHtml += `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <div class="fw-bold">${c.tipo_evaluacion}</div>
                                <div class="small text-muted">${new Date(c.fecha).toLocaleDateString()} - ${c.observaciones || ''}</div>
                            </div>
                            <span class="badge ${c.nota >= 60 ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'} fs-5">${c.nota}</span>
                        </div>
                    `;
                });
            } else {
                calificacionesHtml = '<div class="small text-muted">Sin calificaciones registradas.</div>';
            }

            // Renderizar tarjeta del alumno
            container.innerHTML += `
                <div class="card mb-3">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-3">
                                <div>
                                    <div class="fw-bold fs-5">${alumno.nombre} ${alumno.apellido}</div>
                                </div>
                            </div>
                            <div class="border ${promedioColor} rounded p-2">
                                <span class="fw-bold fs-5">Promedio: ${promedio}</span>
                            </div>
                        </div>
                        <hr>
                        ${calificacionesHtml}
                    </div>
                </div>
            `;
        });
    } else {
        container.innerHTML = '<div class="alert alert-info">No hay estudiantes inscritos en esta materia.</div>';
    }
}

// --- PESTAÑA 5: ASISTENCIA ---

async function loadEstudiantesParaAsistencia(id_materia, fecha) {
    const container = document.getElementById('asistencia-lista-alumnos');
    if (!id_materia || !fecha) {
        container.innerHTML = '<div class="p-3 text-center text-muted">Seleccione una materia y fecha.</div>';
        document.getElementById('asistencia-conteo-alumnos').textContent = '0 estudiantes';
        return;
    }

    container.innerHTML = '<div class="p-3 text-center text-muted">Cargando estudiantes...</div>';

    // 1. Obtener estudiantes inscritos
    const { data: inscripciones, error: errorInsc } = await supabase
        .from('inscripciones')
        .select('id_inscripcion, alumnos(usuarios(nombre, apellido)))')
        .eq('id_materia', id_materia);

    if (errorInsc) {
        container.innerHTML = `<div class="p-3 alert alert-danger">Error: ${errorInsc.message}</div>`;
        return;
    }

    if (!inscripciones || inscripciones.length === 0) {
        container.innerHTML = '<div class="p-3 alert alert-info">No hay estudiantes en esta materia.</div>';
        return;
    }

    // 2. Obtener asistencias YA registradas para esa fecha
    const idsInscripcion = inscripciones.map(i => i.id_inscripcion);
    const { data: asistencias, error: errorAsis } = await supabase
        .from('asistencias')
        .select('id_inscripcion, estado')
        .eq('fecha', fecha)
        .in('id_inscripcion', idsInscripcion);

    // Mapear asistencias para búsqueda rápida
    const mapaAsistencias = new Map();
    if (asistencias) {
        asistencias.forEach(a => mapaAsistencias.set(a.id_inscripcion, a.estado));
    }

    // 3. Renderizar lista
    container.innerHTML = '';
    document.getElementById('asistencia-conteo-alumnos').textContent = `${inscripciones.length} estudiantes`;

    inscripciones.forEach(insc => {
        const alumno = insc.alumnos.usuarios;
        const id_insc = insc.id_inscripcion;
        const estadoActual = mapaAsistencias.get(id_insc);

        container.innerHTML += `
            <div class="student-attendance-row" data-id-inscripcion="${id_insc}">
                <div class="d-flex align-items-center gap-3">
                    <div>
                        <div class="fw-bold">${alumno.nombre} ${alumno.apellido}</div>
                    </div>
                </div>
                <div class="btn-group attendance-status-buttons" role="group">
                    <input type="radio" class="btn-check" name="status-${id_insc}" id="status-p-${id_insc}" value="presente" ${estadoActual === 'presente' ? 'checked' : ''}>
                    <label class="btn btn-outline-success" for="status-p-${id_insc}"><i class="bi bi-check-circle"></i> Presente</label>

                    <input type="radio" class="btn-check" name="status-${id_insc}" id="status-a-${id_insc}" value="ausente" ${estadoActual === 'ausente' ? 'checked' : ''}>
                    <label class="btn btn-outline-danger" for="status-a-${id_insc}"><i class="bi bi-x-circle"></i> Ausente</label>

                    <input type="radio" class="btn-check" name="status-${id_insc}" id="status-t-${id_insc}" value="tarde" ${estadoActual === 'tarde' ? 'checked' : ''}>
                    <label class="btn btn-outline-warning" for="status-t-${id_insc}"><i class="bi bi-clock"></i> Tarde</label>

                    <input type="radio" class="btn-check" name="status-${id_insc}" id="status-j-${id_insc}" value="justificado" ${estadoActual === 'justificado' ? 'checked' : ''}>
                    <label class="btn btn-outline-info" for="status-j-${id_insc}"><i class="bi bi-info-circle"></i> Justificado</label>
                </div>
            </div>
        `;
    });
}

async function handleGuardarAsistencia(e) {
    e.preventDefault();
    const fecha = document.getElementById('asistenciaFecha').value;
    if (!fecha) {
        showMessage('Por favor, seleccione una fecha.', 'Error');
        return;
    }

    const filas = document.querySelectorAll('#asistencia-lista-alumnos .student-attendance-row');
    if (filas.length === 0) {
        showMessage('No hay estudiantes para guardar asistencia.', 'Error');
        return;
    }

    const registrosParaGuardar = [];

    filas.forEach(fila => {
        const id_inscripcion = fila.dataset.idInscripcion;
        const radioChecked = fila.querySelector(`input[name="status-${id_inscripcion}"]:checked`);

        if (radioChecked) {
            registrosParaGuardar.push({
                id_inscripcion: id_inscripcion,
                fecha: fecha,
                estado: radioChecked.value
            });
        }
    });

    if (registrosParaGuardar.length === 0) {
        showMessage('No se ha marcado ninguna asistencia.', 'Aviso');
        return;
    }

    // Usar 'upsert' para insertar o actualizar si ya existe (por si modifican la asistencia)
    const { error } = await supabase
        .from('asistencias')
        .upsert(registrosParaGuardar, { onConflict: 'id_inscripcion, fecha' }); // Asume una restricción UNIQUE(id_inscripcion, fecha)

    if (error) {
        showMessage('Error al guardar asistencia: ' + error.message, 'Error');
    } else {
        showMessage('Asistencia guardada exitosamente.', 'Éxito');
    }
}

function marcarTodosAsistencia(estado) {
    const radios = document.querySelectorAll(`#asistencia-lista-alumnos input[value="${estado}"]`);
    radios.forEach(radio => radio.checked = true);
}


// --- PESTAÑA 6: MENSAJERÍA ---

async function loadMensajes() {
    const contRecibidos = document.getElementById('mensajes-recibidos');
    const contEnviados = document.getElementById('mensajes-enviados');

    contRecibidos.innerHTML = '<div class="list-group-item text-muted">Cargando...</div>';
    contEnviados.innerHTML = '<div class="list-group-item text-muted">Cargando...</div>';

    // 1. Cargar Recibidos
    const { data: recibidos, error: errorRec } = await supabase
        .from('mensajes')
        .select('*, sender:usuarios!mensajes_sender_id_fkey(nombre, apellido)')
        .eq('receiver_id', currentDocenteId)
        .order('created_at', { ascending: false });

    if (recibidos) {
        contRecibidos.innerHTML = '';
        if (recibidos.length > 0) {
            let unreadCount = 0;
            recibidos.forEach(msg => {
                if (!msg.is_read) unreadCount++;
                contRecibidos.innerHTML += `
                    <li class="list-group-item ${!msg.is_read ? 'fw-bold' : ''}">
                        <div class="message-header">
                            <span>De: ${msg.sender.nombre} ${msg.sender.apellido}</span>
                            <span class="small text-muted">${new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <div class="mt-1">${msg.asunto}</div>
                        <div class="message-snippet fw-normal">${msg.contenido}</div>
                    </li>
                `;
            });
            // Actualizar badge de mensajes
            const badge = document.getElementById('mensajes-badge');
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        } else {
            contRecibidos.innerHTML = '<div class="list-group-item text-muted">No tienes mensajes recibidos.</div>';
        }
    }

    // 2. Cargar Enviados
    const { data: enviados, error: errorEnv } = await supabase
        .from('mensajes')
        .select('*, receiver:usuarios!mensajes_receiver_id_fkey(nombre, apellido)')
        .eq('sender_id', currentDocenteId)
        .order('created_at', { ascending: false });

    if (enviados) {
        contEnviados.innerHTML = '';
        if (enviados.length > 0) {
            enviados.forEach(msg => {
                contEnviados.innerHTML += `
                    <li class="list-group-item">
                        <div class="message-header">
                            <span>Para: ${msg.receiver.nombre} ${msg.receiver.apellido}</span>
                            <span class="small text-muted">${new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <div class="mt-1">${msg.asunto}</div>
                        <div class="message-snippet">${msg.contenido}</div>
                    </li>
                `;
            });
        } else {
            contEnviados.innerHTML = '<div class="list-group-item text-muted">No tienes mensajes enviados.</div>';
        }
    }
}



async function handleEnviarMensaje(e) {
    e.preventDefault();
    const form = e.target;

    // CORREGIDO: 'asunto' y 'prioridad' ahora se guardan en sus columnas correctas.
    const { error } = await supabase
        .from('mensajes')
        .insert({
            sender_id: currentDocenteId,
            receiver_id: form.msgDestinatario.value,
            asunto: form.msgAsunto.value, // <-- CORRECCIÓN
            contenido: form.msgContenido.value,
            prioridad: form.msgPrioridad.value // <-- CORRECCIÓN
        });

    if (error) {
        showMessage('Error al enviar mensaje: ' + error.message, 'Error');
    } else {
        showMessage('Mensaje enviado exitosamente.', 'Éxito');
        form.reset();
        bootstrap.Collapse.getInstance(document.getElementById('collapseRedactarMensaje')).hide();
        loadMensajes(); // Recargar listas de mensajes
    }
}