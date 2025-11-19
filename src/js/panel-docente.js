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
        window.location.href = '/index.html';
        return;
    }

    currentUser = session.user;
    currentDocenteId = currentUser.id; 

    // --- CORRECCIÓN AQUÍ ---
    // 1. Definimos el email porque lo necesitamos para las iniciales de respaldo
    const userEmail = currentUser.email;

    // 2. Obtenemos nombre y apellido
    const nombre = currentUser.user_metadata?.nombre || '';
    const apellido = currentUser.user_metadata?.apellido || '';
    const nombreCompleto = `${nombre} ${apellido}`.trim();

    // 3. Mostramos SOLO el nombre (o 'Docente' si no tiene). NO el email.
    document.getElementById('user-name-display').textContent = nombreCompleto || 'Docente';

    // 4. Calculamos iniciales para el avatar
    // Si tiene nombre y apellido, usa sus iniciales. Si no, usa la primera letra del email.
    const initials = (nombre?.[0] || '') + (apellido?.[0] || '');
    document.getElementById('user-initials-display').textContent = (initials || userEmail[0] || 'D').toUpperCase();
}

/**
 * Cierra la sesión del usuario y redirige al login.
 */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showMessage('Error al cerrar sesión: ' + error.message, 'Error');
    } else {
        window.location.href = '/index.html'; // Redirigir al login
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
    // NUEVO: Listener para el formulario de edición
    const formEditar = document.getElementById('form-editar-tarea');
    const btnBuscarHistorial = document.getElementById('btn-buscar-historial');
    if (formEditar) {
        formEditar.addEventListener('submit', handleGuardarEdicion);
    }
    if (btnBuscarHistorial) {
        btnBuscarHistorial.addEventListener('click', buscarHistorialAsistencia);
    }
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
        // Agregamos 'historialMateria' a la lista de selects a rellenar
        const selects = document.querySelectorAll('#tareaMateria, #califMateria, #asistenciaMateria, #califSelectMateriaVer, #historialMateria'); // <-- AÑADIDO #historialMateria

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
    console.log("--- INICIANDO CARGA DE ESTUDIANTES ---");
    console.log("Materia ID:", id_materia);

    const selectEstudiante = document.getElementById(selectId);

    if (!id_materia) {
        selectEstudiante.innerHTML = '<option value="">Seleccione una materia primero</option>';
        selectEstudiante.disabled = true;
        return;
    }

    try {
        // 1. Averiguar de qué grado es esta materia
        const { data: materia, error: errMat } = await supabase
            .from('materias')
            .select('id_grado')
            .eq('id_materia', id_materia)
            .single();

        if (errMat) {
            console.error("Error buscando grado de la materia:", errMat);
            throw errMat;
        }
        console.log("Grado encontrado ID:", materia.id_grado);

        // 2. Buscar TODOS los alumnos de ese grado
        const { data: alumnos, error: errAlum } = await supabase
            .from('alumnos')
            .select('id_alumno, usuarios(nombre, apellido)')
            .eq('id_grado', materia.id_grado);

        if (errAlum) {
            console.error("Error buscando alumnos:", errAlum);
            throw errAlum;
        }

        console.log("Alumnos encontrados:", alumnos);

        // 3. Llenar el select
        if (alumnos && alumnos.length > 0) {
            selectEstudiante.innerHTML = '<option value="">Seleccione un estudiante</option>';
            alumnos.forEach(alum => {
                if (alum.usuarios) {
                    selectEstudiante.innerHTML += `<option value="${alum.id_alumno}">
                        ${alum.usuarios.nombre} ${alum.usuarios.apellido}
                    </option>`;
                } else {
                    console.warn("Alumno sin usuario asociado:", alum);
                }
            });
            selectEstudiante.disabled = false;
        } else {
            console.log("La consulta no devolvió alumnos.");
            selectEstudiante.innerHTML = '<option value="">No hay estudiantes en este grado</option>';
            selectEstudiante.disabled = true;
        }

    } catch (error) {
        console.error("Error GENERAL:", error);
        showMessage('Error cargando estudiantes: ' + error.message, 'Error');
    }
}
// ==========================================
// === NUEVA LÓGICA: HISTORIAL DE ASISTENCIA ===
// ==========================================

