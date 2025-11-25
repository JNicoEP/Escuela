// 1. Importas la conexión a la Base de Datos (Configuración)
import { supabase } from '../config/supabaseClient.js';

// 2. Importas la herramienta visual de Alertas (Utilidad)
import { showMessage } from '../utils/notifications.js';

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
    console.log("Configurando Event Listeners...");

    // --- Helper para agregar eventos de forma segura ---
    const safeAddListener = (id, eventType, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        }
    };

    // ==========================================
    // 1. GENERAL Y PERFIL
    // ==========================================
    safeAddListener('btn-logout', 'click', handleLogout);
    safeAddListener('form-editar-perfil-docente', 'submit', handleGuardarPerfilDocente);

    // ==========================================
    // 2. MATERIAS Y CURSOS
    // ==========================================
    safeAddListener('form-agregar-materia', 'submit', handleAgregarMateria);

    // ==========================================
    // 3. TAREAS Y EVALUACIÓN RÁPIDA
    // ==========================================
    // Crear tarea nueva
    safeAddListener('form-crear-tarea', 'submit', handleCrearTarea);
    // Editar tarea existente
    safeAddListener('form-editar-tarea', 'submit', handleGuardarEdicion);

    // NUEVO: Guardar nota desde el modal pequeño (botón "Evaluar" en lista de entregas)
    safeAddListener('form-calificar-tarea', 'submit', handleGuardarEvaluacionRapida);

    // ==========================================
    // 4. CALIFICACIONES (PLANILLA MASIVA)
    // ==========================================
    // Guardar la planilla completa
    safeAddListener('form-registrar-calificacion-masiva', 'submit', handleGuardarCalificacionesMasivas);

    // Cargar lista de alumnos al cambiar la materia en la planilla
    const califMateriaMasiva = document.getElementById('califMateriaMasiva');
    if (califMateriaMasiva) {
        califMateriaMasiva.addEventListener('change', loadAlumnosParaCalificar);
    }
    const btnActualizarHistorial = document.querySelector('button[onclick="loadHistorialCalificaciones()"]');
    if (btnActualizarHistorial) {
        // Quitamos el onclick del HTML y lo manejamos aquí
        btnActualizarHistorial.removeAttribute('onclick');
        btnActualizarHistorial.addEventListener('click', loadHistorialCalificaciones);
    }
    window.loadHistorialCalificaciones = loadHistorialCalificaciones;
    const btnHistorial = document.getElementById('btn-actualizar-historial');
    if (btnHistorial) {
        // Quitamos el onclick del HTML para evitar errores y usamos este listener
        btnHistorial.addEventListener('click', loadHistorialCalificaciones);
    }

    // Botón Buscar en Historial de Calificaciones
    const btnBuscarCalif = document.getElementById('btn-buscar-calif');
    if (btnBuscarCalif) {
        btnBuscarCalif.addEventListener('click', loadHistorialCalificaciones);
    }
    
    // (Opcional) Si quieres que cargue todo al entrar a la pestaña sin filtrar:
    const tabCalif = document.querySelector('button[data-target="#calificaciones"]');
    if (tabCalif) {
        tabCalif.addEventListener('shown.bs.tab', () => {
             // Limpiar filtros al entrar
             document.getElementById('historialCalifMateria').value = "";
             document.getElementById('historialCalifFecha').value = "";
             loadHistorialCalificaciones();
        });
    }
    // A. Listener para el botón "Buscar" (Manual)
    const btnBuscarHistorial = document.getElementById('btn-buscar-historial');
    if (btnBuscarHistorial) {
        btnBuscarHistorial.addEventListener('click', buscarHistorialAsistencia);
    }

    // B. Listener para el Select de Materia (Automático al cambiar)
    const filtroMateriaHistorial = document.getElementById('historialMateria');
    if (filtroMateriaHistorial) {
        filtroMateriaHistorial.addEventListener('change', async (e) => {
            const idMateria = e.target.value;
            
            // 1. Buscar en la tabla
            buscarHistorialAsistencia();

            // 2. Limpiar fecha vieja para evitar confusión
            document.getElementById('historialFecha').value = '';

            // 3. RECARGAR CALENDARIO (Para que pinte solo días de esta materia)
            await inicializarCalendarioAsistencia(idMateria);
        });
    }

    // C. Listener para el Filtro de Fecha (Automático al cambiar)
    const filtroFechaHistorial = document.getElementById('historialFecha');
    if (filtroFechaHistorial) {
        filtroFechaHistorial.addEventListener('change', buscarHistorialAsistencia);
    }

    // Listener para el Filtro de MATERIA en Historial
    const historialMateriaSelect = document.getElementById('historialCalifMateria');
    if (historialMateriaSelect) {
        historialMateriaSelect.addEventListener('change', async (e) => {
            const idMateria = e.target.value;
            
            // 1. Recargar la tabla de abajo
            loadHistorialCalificaciones();
            
            // 2. RECARGAR EL CALENDARIO (Pintar solo días de esta materia)
            // Limpiamos el input de fecha para evitar confusiones
            document.getElementById('historialCalifFecha').value = '';
            
            await inicializarCalendarioNotas(idMateria);
        });
    }
    
    // ... resto de listeners ...
    

    // ==========================================
    // 5. ASISTENCIA (CORRECCIÓN)
    // ==========================================
    // Listener de formulario
    safeAddListener('form-control-asistencia', 'submit', handleGuardarAsistencia);
    safeAddListener('btn-ver-certificados', 'click', abrirModalCertificados);
    safeAddListener('btn-buscar-historial', 'click', buscarHistorialAsistencia);

    // Detectar cambios en los selectores de asistencia (ESTO ES LO QUE FALTABA)
    const asistenciaMateria = document.getElementById('asistenciaMateria');
    const asistenciaFecha = document.getElementById('asistenciaFecha');
    
    if (asistenciaMateria && asistenciaFecha) {
        // Creamos una función wrapper para llamar a loadEstudiantesParaAsistencia con los valores actuales
        const recargarListaAsistencia = () => {
            loadEstudiantesParaAsistencia(asistenciaMateria.value, asistenciaFecha.value);
        };

        asistenciaMateria.addEventListener('change', recargarListaAsistencia);
        asistenciaFecha.addEventListener('change', recargarListaAsistencia);
    }

    // Botones de acción masiva
    safeAddListener('btn-marcar-presente', 'click', () => marcarTodosAsistencia('presente'));
    safeAddListener('btn-marcar-ausente', 'click', () => marcarTodosAsistencia('ausente'));

    // ==========================================
    // 6. MENSAJERÍA
    // ==========================================
    safeAddListener('form-redactar-mensaje', 'submit', handleEnviarMensaje);

    // ==========================================
    // 7. TABLAS DE VISUALIZACIÓN (HISTORIALES)
    // ==========================================
    // Si aún usas el select para ver calificaciones individuales (opcional)
    const califSelectMateriaVer = document.getElementById('califSelectMateriaVer');
    if (califSelectMateriaVer) {
        califSelectMateriaVer.addEventListener('change', (e) => loadCalificaciones(e.target.value));
    }
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
    await inicializarCalendarioNotas();
}
/**
 * Abre el modal y carga los certificados pendientes
 */