// 1. Función para buscar y mostrar el historial
async function buscarHistorialAsistencia() {
    const idMateria = document.getElementById('historialMateria').value;
    const fecha = document.getElementById('historialFecha').value;
    const tbody = document.getElementById('historial-asistencia-body');
    const resumenDiv = document.getElementById('resumen-estadistico');

    if (!idMateria) {
        showMessage('Por favor, selecciona una materia para ver el historial.', 'Aviso');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Buscando registros...</td></tr>';
    resumenDiv.classList.add('d-none');

    try {
        // Construir la consulta
        let query = supabase
            .from('asistencias')
            .select(`
                fecha,
                estado,
                inscripciones!inner (
                    id_materia,
                    alumnos (
                        usuarios (nombre, apellido, dni)
                    )
                )
            `)
            .eq('inscripciones.id_materia', idMateria)
            .order('fecha', { ascending: false }); // Más reciente primero

        // Si seleccionó fecha, filtramos por esa fecha específica
        if (fecha) {
            query = query.eq('fecha', fecha);
        }

        const { data: registros, error } = await query;

        if (error) throw error;

        if (!registros || registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No se encontraron registros de asistencia con esos filtros.</td></tr>';
            return;
        }

        // Renderizar tabla y calcular totales
        let html = '';
        let presentes = 0, ausentes = 0, tardes = 0;

        registros.forEach(reg => {
            const alumno = reg.inscripciones.alumnos.usuarios;
            const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`;
            const estado = reg.estado;
            const fechaFmt = new Date(reg.fecha).toLocaleDateString();

            // Contadores
            if (estado === 'presente') presentes++;
            if (estado === 'ausente') ausentes++;
            if (estado === 'tarde') tardes++;

            // Estilos de badge
            let badgeClass = 'bg-secondary';
            if (estado === 'presente') badgeClass = 'bg-success';
            if (estado === 'ausente') badgeClass = 'bg-danger';
            if (estado === 'tarde') badgeClass = 'bg-warning text-dark';

            html += `
                <tr>
                    <td>
                        <div class="fw-bold">${nombreCompleto}</div>
                        <small class="text-muted">DNI: ${alumno.dni || 'N/A'}</small>
                    </td>
                    <td><span class="badge ${badgeClass}">${estado.toUpperCase()}</span></td>
                    <td>${fechaFmt}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Actualizar resumen
        document.getElementById('count-presentes').textContent = presentes;
        document.getElementById('count-ausentes').textContent = ausentes;
        document.getElementById('count-tardes').textContent = tardes;
        resumenDiv.classList.remove('d-none');

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
}

// 2. Función auxiliar para llenar el select del historial (se llama al inicio)
async function poblarSelectHistorial() {
    const selectHistorial = document.getElementById('historialMateria');
    // Reutilizamos la consulta de materias que ya hicimos en loadAllSelects, 
    // pero como esa es asíncrona y compleja, hacemos una simple aquí o copiamos el HTML.

    // Lo más fácil: Copiar las opciones del select de "Tomar Asistencia" cuando carguen
    // Usamos un MutationObserver o simplemente lo llamamos dentro de loadAllSelects
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

    const { data, error } = await supabase
        .from('tareas')
        .select('*, materias(nombre_materia)')
        .eq('id_docente', currentDocenteId)
        .order('fecha_entrega', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="alert alert-warning">Error: ${error.message}</div>`;
        return;
    }

    container.innerHTML = '';
    if (data && data.length > 0) {
        data.forEach(tarea => {
            container.innerHTML += `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h4 class="h6 mb-1">${tarea.titulo}</h4>
                                <span class="badge bg-success-subtle text-success-emphasis mb-2">${tarea.materias.nombre_materia}</span>
                                <p class="text-muted small mb-0">${tarea.descripcion || 'Sin descripción'}</p>
                            </div>
                            
                            <div class="btn-group">
                                <button class="btn btn-outline-secondary btn-sm btn-ver-entregas" 
                                        data-id="${tarea.id_tarea}" 
                                        data-titulo="${tarea.titulo}" title="Ver Entregas">
                                    <i class="bi bi-folder2-open"></i> Entregas
                                </button>
                                <button class="btn btn-outline-primary btn-sm btn-editar-tarea" 
                                        data-id="${tarea.id_tarea}" title="Editar">
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                                <button class="btn btn-outline-danger btn-sm btn-eliminar-tarea" 
                                        data-id="${tarea.id_tarea}" title="Eliminar">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
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

        // --- LISTENERS ---

        // 1. Ver Entregas
        document.querySelectorAll('.btn-ver-entregas').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Usamos currentTarget para asegurar que tomamos el botón y no el icono
                const id = e.currentTarget.dataset.id;
                const titulo = e.currentTarget.dataset.titulo;
                verEntregas(id, titulo);
            });
        });

        // 2. Editar Tarea
        document.querySelectorAll('.btn-editar-tarea').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                abrirModalEditar(id);
            });
        });

        // 3. Eliminar Tarea
        document.querySelectorAll('.btn-eliminar-tarea').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                handleEliminarTarea(id);
            });
        });

    } else {
        container.innerHTML = '<div class="alert alert-info">No hay tareas asignadas.</div>';
    }
}

// Función para ver las entregas (VERSIÓN SEGURA)
async function verEntregas(idTarea, tituloTarea) {
    const modalEl = document.getElementById('modalVerEntregas');
    const modalTitle = modalEl.querySelector('.modal-title');
    const tbody = document.getElementById('lista-entregas-body');
    const loading = document.getElementById('entregas-loading');
    const empty = document.getElementById('entregas-empty');

    modalTitle.textContent = `Entregas: ${tituloTarea}`;
    tbody.innerHTML = '';
    loading.classList.remove('d-none');
    empty.classList.add('d-none');

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    try {
        const { data: entregas, error } = await supabase
            .from('entregas')
            .select(`
                fecha_entrega,
                archivo_path,
                alumno:usuarios (nombre, apellido, email)
            `)
            .eq('id_tarea', idTarea)
            .order('fecha_entrega', { ascending: false });

        loading.classList.add('d-none');

        if (error) throw error;

        if (!entregas || entregas.length === 0) {
            empty.classList.remove('d-none');
        } else {
            // CAMBIO: Usamos for...of para esperar la generación de URLs firmadas
            for (const entrega of entregas) {
                let linkDescarga = '<span class="text-muted">Sin archivo</span>';

                if (entrega.archivo_path) {
                    // Generar URL firmada (válida por 1 hora)
                    const { data: signedData } = await supabase.storage
                        .from('materiales')
                        .createSignedUrl(entrega.archivo_path, 3600);

                    if (signedData) {
                        linkDescarga = `
                            <a href="${signedData.signedUrl}" target="_blank" class="btn btn-sm btn-primary">
                                <i class="bi bi-download"></i> Descargar
                            </a>
                        `;
                    }
                }

                const nombreAlumno = entrega.alumno ?
                    `${entrega.alumno.nombre} ${entrega.alumno.apellido}` : 'Alumno desconocido';

                tbody.innerHTML += `
                    <tr>
                        <td>
                            <div class="fw-bold">${nombreAlumno}</div>
                            <div class="small text-muted">${entrega.alumno?.email || ''}</div>
                        </td>
                        <td>${new Date(entrega.fecha_entrega).toLocaleString()}</td>
                        <td>${linkDescarga}</td>
                    </tr>
                `;
            }
        }

    } catch (error) {
        console.error(error);
        loading.classList.add('d-none');
        tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Error al cargar entregas: ${error.message}</td></tr>`;
    }
}

// --- FUNCIONES DE EDICIÓN Y BORRADO ---

// 1. Eliminar Tarea
async function handleEliminarTarea(idTarea) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarea? Se borrarán también todas las entregas asociadas.")) {
        return;
    }

    try {
        const { error } = await supabase
            .from('tareas')
            .delete()
            .eq('id_tarea', idTarea);

        if (error) throw error;

        showMessage("Tarea eliminada correctamente.", "Éxito");
        loadTareas(); // Recargar lista

    } catch (error) {
        console.error(error);
        showMessage("Error al eliminar: " + error.message, "Error");
    }
}

// 2. Abrir Modal de Edición (Carga los datos actuales)
async function abrirModalEditar(idTarea) {
    try {
        // Buscar datos actuales de la tarea
        const { data, error } = await supabase
            .from('tareas')
            .select('*')
            .eq('id_tarea', idTarea)
            .single();

        if (error) throw error;

        // Llenar el formulario
        document.getElementById('edit-id-tarea').value = data.id_tarea;
        document.getElementById('edit-tareaTitulo').value = data.titulo;
        document.getElementById('edit-tareaDescripcion').value = data.descripcion;
        document.getElementById('edit-tareaFecha').value = data.fecha_entrega;
        document.getElementById('edit-tareaPuntaje').value = data.puntaje_maximo;

        // Mostrar Modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarTarea'));
        modal.show();

    } catch (error) {
        console.error(error);
        showMessage("Error al cargar datos de la tarea.", "Error");
    }
}

// 3. Guardar Cambios de Edición
async function handleGuardarEdicion(e) {
    e.preventDefault();

    const idTarea = document.getElementById('edit-id-tarea').value;
    const titulo = document.getElementById('edit-tareaTitulo').value;
    const descripcion = document.getElementById('edit-tareaDescripcion').value;
    const fecha = document.getElementById('edit-tareaFecha').value;
    const puntaje = document.getElementById('edit-tareaPuntaje').value;

    try {
        const { error } = await supabase
            .from('tareas')
            .update({
                titulo: titulo,
                descripcion: descripcion,
                fecha_entrega: fecha,
                puntaje_maximo: puntaje
            })
            .eq('id_tarea', idTarea);

        if (error) throw error;

        showMessage("Tarea actualizada correctamente.", "Éxito");

        // Cerrar modal
        const modalEl = document.getElementById('modalEditarTarea');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();

        loadTareas(); // Recargar lista

    } catch (error) {
        console.error(error);
        showMessage("Error al actualizar: " + error.message, "Error");
    }
}
// --- PESTAÑA 4: CALIFICACIONES ---

async function handleRegistrarCalificacion(e) {
    e.preventDefault();
    const form = e.target;
    const idMateria = form.califMateria.value;
    const idAlumno = form.califInscripcion.value; // Ahora esto trae el ID del alumno

    try {
        // 1. Verificar si existe inscripción
        let { data: inscripcion, error: errBusqueda } = await supabase
            .from('inscripciones')
            .select('id_inscripcion')
            .eq('id_alumno', idAlumno)
            .eq('id_materia', idMateria)
            .maybeSingle(); // maybeSingle no da error si no encuentra nada

        let idInscripcion = inscripcion?.id_inscripcion;

        // 2. Si no existe, crear la inscripción automáticamente
        if (!idInscripcion) {
            const { data: nuevaInsc, error: errCrear } = await supabase
                .from('inscripciones')
                .insert({ id_alumno: idAlumno, id_materia: idMateria })
                .select('id_inscripcion')
                .single();

            if (errCrear) throw errCrear;
            idInscripcion = nuevaInsc.id_inscripcion;
        }

        // 3. Guardar la calificación usando el ID de inscripción (existente o nuevo)
        const { error } = await supabase
            .from('calificaciones')
            .insert({
                id_inscripcion: idInscripcion,
                nota: form.califNota.value,
                tipo_evaluacion: form.califTipo.value,
                periodo: form.califPeriodo.value,
                observaciones: form.califObservaciones.value,
                fecha: new Date()
            });

        if (error) throw error;

        showMessage('Calificación registrada exitosamente.', 'Éxito');
        form.reset();
        bootstrap.Collapse.getInstance(document.getElementById('collapseRegistrarCalificacion')).hide();
        loadCalificaciones(document.getElementById('califSelectMateriaVer').value);

    } catch (error) {
        console.error(error);
        showMessage('Error al registrar: ' + error.message, 'Error');
    }
}

async function loadCalificaciones(id_materia) {
    const container = document.getElementById('calificaciones-container');
    if (!id_materia) {
        container.innerHTML = '<div class="text-center text-muted">Seleccione una materia para ver las calificaciones.</div>';
        return;
    }

    container.innerHTML = '<div class="text-center text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando...</div>';

    try {
        // 1. Obtener grado de la materia
        const { data: materia, error: matError } = await supabase.from('materias').select('id_grado').eq('id_materia', id_materia).single();
        if (matError) throw matError;

        // 2. Obtener TODOS los alumnos del grado
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select(`
                id_alumno,
                usuarios (nombre, apellido, dni),
                inscripciones (
                    calificaciones (*),
                    id_materia
                )
            `)
            .eq('id_grado', materia.id_grado)
            .eq('inscripciones.id_materia', id_materia);

        if (error) throw error;

        container.innerHTML = '';
        if (alumnos && alumnos.length > 0) {
            alumnos.forEach(alum => {  // <--- 'alum' se define aquí
                // Buscar si tiene inscripción y notas para esta materia
                const inscripcionCorrecta = alum.inscripciones.find(i => i.id_materia == id_materia);
                const calificaciones = inscripcionCorrecta ? inscripcionCorrecta.calificaciones : [];

                // Calcular promedio
                let total = 0;
                calificaciones.forEach(c => total += c.nota);
                const promedio = calificaciones.length > 0 ? (total / calificaciones.length).toFixed(1) : '-';
                const promedioColor = promedio >= 6 ? 'text-success' : (promedio === '-' ? 'text-muted' : 'text-danger');

                // HTML de notas
                let calificacionesHtml = '';
                if (calificaciones.length > 0) {
                    calificaciones.forEach(c => {
                        calificacionesHtml += `
                            <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                                <div>
                                    <div class="fw-bold small">${c.tipo_evaluacion} (${c.periodo || ''})</div>
                                    <div class="text-muted" style="font-size: 0.75rem">${c.observaciones || '-'}</div>
                                </div>
                                <span class="badge ${c.nota >= 6 ? 'bg-success' : 'bg-danger'}">${c.nota}</span>
                            </div>
                        `;
                    });
                } else {
                    calificacionesHtml = '<div class="small text-muted fst-italic">Sin calificaciones aún.</div>';
                }

                // Verificación de seguridad para usuario
                const nombreAlumno = alum.usuarios ? alum.usuarios.nombre : 'Usuario';
                const apellidoAlumno = alum.usuarios ? alum.usuarios.apellido : 'Desconocido';
                const dniAlumno = alum.usuarios ? alum.usuarios.dni : 'N/A';

                container.innerHTML += `
                    <div class="card mb-3 border-start border-4 ${promedio >= 6 ? 'border-success' : 'border-secondary'}">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h5 class="card-title mb-0">${nombreAlumno} ${apellidoAlumno}</h5>
                                    <small class="text-muted">DNI: ${dniAlumno}</small>
                                </div>
                                <div class="text-end">
                                    <small class="text-muted d-block">Promedio</small>
                                    <span class="fs-4 fw-bold ${promedioColor}">${promedio}</span>
                                </div>
                            </div>
                            <div class="bg-light p-2 rounded">
                                ${calificacionesHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<div class="alert alert-info">No hay alumnos registrados en este grado.</div>';
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
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

    try {
        // 1. Obtener el grado de la materia
        const { data: materia, error: errMat } = await supabase
            .from('materias')
            .select('id_grado')
            .eq('id_materia', id_materia)
            .single();

        if (errMat) throw errMat;

        // 2. Obtener TODOS los alumnos de ese grado
        const { data: alumnos, error: errAlum } = await supabase
            .from('alumnos')
            .select('id_alumno, usuarios(nombre, apellido)')
            .eq('id_grado', materia.id_grado);

        if (errAlum) throw errAlum;

        if (!alumnos || alumnos.length === 0) {
            container.innerHTML = '<div class="p-3 alert alert-info">No hay estudiantes en este grado.</div>';
            return;
        }

        // 3. Obtener asistencias YA registradas (usando una consulta compleja para vincular por alumno)
        // Nota: Aquí hacemos un truco. Buscamos en 'asistencias' uniendo con 'inscripciones' 
        // y filtramos por la materia y fecha.
        const { data: asistencias, error: errAsis } = await supabase
            .from('asistencias')
            .select('estado, inscripciones(id_alumno)')
            .eq('fecha', fecha)
            .eq('inscripciones.id_materia', id_materia); // Filtro clave

        // Mapear asistencias para búsqueda rápida por ID de alumno
        const mapaAsistencias = new Map();
        if (asistencias) {
            asistencias.forEach(a => {
                if (a.inscripciones) {
                    mapaAsistencias.set(a.inscripciones.id_alumno, a.estado);
                }
            });
        }

        // 4. Renderizar lista
        container.innerHTML = '';
        document.getElementById('asistencia-conteo-alumnos').textContent = `${alumnos.length} estudiantes`;

        alumnos.forEach(alum => {
            const id_alumno = alum.id_alumno;
            // Usamos ?. para evitar errores si usuario es null
            const nombre = alum.usuarios ? alum.usuarios.nombre : 'Usuario';
            const apellido = alum.usuarios ? alum.usuarios.apellido : 'Desconocido';
            const estadoActual = mapaAsistencias.get(id_alumno);

            container.innerHTML += `
                <div class="student-attendance-row" data-id-alumno="${id_alumno}">
                    <div class="d-flex align-items-center gap-3">
                        <div>
                            <div class="fw-bold">${nombre} ${apellido}</div>
                        </div>
                    </div>
                    <div class="btn-group attendance-status-buttons" role="group">
                        <input type="radio" class="btn-check" name="status-${id_alumno}" id="status-p-${id_alumno}" value="presente" ${estadoActual === 'presente' ? 'checked' : ''}>
                        <label class="btn btn-outline-success" for="status-p-${id_alumno}"><i class="bi bi-check-circle"></i> Presente</label>

                        <input type="radio" class="btn-check" name="status-${id_alumno}" id="status-a-${id_alumno}" value="ausente" ${estadoActual === 'ausente' ? 'checked' : ''}>
                        <label class="btn btn-outline-danger" for="status-a-${id_alumno}"><i class="bi bi-x-circle"></i> Ausente</label>

                        <input type="radio" class="btn-check" name="status-${id_alumno}" id="status-t-${id_alumno}" value="tarde" ${estadoActual === 'tarde' ? 'checked' : ''}>
                        <label class="btn btn-outline-warning" for="status-t-${id_alumno}"><i class="bi bi-clock"></i> Tarde</label>

                        <input type="radio" class="btn-check" name="status-${id_alumno}" id="status-j-${id_alumno}" value="justificado" ${estadoActual === 'justificado' ? 'checked' : ''}>
                        <label class="btn btn-outline-info" for="status-j-${id_alumno}"><i class="bi bi-info-circle"></i> Justificado</label>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="p-3 alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function handleGuardarAsistencia(e) {
    e.preventDefault();
    const fecha = document.getElementById('asistenciaFecha').value;
    const idMateria = document.getElementById('asistenciaMateria').value;

    if (!fecha || !idMateria) {
        showMessage('Por favor, seleccione una materia y una fecha.', 'Error');
        return;
    }

    const filas = document.querySelectorAll('#asistencia-lista-alumnos .student-attendance-row');
    if (filas.length === 0) {
        showMessage('No hay estudiantes para guardar asistencia.', 'Error');
        return;
    }

    try {
        let guardados = 0;

        // Procesamos alumno por alumno (es más seguro para crear inscripciones)
        for (const fila of filas) {
            const idAlumno = fila.dataset.idAlumno;
            const radioChecked = fila.querySelector(`input[name="status-${idAlumno}"]:checked`);

            if (radioChecked) {
                const estado = radioChecked.value;

                // 1. Buscar o Crear Inscripción
                let { data: inscripcion } = await supabase
                    .from('inscripciones')
                    .select('id_inscripcion')
                    .eq('id_alumno', idAlumno)
                    .eq('id_materia', idMateria)
                    .maybeSingle();

                let idInscripcion = inscripcion?.id_inscripcion;

                if (!idInscripcion) {
                    const { data: nuevaInsc, error: errCrear } = await supabase
                        .from('inscripciones')
                        .insert({ id_alumno: idAlumno, id_materia: idMateria })
                        .select('id_inscripcion')
                        .single();

                    if (errCrear) throw errCrear;
                    idInscripcion = nuevaInsc.id_inscripcion;
                }

                // 2. Guardar Asistencia (Upsert)
                const { error: errAsis } = await supabase
                    .from('asistencias')
                    .upsert(
                        { id_inscripcion: idInscripcion, fecha: fecha, estado: estado },
                        { onConflict: 'id_inscripcion, fecha' }
                    );

                if (errAsis) throw errAsis;
                guardados++;
            }
        }

        if (guardados > 0) {
            showMessage(`Se guardó la asistencia de ${guardados} alumnos correctamente.`, 'Éxito');
        } else {
            showMessage('No seleccionaste ningún estado (Presente/Ausente) para guardar.', 'Aviso');
        }

    } catch (error) {
        console.error(error);
        showMessage('Error al guardar asistencia: ' + error.message, 'Error');
    }
}

function marcarTodosAsistencia(estado) {
    // Buscamos inputs que tengan ese valor dentro del contenedor de lista
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

    // 1. Obtener el ID del destinatario
    const receiverId = form.msgDestinatario.value;
    if (!receiverId) {
        showMessage('Debe seleccionar un destinatario.', 'Error');
        return;
    }

    try {
        // 2. Buscar el email del destinatario en la tabla 'usuarios'
        const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('email')
            .eq('id_usuario', receiverId)
            .single();

        if (userError || !userData) {
            throw new Error('No se pudo encontrar el email del destinatario.');
        }

        const destinatarioEmail = userData.email;
        const asunto = form.msgAsunto.value;
        const contenido = form.msgContenido.value;

        // 3. Crear el link "mailto:"
        // Esto abre el cliente de email por defecto del profesor
        const mailtoLink = `mailto:${destinatarioEmail}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(contenido)}`;

        // 4. Abrir el link
        window.location.href = mailtoLink;

        // Opcional: Guardar una copia en tu tabla 'mensajes'
        await supabase.from('mensajes').insert({
            sender_id: currentDocenteId,
            receiver_id: receiverId,
            asunto: asunto,
            contenido: `(Intento de envío a ${destinatarioEmail}) ${contenido}`,
            prioridad: form.msgPrioridad.value
        });

        // No mostramos "Email enviado", solo reseteamos el formulario
        form.reset();
        bootstrap.Collapse.getInstance(document.getElementById('collapseRedactarMensaje')).hide();
        loadMensajes(); // Recargar la lista de enviados

    } catch (error) {
        console.error('Error al preparar email:', error);
        showMessage(`Error al preparar email: ${error.message}`, 'Error');
    }
}