async function abrirModalCertificados() {
    const modal = new bootstrap.Modal(document.getElementById('modalRevisarCertificados'));
    modal.show();

    const tbody = document.getElementById('lista-certificados-body');
    const loading = document.getElementById('certificados-loading');
    const empty = document.getElementById('certificados-empty');
    const tabla = document.getElementById('tabla-certificados');

    tbody.innerHTML = '';
    loading.classList.remove('d-none');
    tabla.classList.add('d-none');
    empty.classList.add('d-none');

    try {
        // CORRECCIÓN: Relacionamos directamente con 'usuarios' porque así está la FK en tu BD
        const { data: certificados, error } = await supabase
            .from('certificados_medicos')
            .select(`
                id_certificado,
                fecha_inicio,
                fecha_fin,
                archivo_path,
                comentario,
                usuarios (
                    nombre, 
                    apellido, 
                    dni
                )
            `)
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false });

        loading.classList.add('d-none');

        if (error) throw error;

        if (!certificados || certificados.length === 0) {
            empty.classList.remove('d-none');
            return;
        }

        tabla.classList.remove('d-none');

        // Usamos for...of para poder usar await con las URLs firmadas
        for (const cert of certificados) {
            // CORRECCIÓN: Ahora los datos del alumno están en 'cert.usuarios'
            const alumno = cert.usuarios;
            const nombreFull = alumno ? `${alumno.nombre} ${alumno.apellido}` : 'Desconocido';

            // Generar Link de descarga
            let btnArchivo = '<span class="text-muted small">Sin archivo</span>';
            if (cert.archivo_path) {
                // Intenta crear URL firmada
                const { data: signedData } = await supabase.storage
                    .from('materiales')
                    .createSignedUrl(cert.archivo_path, 3600);

                if (signedData) {
                    btnArchivo = `
                        <a href="${signedData.signedUrl}" target="_blank" class="btn btn-sm btn-outline-primary" title="Ver Documento">
                            <i class="bi bi-eye"></i> Ver
                        </a>
                    `;
                }
            }

            tbody.innerHTML += `
                <tr id="fila-cert-${cert.id_certificado}">
                    <td>
                        <div class="fw-bold">${nombreFull}</div>
                        <small class="text-muted">DNI: ${alumno?.dni || '-'}</small>
                        ${cert.comentario ? `<div class="small text-info mt-1 fst-italic">"${cert.comentario}"</div>` : ''}
                    </td>
                    <td>
                        <div class="small">Desde: ${new Date(cert.fecha_inicio + 'T00:00:00').toLocaleDateString()}</div>
                        <div class="small">Hasta: ${new Date(cert.fecha_fin + 'T00:00:00').toLocaleDateString()}</div>
                    </td>
                    <td>${btnArchivo}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-success" onclick="gestionarCertificado(${cert.id_certificado}, 'aprobado')">
                                <i class="bi bi-check-lg"></i> Aprobar
                            </button>
                            <button class="btn btn-danger" onclick="gestionarCertificado(${cert.id_certificado}, 'rechazado')">
                                <i class="bi bi-x-lg"></i> Rechazar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }

    } catch (error) {
        console.error(error);
        loading.classList.add('d-none');
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Error: ${error.message}</td></tr>`;
        tabla.classList.remove('d-none');
    }
}

// Hacemos la función global para poder llamarla desde el onclick del HTML inyectado
window.gestionarCertificado = async (idCertificado, nuevoEstado) => {
    if (!confirm(`¿Estás seguro de marcar este certificado como ${nuevoEstado.toUpperCase()}?`)) return;

    try {
        const { error } = await supabase
            .from('certificados_medicos')
            .update({ estado: nuevoEstado })
            .eq('id_certificado', idCertificado);

        if (error) throw error;

        showMessage(`Certificado ${nuevoEstado} correctamente.`, 'Éxito');
        registrarActividad('certificado', `Has ${nuevoEstado} un certificado médico.`);

        // Eliminar fila visualmente
        const fila = document.getElementById(`fila-cert-${idCertificado}`);
        if (fila) fila.remove();

        // Si no quedan filas, mostrar mensaje vacío
        const tbody = document.getElementById('lista-certificados-body');
        if (tbody.children.length === 0) {
            document.getElementById('certificados-empty').classList.remove('d-none');
            document.getElementById('tabla-certificados').classList.add('d-none');
        }

    } catch (error) {
        console.error(error);
        showMessage('Error al actualizar certificado: ' + error.message, 'Error');
    }
};

/**
 * Carga los datos de resumen del Dashboard.
 */
async function loadDashboardData() {
    try {
        // 1. Conteo de Materias (Mis Cursos)
        const { count: materiasCount, data: misMaterias, error: errMat } = await supabase
            .from('materias')
            .select('id_grado', { count: 'exact' })
            .eq('id_docente', currentDocenteId);
        
        if (errMat) throw errMat;

        document.getElementById('summary-cursos').textContent = materiasCount || 0;

        // 2. Conteo de Estudiantes (NUEVA LÓGICA)
        let estudiantesCount = 0;

        if (misMaterias && misMaterias.length > 0) {
            // Obtenemos los IDs de los grados donde enseña el docente (eliminando duplicados)
            const gradosIds = [...new Set(misMaterias.map(m => m.id_grado))];

            if (gradosIds.length > 0) {
                // Contamos alumnos que pertenezcan a esos grados
                const { count, error: errAlum } = await supabase
                    .from('alumnos')
                    .select('*', { count: 'exact', head: true })
                    .in('id_grado', gradosIds);
                
                if (!errAlum) {
                    estudiantesCount = count;
                }
            }
        }

   // Actualizamos el número en la tarjeta azul
        document.getElementById('summary-estudiantes').textContent = estudiantesCount;

        // 3. Conteo de Tareas Activas
        const { count: tareasCount } = await supabase
            .from('tareas')
            .select('*', { count: 'exact', head: true })
            .eq('id_docente', currentDocenteId);
        
        document.getElementById('summary-tareas').textContent = tareasCount || 0;
    // 5. Actividad Reciente (ejemplo)
    const { data: ultimasCalificaciones } = await supabase
        .from('calificaciones')
        .select('tipo_evaluacion, fecha, inscripciones(materias(nombre_materia))')
        .limit(3)
        .order('fecha', { ascending: false }); // Faltaría filtrar por docente
    await loadDocenteProfileInfo();
    await loadActividadReciente();
    

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
    } catch (error) {
        console.error("Error cargando datos del dashboard:", error);
    }
}

// =========================================
// === LÓGICA DE PERFIL DOCENTE (DASHBOARD) ===
// ==========================================

/**
 * Carga la información del perfil y documentos en el Dashboard
 */
async function loadDocenteProfileInfo() {
    try {
        // Traer datos de usuario y datos extendidos de docente
        const { data, error } = await supabase
            .from('docentes')
            .select(`
                plaza, 
                declaracion_jurada_path, 
                titulo_habilitante_path,
                tirilla_cuil_path, 
                fotocopia_dni_path, 
                acta_nacimiento_path,
                usuarios (nombre, apellido, dni)
            `)
            .eq('id_docente', currentDocenteId)
            .single();

        if (error) throw error;

        // Llenar Textos
        document.getElementById('dash-nombre').textContent = `${data.usuarios.nombre} ${data.usuarios.apellido}`;
        document.getElementById('dash-dni').textContent = data.usuarios.dni || 'No registrado';
        document.getElementById('dash-plaza').textContent = data.plaza || 'Sin asignar';

        // Pre-llenar el modal de edición
        document.getElementById('edit-doc-nombre').value = data.usuarios.nombre;
        document.getElementById('edit-doc-apellido').value = data.usuarios.apellido;
        document.getElementById('edit-doc-dni').value = data.usuarios.dni || '';
        document.getElementById('edit-doc-plaza').value = data.plaza || '';

        // Helper para mostrar botones de descarga
        const renderFileBadge = (path, elementId) => {
            const el = document.getElementById(elementId);
            if (path) {
                // Obtener URL firmada o publica (asumiendo bucket privado 'materiales')
                const { data: urlData } = supabase.storage.from('materiales').getPublicUrl(path);
                // Nota: Si usas 'createSignedUrl' cámbialo aquí. Por simplicidad uso PublicUrl si el bucket es mixto.

                el.innerHTML = `<a href="${urlData.publicUrl}" target="_blank" class="badge bg-success text-white text-decoration-none"><i class="bi bi-eye-fill"></i> Ver Documento</a>`;
                el.classList.remove('bg-light', 'text-dark', 'border');
            } else {
                el.innerHTML = 'Pendiente';
                el.className = 'badge bg-light text-dark border';
            }
        };

        renderFileBadge(data.tirilla_cuil_path, 'link-cuil');
        renderFileBadge(data.fotocopia_dni_path, 'link-dni-copy');
        renderFileBadge(data.acta_nacimiento_path, 'link-acta');
        renderFileBadge(data.declaracion_jurada_path, 'link-ddjj');
        renderFileBadge(data.titulo_habilitante_path, 'link-titulo');

    } catch (error) {
        console.error("Error cargando perfil docente:", error);
    }
}

/**
 * Maneja la actualización del perfil y subida de archivos
 */
async function handleGuardarPerfilDocente(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    const dni = document.getElementById('edit-doc-dni').value;
    const plaza = document.getElementById('edit-doc-plaza').value;

    // Archivos
    const files = {
        tirilla_cuil: document.getElementById('file-cuil').files[0],
        fotocopia_dni: document.getElementById('file-dni').files[0],
        acta_nacimiento: document.getElementById('file-acta').files[0],
        declaracion_jurada: document.getElementById('file-ddjj').files[0],
        titulo_habilitante: document.getElementById('file-titulo').files[0]
    };

    try {
        // 1. Actualizar datos de texto (DNI en usuarios, Plaza en docentes)
        await supabase.from('usuarios').update({ dni: dni }).eq('id_usuario', currentDocenteId);

        const updateData = { plaza: plaza };

        // 2. Subir archivos si existen y guardar sus rutas
        for (const [key, file] of Object.entries(files)) {
            if (file) {
                const filePath = `docentes/${currentDocenteId}/${key}_${Date.now()}.${file.name.split('.').pop()}`;
                const { error: uploadError } = await supabase.storage
                    .from('materiales')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Agregar la ruta al objeto de actualización (ej: tirilla_cuil_path)
                updateData[`${key}_path`] = filePath;
            }
        }

        // 3. Actualizar tabla docentes
        const { error: updateError } = await supabase
            .from('docentes')
            .update(updateData)
            .eq('id_docente', currentDocenteId);

        if (updateError) throw updateError;

        showMessage('Perfil actualizado correctamente.', 'Éxito');
        bootstrap.Modal.getInstance(document.getElementById('modalEditarPerfilDocente')).hide();
        loadDocenteProfileInfo(); // Recargar datos en pantalla

    } catch (error) {
        console.error(error);
        showMessage('Error al actualizar: ' + error.message, 'Error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
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
        // AGREGAMOS '#historialCalifMateria' A LA LISTA
       const selects = document.querySelectorAll('#califMateriaMasiva,#tareaMateria, #califMateria, #asistenciaMateria, #califSelectMateriaVer, #historialCalifMateria, #historialMateria');
        
        selects.forEach(select => {
            select.innerHTML = '<option value="">Seleccione una Materia</option>';
            materias.forEach(materia => {
                select.innerHTML += `<option value="${materia.id_materia}">${materia.nombre_materia} (${materia.grado.nombre_grado})</option>`;
            });
        });
        
        // Ajuste visual para el filtro de historial (opcional)
        const filtroHist = document.getElementById('historialCalifMateria');
        if(filtroHist) filtroHist.innerHTML = '' + filtroHist.innerHTML;
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
/**
 * Inicializa el calendario y pinta los días, filtrando opcionalmente por materia
 */
async function inicializarCalendarioNotas(idMateriaFiltro = null) {
    const inputFecha = document.getElementById('historialCalifFecha');
    if (!inputFecha) return;

    // 1. Limpiar instancia previa si existe (para repintar)
    if (inputFecha._flatpickr) {
        inputFecha._flatpickr.destroy();
    }

    try {
        // 2. Construir consulta base
        let query = supabase
            .from('calificaciones')
            .select(`
                fecha,
                inscripciones!inner (
                    id_materia,
                    materias!inner ( id_docente )
                )
            `)
            .eq('inscripciones.materias.id_docente', currentDocenteId);

        // --- FILTRO CLAVE: Si elegimos una materia, filtramos las fechas ---
        if (idMateriaFiltro) {
            query = query.eq('inscripciones.id_materia', idMateriaFiltro);
        }

        const { data: fechasData, error } = await query;

        if (error) throw error;

        // 3. Crear Set de fechas disponibles
        const fechasConNotas = new Set();
        if (fechasData) {
            fechasData.forEach(item => {
                // Cortamos la fecha YYYY-MM-DD
                const fechaStr = new Date(item.fecha).toISOString().split('T')[0];
                fechasConNotas.add(fechaStr);
            });
        }

        // 4. Inicializar Flatpickr con los nuevos datos
        flatpickr("#historialCalifFecha", {
            locale: "es",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "j F, Y",
            allowInput: true,
            disableMobile: "true",
            // Pintar los días
            onDayCreate: function(dObj, dStr, fp, dayElem) {
                const fechaCalendario = dayElem.dateObj.toISOString().split('T')[0];
                if (fechasConNotas.has(fechaCalendario)) {
                    dayElem.classList.add("tiene-notas");
                    // Estilos directos por si el CSS falla
                    dayElem.style.backgroundColor = "#198754";
                    dayElem.style.borderColor = "#198754";
                    dayElem.style.color = "white";
                    dayElem.title = "Hay notas cargadas";
                }
            },
            // Al hacer clic en una fecha
            onChange: function(selectedDates, dateStr) {
                loadHistorialCalificaciones();
            }
        });

    } catch (error) {
        console.error("Error configurando calendario:", error);
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

    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted p-4"><span class="spinner-border spinner-border-sm"></span> Buscando registros...</td></tr>';
    resumenDiv.classList.add('d-none');

    try {
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
            .order('fecha', { ascending: false });

        if (fecha) {
            query = query.eq('fecha', fecha);
        }

        const { data: registros, error } = await query;

        if (error) throw error;

        if (!registros || registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted p-4">No se encontraron registros.</td></tr>';
            return;
        }

        let html = '';
        let presentes = 0, ausentes = 0, tardes = 0;

        registros.forEach(reg => {
            const alumno = reg.inscripciones.alumnos.usuarios;
            const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`;
            const estado = reg.estado.toLowerCase();
            const fechaFmt = new Date(reg.fecha).toLocaleDateString();

            if (estado === 'presente') presentes++;
            if (estado === 'ausente') ausentes++;
            if (estado === 'tarde') tardes++;

            // Badges con diseño moderno
            let badgeHtml = '';
            switch (estado) {
                case 'presente':
                    badgeHtml = '<span class="badge bg-success-subtle text-success border border-success px-3 py-2 rounded-pill"><i class="bi bi-check-circle-fill me-1"></i> Presente</span>';
                    break;
                case 'ausente':
                    badgeHtml = '<span class="badge bg-danger-subtle text-danger border border-danger px-3 py-2 rounded-pill"><i class="bi bi-x-circle-fill me-1"></i> Ausente</span>';
                    break;
                case 'tarde':
                    badgeHtml = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning px-3 py-2 rounded-pill"><i class="bi bi-clock-fill me-1"></i> Tarde</span>';
                    break;
                case 'justificado':
                    badgeHtml = '<span class="badge bg-info-subtle text-info-emphasis border border-info px-3 py-2 rounded-pill"><i class="bi bi-file-medical-fill me-1"></i> Justificado</span>';
                    break;
                default:
                    badgeHtml = `<span class="badge bg-secondary">${estado}</span>`;
            }

            html += `
                <tr>
                    <td class="align-middle py-3">
                        <div class="d-flex align-items-center">
                            <div class="avatar-initials bg-light text-primary rounded-circle me-3 fw-bold d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                ${alumno.nombre[0]}${alumno.apellido[0]}
                            </div>
                            <div>
                                <div class="fw-bold text-dark">${nombreCompleto}</div>
                                <small class="text-muted">DNI: ${alumno.dni || '-'}</small>
                            </div>
                        </div>
                    </td>
                    <td class="align-middle text-center">${badgeHtml}</td>
                    <td class="align-middle text-end fw-medium text-secondary">${fechaFmt}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

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
/**
 * Inicializa el calendario de ASISTENCIA y pinta los días trabajados.
 * @param {string} idMateriaFiltro - (Opcional) ID de la materia para filtrar fechas.
 */
async function inicializarCalendarioAsistencia(idMateriaFiltro = null) {
    const inputFecha = document.getElementById('historialFecha');
    if (!inputFecha) return;

    // 1. Limpiar instancia previa para refrescar los colores
    if (inputFecha._flatpickr) {
        inputFecha._flatpickr.destroy();
    }

    try {
        // 2. Consulta a la tabla ASISTENCIAS
        let query = supabase
            .from('asistencias')
            .select(`
                fecha,
                inscripciones!inner (
                    id_materia,
                    materias!inner ( id_docente )
                )
            `)
            .eq('inscripciones.materias.id_docente', currentDocenteId);

        // Si hay filtro de materia, ajustamos la consulta
        if (idMateriaFiltro) {
            query = query.eq('inscripciones.id_materia', idMateriaFiltro);
        }

        const { data: fechasData, error } = await query;

        if (error) throw error;

        // 3. Crear Set de fechas únicas
        const fechasConAsistencia = new Set();
        if (fechasData) {
            fechasData.forEach(item => {
                const fechaStr = new Date(item.fecha).toISOString().split('T')[0];
                fechasConAsistencia.add(fechaStr);
            });
        }

        // 4. Inicializar Flatpickr
        flatpickr("#historialFecha", {
            locale: "es",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "j F, Y",
            allowInput: true,
            disableMobile: "true",
            
            // PINTAR LOS DÍAS
            onDayCreate: function(dObj, dStr, fp, dayElem) {
                const fechaCalendario = dayElem.dateObj.toISOString().split('T')[0];
                if (fechasConAsistencia.has(fechaCalendario)) {
                    dayElem.classList.add("tiene-asistencia"); // Clase CSS azul
                    dayElem.title = "Asistencia tomada";
                }
            },
            
            // AL SELECCIONAR, BUSCAR
            onChange: function(selectedDates, dateStr) {
                buscarHistorialAsistencia();
            }
        });

    } catch (error) {
        console.error("Error configurando calendario asistencia:", error);
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
        registrarActividad('materia', `Creaste la materia: ${nombre}.`);
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

async function verEntregas(idTarea, tituloTarea) {
    // 1. Referencias DOM
    const modalEl = document.getElementById('modalVerEntregas');
    const modalTitle = modalEl.querySelector('.modal-title');

    const tbodyEntregas = document.getElementById('lista-entregas-body');
    const tbodyPendientes = document.getElementById('lista-pendientes-body');

    const loading = document.getElementById('entregas-loading');
    const emptyEntregas = document.getElementById('entregas-empty');
    const emptyPendientes = document.getElementById('pendientes-empty');

    // 2. Reset UI
    modalTitle.textContent = `Tarea: ${tituloTarea}`;
    tbodyEntregas.innerHTML = '';
    tbodyPendientes.innerHTML = '';
    loading.classList.remove('d-none');
    emptyEntregas.classList.add('d-none');
    emptyPendientes.classList.add('d-none');

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    try {
        // A. Datos Tarea
        const { data: tareaData, error: errTarea } = await supabase
            .from('tareas')
            .select('id_materia, fecha_entrega, materias(id_grado, nombre_materia)')
            .eq('id_tarea', idTarea)
            .single();

        if (errTarea) throw errTarea;

        const idGrado = tareaData.materias.id_grado;
        const idMateria = tareaData.id_materia;
        const nombreMateria = tareaData.materias.nombre_materia;
        const fechaLimite = new Date(tareaData.fecha_entrega);

        // B. Alumnos del Grado
        const { data: alumnosDelGrado, error: errAlumnos } = await supabase
            .from('alumnos')
            .select('id_alumno, tutor_nombre, tutor_telefono, usuarios(nombre, apellido, email)')
            .eq('id_grado', idGrado);

        if (errAlumnos) throw errAlumnos;

        // C. Entregas
        const { data: entregas, error: errEntregas } = await supabase
            .from('entregas')
            .select('id_alumno, fecha_entrega, archivo_path')
            .eq('id_tarea', idTarea);

        if (errEntregas) throw errEntregas;

        // D. Calificaciones existentes (para saber si ya evaluamos)
        // Nota: Usamos el "tipo_evaluacion" como filtro rápido para matchear la tarea
        const { data: calificaciones } = await supabase
            .from('calificaciones')
            .select('nota, inscripciones!inner(id_alumno)')
            .eq('tipo_evaluacion', `Tarea: ${tituloTarea}`)
            .eq('inscripciones.id_materia', idMateria);

        const notasMap = {};
        if (calificaciones) {
            calificaciones.forEach(c => notasMap[c.inscripciones.id_alumno] = c.nota);
        }

        loading.classList.add('d-none');

        // --- RENDERIZADO ENTREGADOS ---
        const entregaronIds = new Set();

        if (!entregas || entregas.length === 0) {
            emptyEntregas.classList.remove('d-none');
        } else {
            for (const entrega of entregas) {
                entregaronIds.add(entrega.id_alumno);

                // Buscar datos alumno
                const alumno = alumnosDelGrado.find(a => a.id_alumno === entrega.id_alumno);
                if (!alumno) continue;

                const nombre = `${alumno.usuarios.nombre} ${alumno.usuarios.apellido}`;

                // Botón Ver Archivo
                let btnVer = '<button class="btn btn-sm btn-light border disabled" title="No hay archivo"><i class="bi bi-file-earmark-x"></i></button>';
                if (entrega.archivo_path) {
                    const { data: urlData } = await supabase.storage.from('materiales').createSignedUrl(entrega.archivo_path, 3600);
                    if (urlData) {
                        btnVer = `<a href="${urlData.signedUrl}" target="_blank" class="btn btn-sm btn-outline-primary" title="Ver Archivo"><i class="bi bi-eye"></i></a>`;
                    }
                }

                // Fecha
                const fechaEnt = new Date(entrega.fecha_entrega);
                const esTarde = fechaEnt > fechaLimite;
                const badgeFecha = esTarde
                    ? `<span class="badge bg-warning text-dark">Tarde: ${fechaEnt.toLocaleDateString()}</span>`
                    : `<span class="text-success small"><i class="bi bi-check-circle"></i> ${fechaEnt.toLocaleDateString()}</span>`;

                // Botón Evaluar o Badge Nota
                let accionEvaluar = '';
                const notaExistente = notasMap[entrega.id_alumno];

                if (notaExistente !== undefined) {
                    accionEvaluar = `<span class="badge bg-secondary p-2">Nota: ${notaExistente}</span>`;
                } else {
                    accionEvaluar = `
                        <button class="btn btn-sm btn-success btn-evaluar" 
                            data-id-alumno="${entrega.id_alumno}"
                            data-nombre="${nombre}"
                            data-id-materia="${idMateria}"
                            data-nombre-tarea="${tituloTarea}">
                            Evaluar
                        </button>`;
                }

                tbodyEntregas.innerHTML += `
                    <tr>
                        <td>
                            <div class="fw-bold text-dark">${nombre}</div>
                            <div class="small text-muted">${alumno.usuarios.email}</div>
                        </td>
                        <td>${badgeFecha}</td>
                        <td class="text-end">
                            <div class="btn-group">
                                ${btnVer}
                                ${accionEvaluar}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        // --- RENDERIZADO PENDIENTES ---
        const pendientes = alumnosDelGrado.filter(a => !entregaronIds.has(a.id_alumno));

        if (pendientes.length === 0) {
            document.getElementById('pendientes-empty').classList.remove('d-none');
        } else {
            pendientes.forEach(p => {
                const nombre = `${p.usuarios.nombre} ${p.usuarios.apellido}`;
                const tutor = p.tutor_nombre || 'No registrado';
                const tel = p.tutor_telefono;

                // Botón WhatsApp
                let btnWsp = '';
                if (tel) {
                    const msg = `Hola, el alumno ${nombre} debe la tarea "${tituloTarea}" de ${nombreMateria}.`;
                    btnWsp = `<a href="https://wa.me/${tel}?text=${encodeURIComponent(msg)}" target="_blank" class="btn btn-sm btn-outline-success" title="Avisar por WhatsApp"><i class="bi bi-whatsapp"></i></a>`;
                } else {
                    btnWsp = `<button class="btn btn-sm btn-light border disabled" title="Sin teléfono"><i class="bi bi-telephone-x"></i></button>`;
                }

                // Botón Evaluar (aunque no entregó, para poner 1 por ejemplo)
                let accionEvaluar = '';
                const notaExistente = notasMap[p.id_alumno];

                if (notaExistente !== undefined) {
                    accionEvaluar = `<span class="badge bg-secondary p-2">Nota: ${notaExistente}</span>`;
                } else {
                    accionEvaluar = `
                        <button class="btn btn-sm btn-outline-secondary btn-evaluar" 
                            data-id-alumno="${p.id_alumno}"
                            data-nombre="${nombre}"
                            data-id-materia="${idMateria}"
                            data-nombre-tarea="${tituloTarea}">
                            Nota
                        </button>`;
                }

                tbodyPendientes.innerHTML += `
                    <tr>
                        <td>
                            <span class="fw-bold text-danger">${nombre}</span>
                        </td>
                        <td>
                            <div class="small text-dark">${tutor}</div>
                        </td>
                        <td class="text-end">
                            <div class="btn-group">
                                ${btnWsp}
                                ${accionEvaluar}
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        // Listeners para botones de evaluar
        document.querySelectorAll('.btn-evaluar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const d = e.currentTarget.dataset;
                // abrirModalCalificar es la función pequeña que ya tienes
                abrirModalCalificar(d.idAlumno, d.nombre, d.idMateria, d.nombreTarea);
            });
        });

    } catch (error) {
        console.error(error);
        loading.classList.add('d-none');
        tbodyEntregas.innerHTML = `<tr><td colspan="3" class="text-danger">Error: ${error.message}</td></tr>`;
    }
}

// Abrir el modal pequeño de calificación
function abrirModalCalificar(idAlumno, nombreAlumno, idMateria, nombreTarea) {
    document.getElementById('eval-id-alumno').value = idAlumno;
    document.getElementById('eval-id-materia').value = idMateria;
    document.getElementById('eval-nombre-tarea').value = nombreTarea;

    document.getElementById('eval-nombre-alumno').textContent = nombreAlumno;
    document.getElementById('eval-nota').value = '';
    document.getElementById('eval-obs').value = '';

    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalCalificarTarea'));
    modal.show();
}

// Guardar la nota en la base de datos
async function handleGuardarEvaluacionRapida(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Guardando...";

    const idAlumno = document.getElementById('eval-id-alumno').value;
    const idMateria = document.getElementById('eval-id-materia').value;
    const nombreTarea = document.getElementById('eval-nombre-tarea').value;
    const nota = document.getElementById('eval-nota').value;
    const obs = document.getElementById('eval-obs').value;

    try {
        // 1. Asegurar inscripción (truco para evitar errores de FK si no estaba inscripto)
        let { data: inscripcion } = await supabase.from('inscripciones')
            .select('id_inscripcion').eq('id_alumno', idAlumno).eq('id_materia', idMateria).maybeSingle();

        let idInscripcion = inscripcion?.id_inscripcion;

        if (!idInscripcion) {
            const { data: nueva } = await supabase.from('inscripciones')
                .insert({ id_alumno: idAlumno, id_materia: idMateria }).select().single();
            idInscripcion = nueva.id_inscripcion;
        }

        // 2. Insertar calificación
        const { error } = await supabase.from('calificaciones').insert({
            id_inscripcion: idInscripcion,
            nota: nota,
            tipo_evaluacion: `Tarea: ${nombreTarea}`,
            observaciones: obs,
            fecha: new Date()
        });

        if (error) throw error;

        showMessage(`Nota guardada correctamente.`, 'Éxito');

        // Cerrar modal pequeño
        const modalEl = document.getElementById('modalCalificarTarea');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();

    } catch (error) {
        console.error(error);
        alert('Error al guardar nota: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Guardar Nota";
    }
}

// REGISTRAR EL LISTENER DEL FORMULARIO (Agregar en setupEventListeners)
// document.getElementById('form-calificar-tarea').addEventListener('submit', handleGuardarEvaluacionRapida);
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

/**
 * Carga la lista de alumnos para calificar masivamente
 */
async function loadAlumnosParaCalificar() {
    const idMateria = document.getElementById('califMateriaMasiva').value;
    const container = document.getElementById('lista-alumnos-calificar');
    const conteoSpan = document.getElementById('calif-conteo-alumnos');

    if (!idMateria) {
        container.innerHTML = '<div class="p-5 text-center text-muted">Seleccione una materia.</div>';
        conteoSpan.textContent = '0 estudiantes';
        return;
    }

    container.innerHTML = '<div class="p-5 text-center text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando planilla...</div>';

    try {
        // 1. Obtener grado de la materia
        const { data: materia, error: errMat } = await supabase.from('materias').select('id_grado').eq('id_materia', idMateria).single();
        if (errMat) throw errMat;

        // 2. Obtener alumnos
        const { data: alumnos, error: errAlum } = await supabase
            .from('alumnos')
            .select('id_alumno, usuarios(nombre, apellido, dni)')
            .eq('id_grado', materia.id_grado)
            .order('id_alumno'); // Orden estable

        if (errAlum) throw errAlum;

        if (!alumnos || alumnos.length === 0) {
            container.innerHTML = '<div class="p-5 text-center text-info">No hay estudiantes en este grado.</div>';
            return;
        }

        // 3. Renderizar Lista (Tabla simple)
        let html = `
            <table class="table table-hover mb-0 align-middle">
                <thead class="table-light sticky-top">
                    <tr>
                        <th style="width: 50%;" class="ps-4">Alumno</th>
                        <th style="width: 20%;">DNI</th>
                        <th style="width: 30%;">Calificación (0-10)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        alumnos.forEach(alum => {
            const nombre = alum.usuarios ? `${alum.usuarios.nombre} ${alum.usuarios.apellido}` : 'Desconocido';
            const dni = alum.usuarios?.dni || '-';

            html += `
                <tr class="fila-alumno-calif" data-id="${alum.id_alumno}">
                    <td class="ps-4 fw-bold">${nombre}</td>
                    <td class="text-muted">${dni}</td>
                    <td>
                        <input type="number" class="form-control input-nota fw-bold text-center" 
                               min="1" max="10" step="0.5" placeholder="-" 
                               style="max-width: 100px;">
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        conteoSpan.textContent = `${alumnos.length} estudiantes`;

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="p-3 alert alert-danger">Error: ${error.message}</div>`;
    }

}
/**
 * Guarda las calificaciones masivas
 */
async function handleGuardarCalificacionesMasivas(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');

    const idMateria = document.getElementById('califMateriaMasiva').value;
    const periodo = document.getElementById('califPeriodoMasiva').value;
    const tipoEval = document.getElementById('califTipoMasiva').value;
    const fecha = document.getElementById('califFechaMasiva').value;

    if (!idMateria || !periodo || !tipoEval || !fecha) {
        showMessage('Por favor complete todos los datos de la evaluación.', 'Error');
        return;
    }

    const filas = document.querySelectorAll('.fila-alumno-calif');
    let notasParaGuardar = [];

    // Recolectar datos
    filas.forEach(fila => {
        const input = fila.querySelector('.input-nota');
        const notaVal = input.value;

        if (notaVal !== '' && notaVal !== null) {
            notasParaGuardar.push({
                id_alumno: fila.dataset.id,
                nota: parseFloat(notaVal)
            });
        }
    });

    if (notasParaGuardar.length === 0) {
        showMessage('No has ingresado ninguna nota.', 'Aviso');
        return;
    }

    // Confirmación
    if (!confirm(`Vas a guardar ${notasParaGuardar.length} calificaciones. ¿Continuar?`)) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    try {
        let guardados = 0;

        // Procesar uno por uno (para asegurar inscripción)
        for (const item of notasParaGuardar) {
            // 1. Buscar/Crear Inscripción
            let { data: inscripcion } = await supabase
                .from('inscripciones')
                .select('id_inscripcion')
                .eq('id_alumno', item.id_alumno)
                .eq('id_materia', idMateria)
                .maybeSingle();

            let idInscripcion = inscripcion?.id_inscripcion;

            if (!idInscripcion) {
                const { data: nueva } = await supabase
                    .from('inscripciones')
                    .insert({ id_alumno: item.id_alumno, id_materia: idMateria })
                    .select('id_inscripcion')
                    .single();
                idInscripcion = nueva.id_inscripcion;
            }

            // 2. Insertar Calificación
            const { error } = await supabase.from('calificaciones').insert({
                id_inscripcion: idInscripcion,
                nota: item.nota,
                tipo_evaluacion: tipoEval,
                periodo: periodo,
                fecha: fecha,
                observaciones: '' // Opcional
            });

            if (!error) guardados++;
        }

        showMessage(`Se guardaron ${guardados} notas correctamente.`, 'Éxito');

        // Limpiar inputs de notas pero dejar el encabezado para seguir cargando si quiere
        document.querySelectorAll('.input-nota').forEach(i => i.value = '');

    } catch (error) {
        console.error(error);
        showMessage('Error al guardar: ' + error.message, 'Error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save me-2"></i> Guardar Notas';
    }

}
/**
 * Carga el historial de calificaciones aplicando filtros
 */
async function loadHistorialCalificaciones() {
    const tbody = document.getElementById('historial-calificaciones-body');
    const idMateria = document.getElementById('historialCalifMateria').value;
    const fecha = document.getElementById('historialCalifFecha').value;

    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><span class="spinner-border spinner-border-sm"></span> Buscando...</td></tr>';

    try {
        // Consulta base
        let query = supabase
            .from('calificaciones')
            .select(`
                id_calificacion,
                nota,
                tipo_evaluacion,
                periodo,
                fecha,
                inscripciones!inner (
                    id_materia,
                    alumnos ( usuarios (nombre, apellido, dni) ),
                    materias ( nombre_materia, id_docente )
                )
            `)
            .eq('inscripciones.materias.id_docente', currentDocenteId) // Solo mis materias
            .order('fecha', { ascending: false });

        // --- APLICAR FILTROS ---
        if (idMateria) {
            query = query.eq('inscripciones.id_materia', idMateria);
        }
        if (fecha) {
            query = query.eq('fecha', fecha);
        }

        const { data: notas, error } = await query;

        if (error) throw error;

        if (!notas || notas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron calificaciones con esos filtros.</td></tr>';
            return;
        }

        let html = '';

        notas.forEach(n => {
            const alumno = n.inscripciones.alumnos.usuarios;
            const materia = n.inscripciones.materias.nombre_materia;
            const nombreAlumno = `${alumno.nombre} ${alumno.apellido}`;
            const badgeColor = n.nota >= 6 ? 'bg-success-subtle text-success border-success' : 'bg-danger-subtle text-danger border-danger';
            
            // Fecha segura
            const fechaFmt = n.fecha ? new Date(n.fecha + 'T00:00:00').toLocaleDateString() : '-';

            html += `
                <tr>
                    <td class="text-muted small">${fechaFmt}</td>
                    <td class="fw-bold text-primary small">${materia}</td>
                    <td>
                        <div class="fw-medium text-dark">${nombreAlumno}</div>
                    </td>
                    <td>
                        <div class="small fw-bold">${n.tipo_evaluacion}</div>
                        <div class="small text-muted" style="font-size: 0.7rem">${n.periodo || '-'}</div>
                    </td>
                    <td class="text-center">
                        <span class="badge ${badgeColor} border fs-6" style="min-width: 40px;">${n.nota}</span>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="borrarCalificacion(${n.id_calificacion})" title="Eliminar nota">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
}

// Función GLOBAL para poder usarla en el onclick del HTML
window.borrarCalificacion = async (idCalificacion) => {
    if (!confirm("¿Estás seguro de eliminar esta calificación?")) return;

    try {
        const { error } = await supabase
            .from('calificaciones')
            .delete()
            .eq('id_calificacion', idCalificacion);

        if (error) throw error;

        showMessage("Calificación eliminada.", "Éxito");
        loadHistorialCalificaciones(); // Recargar tabla

    } catch (e) {
        console.error(e);
        showMessage("No se pudo eliminar: " + e.message, "Error");
    }
};

// Función GLOBAL para poder usarla en el onclick del HTML
window.borrarCalificacion = async (idCalificacion) => {
    if (!confirm("¿Estás seguro de eliminar esta calificación?")) return;

    try {
        const { error } = await supabase
            .from('calificaciones')
            .delete()
            .eq('id_calificacion', idCalificacion);

        if (error) throw error;

        showMessage("Calificación eliminada.", "Éxito");
        loadHistorialCalificaciones(); // Recargar tabla

    } catch (e) {
        console.error(e);
        showMessage("No se pudo eliminar: " + e.message, "Error");
    }
};

// Función para borrar una calificación (Hacerla global para el onclick)
window.borrarCalificacion = async (idCalificacion) => {
    if (!confirm("¿Estás seguro de eliminar esta calificación?")) return;

    try {
        const { error } = await supabase
            .from('calificaciones')
            .delete()
            .eq('id_calificacion', idCalificacion);

        if (error) throw error;

        showMessage("Calificación eliminada.", "Éxito");
        loadHistorialCalificaciones(); // Recargar tabla

    } catch (e) {
        console.error(e);
        showMessage("No se pudo eliminar: " + e.message, "Error");
    }
};

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
        const tipoEval = form.califTipo.value; // Ej: Examen
        registrarActividad('calificacion', `Subiste notas de: ${tipoEval}.`);
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


/**
 * VERSIÓN ASISTENCIA: Detecta certificados y marca PRESENTE por defecto
 */
async function loadEstudiantesParaAsistencia(id_materia, fecha) {
    const container = document.getElementById('asistencia-lista-alumnos');
    const conteoSpan = document.getElementById('asistencia-conteo-alumnos');

    if (!id_materia || !fecha) {
        container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-calendar-event fa-2x mb-2"></i><br>Seleccione una materia y fecha.</div>';
        conteoSpan.textContent = '0 estudiantes';
        return;
    }

    container.innerHTML = '<div class="p-5 text-center text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando estudiantes...</div>';

    try {
        // 1. Obtener grado
        const { data: materia, error: errMat } = await supabase.from('materias').select('id_grado').eq('id_materia', id_materia).single();
        if (errMat) throw errMat;

        // 2. Obtener alumnos
        const { data: alumnos, error: errAlum } = await supabase
            .from('alumnos')
            .select('id_alumno, usuarios(nombre, apellido, dni)')
            .eq('id_grado', materia.id_grado)
            .order('id_alumno');

        if (errAlum) throw errAlum;

        if (!alumnos || alumnos.length === 0) {
            container.innerHTML = '<div class="p-5 text-center text-info"><i class="bi bi-info-circle fa-2x mb-2"></i><br>No hay estudiantes en este grado.</div>';
            return;
        }

        // 3. Obtener asistencias ya registradas (para respetar si se está editando una fecha pasada)
        const { data: asistencias } = await supabase
            .from('asistencias')
            .select('estado, inscripciones(id_alumno)')
            .eq('fecha', fecha)
            .eq('inscripciones.id_materia', id_materia);

        const mapaAsistencias = new Map();
        if (asistencias) {
            asistencias.forEach(a => { if (a.inscripciones) mapaAsistencias.set(a.inscripciones.id_alumno, a.estado); });
        }

        // 4. Buscar Certificados Médicos
        const { data: certificados } = await supabase
            .from('certificados_medicos')
            .select('id_alumno')
            .eq('estado', 'aprobado')
            .lte('fecha_inicio', fecha)
            .gte('fecha_fin', fecha);

        const setCertificados = new Set(certificados?.map(c => c.id_alumno) || []);

        // 5. Renderizar lista
        container.innerHTML = '';
        conteoSpan.textContent = `${alumnos.length} estudiantes`;

        alumnos.forEach(alum => {
            const id = alum.id_alumno;
            const nombre = alum.usuarios ? `${alum.usuarios.nombre} ${alum.usuarios.apellido}` : 'Desconocido';
            const dni = alum.usuarios?.dni || '';

            // --- LÓGICA DE ESTADO POR DEFECTO ---
            let estado = mapaAsistencias.get(id); // 1. Buscamos si ya existe en la BD
            const tieneCertificado = setCertificados.has(id);

            if (!estado) { 
                // Si NO existe registro previo (es una asistencia nueva):
                if (tieneCertificado) {
                    estado = 'justificado'; // Prioridad al certificado
                } else {
                    estado = 'presente';    // DEFAULT: Todo el mundo presente
                }
            }
            // ------------------------------------

            // Badge visual de certificado
            const iconCert = tieneCertificado 
                ? `<i class="bi bi-file-medical text-info ms-2" title="Certificado Médico Activo"></i>` 
                : '';

            container.innerHTML += `
                <div class="student-attendance-row" data-id-alumno="${id}">
                    <div class="student-name-box">
                        <div class="fw-bold text-dark mb-0">${nombre} ${iconCert}</div>
                        <small class="text-muted" style="font-size: 0.75rem;">DNI: ${dni}</small>
                    </div>

                    <div class="attendance-btn-group" role="group">
                        
                        <input type="radio" class="btn-check" name="status-${id}" id="status-p-${id}" value="presente" ${estado === 'presente' ? 'checked' : ''}>
                        <label class="btn btn-outline-success" for="status-p-${id}" title="Presente">Presente</label>

                        <input type="radio" class="btn-check" name="status-${id}" id="status-a-${id}" value="ausente" ${estado === 'ausente' ? 'checked' : ''}>
                        <label class="btn btn-outline-danger" for="status-a-${id}" title="Ausente">Ausente</label>

                        <input type="radio" class="btn-check" name="status-${id}" id="status-t-${id}" value="tarde" ${estado === 'tarde' ? 'checked' : ''}>
                        <label class="btn btn-outline-warning" for="status-t-${id}" title="Tarde">Tarde</label>

                        <input type="radio" class="btn-check" name="status-${id}" id="status-j-${id}" value="justificado" ${estado === 'justificado' ? 'checked' : ''}>
                        <label class="btn btn-outline-info" for="status-j-${id}" title="Justificado">Justif.</label>
                    
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
            // Obtenemos el nombre de la materia del select para que quede bonito
            const nombreMateria = document.getElementById('asistenciaMateria').selectedOptions[0].text;
            registrarActividad('asistencia', `Registraste asistencia en ${nombreMateria}.`);
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


/**
 * Registra una acción en la bitácora del docente
 * @param {string} tipo - 'asistencia', 'calificacion', 'certificado', 'materia'
 * @param {string} descripcion - Texto corto explicativo
 */
async function registrarActividad(tipo, descripcion) {
    try {
        const { error } = await supabase
            .from('actividad_docente')
            .insert({
                id_docente: currentDocenteId,
                tipo: tipo,
                descripcion: descripcion
            });

        if (error) console.error("Error guardando actividad:", error);

        // Actualizar el dashboard visualmente si estamos en él
        loadActividadReciente();
    } catch (e) {
        console.error(e);
    }
}
/**
 * Carga y renderiza la lista de actividad reciente desde la tabla nueva
 */
async function loadActividadReciente() {
    const container = document.getElementById('actividad-reciente-container');
    // Si no estamos en la pestaña dashboard, quizas no exista el contenedor, validamos:
    if (!container) return;

    const { data: actividades, error } = await supabase
        .from('actividad_docente')
        .select('*')
        .eq('id_docente', currentDocenteId)
        .order('created_at', { ascending: false })
        .limit(20); // Mostrar las últimas 10

    container.innerHTML = '';

    if (error || !actividades || actividades.length === 0) {
        container.innerHTML = '<div class="list-group-item text-muted">No hay actividad reciente registrada.</div>';
        return;
    }

    // Mapa de iconos y colores según el tipo
    const config = {
        'asistencia': { icon: 'bi-calendar-check', color: 'text-success', bg: 'bg-success-subtle' },
        'calificacion': { icon: 'bi-pencil-square', color: 'text-primary', bg: 'bg-primary-subtle' },
        'certificado': { icon: 'bi-file-medical', color: 'text-info', bg: 'bg-info-subtle' },
        'materia': { icon: 'bi-book', color: 'text-warning', bg: 'bg-warning-subtle' },
        'tarea': { icon: 'bi-list-task', color: 'text-secondary', bg: 'bg-secondary-subtle' } // Por si agregas tareas
    };

    actividades.forEach(act => {
        const cfg = config[act.tipo] || { icon: 'bi-activity', color: 'text-dark', bg: 'bg-light' };
        const fecha = new Date(act.created_at).toLocaleString();

        container.innerHTML += `
            <div class="list-group-item d-flex align-items-start gap-3 py-3">
                <div class="rounded-circle ${cfg.bg} ${cfg.color} p-2 d-flex justify-content-center align-items-center flex-shrink-0" style="width: 40px; height: 40px;">
                    <i class="bi ${cfg.icon} fs-5"></i>
                </div>
                <div class="w-100">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-1 fw-bold text-capitalize">${act.tipo}</h6>
                        <small class="text-muted" style="font-size: 0.75em;">${fecha}</small>
                    </div>
                    <p class="mb-0 text-muted small">${act.descripcion}</p>
                </div>
            </div>
        `;
    });
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