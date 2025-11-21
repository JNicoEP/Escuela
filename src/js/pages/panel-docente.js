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
    // Esto evita el error "Cannot read properties of null"
    const safeAddListener = (id, eventType, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            // Opcional: Comentar esto si molesta en la consola, pero ayuda a saber qué falta
            console.warn(`Elemento HTML no encontrado: '${id}'. Verifica que el ID exista en el HTML.`);
        }
    };

    // 1. Botones Generales
    safeAddListener('btn-logout', 'click', handleLogout);

    // NUEVO: Botón para revisar certificados (si lo agregaste en el paso anterior)
    safeAddListener('btn-ver-certificados', 'click', abrirModalCertificados);

    // 2. Formularios de Edición y Búsqueda
    safeAddListener('form-editar-tarea', 'submit', handleGuardarEdicion);
    safeAddListener('btn-buscar-historial', 'click', buscarHistorialAsistencia);

    // 3. Formulario Editar Perfil Docente
    safeAddListener('form-editar-perfil-docente', 'submit', handleGuardarPerfilDocente);

    // 4. Formulario: Agregar Materia
    safeAddListener('form-agregar-materia', 'submit', handleAgregarMateria);

    // 5. Formulario: Crear Tarea
    safeAddListener('form-crear-tarea', 'submit', handleCrearTarea);

    // 6. Formulario: Registrar Calificación
    safeAddListener('form-registrar-calificacion', 'submit', handleRegistrarCalificacion);

    // 7. Formulario: Guardar Asistencia
    safeAddListener('form-control-asistencia', 'submit', handleGuardarAsistencia);

    // 8. Formulario: Enviar Mensaje
    safeAddListener('form-redactar-mensaje', 'submit', handleEnviarMensaje);

    // 9. Selects dinámicos (Logica de carga)
    const califMateria = document.getElementById('califMateria');
    if (califMateria) {
        califMateria.addEventListener('change', (e) => loadEstudiantesParaSelect(e.target.value, 'califInscripcion'));
    }

    const califSelectMateriaVer = document.getElementById('califSelectMateriaVer');
    if (califSelectMateriaVer) {
        califSelectMateriaVer.addEventListener('change', (e) => loadCalificaciones(e.target.value));
    }

    // 10. Lógica de Asistencia (Materia y Fecha)
    const asistenciaMateria = document.getElementById('asistenciaMateria');
    const asistenciaFecha = document.getElementById('asistenciaFecha');

    if (asistenciaMateria && asistenciaFecha) {
        asistenciaMateria.addEventListener('change', () => loadEstudiantesParaAsistencia(asistenciaMateria.value, asistenciaFecha.value));
        asistenciaFecha.addEventListener('change', () => loadEstudiantesParaAsistencia(asistenciaMateria.value, asistenciaFecha.value));
    }

    // 11. Botones "Marcar Todos" en Asistencia
    safeAddListener('btn-marcar-presente', 'click', () => marcarTodosAsistencia('presente'));
    safeAddListener('btn-marcar-ausente', 'click', () => marcarTodosAsistencia('ausente'));
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
}
// ==========================================
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
 * VERSIÓN ASISTENCIA: Detecta certificados médicos activos
 */
async function loadEstudiantesParaAsistencia(id_materia, fecha) {
    const container = document.getElementById('asistencia-lista-alumnos');
    if (!id_materia || !fecha) {
        container.innerHTML = '<div class="p-3 text-center text-muted">Seleccione una materia y fecha.</div>';
        document.getElementById('asistencia-conteo-alumnos').textContent = '0 estudiantes';
        return;
    }

    container.innerHTML = '<div class="p-3 text-center text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando estudiantes y verificando certificados...</div>';

    try {
        // 1. Obtener grado
        const { data: materia } = await supabase.from('materias').select('id_grado').eq('id_materia', id_materia).single();
        if (!materia) throw new Error("Materia no encontrada");

        // 2. Obtener alumnos
        const { data: alumnos } = await supabase
            .from('alumnos')
            .select('id_alumno, usuarios(nombre, apellido)')
            .eq('id_grado', materia.id_grado)
            .order('id_alumno'); // Orden constante

        if (!alumnos || alumnos.length === 0) {
            container.innerHTML = '<div class="p-3 alert alert-info">No hay estudiantes en este grado.</div>';
            return;
        }

        // 3. Obtener asistencias ya registradas
        const { data: asistencias } = await supabase
            .from('asistencias')
            .select('estado, inscripciones(id_alumno)')
            .eq('fecha', fecha)
            .eq('inscripciones.id_materia', id_materia);

        const mapaAsistencias = new Map();
        if (asistencias) {
            asistencias.forEach(a => { if (a.inscripciones) mapaAsistencias.set(a.inscripciones.id_alumno, a.estado); });
        }

        // 4. NUEVO: Buscar Certificados Médicos Válidos para esa fecha
        // Buscamos certificados aprobados donde la fecha seleccionada esté dentro del rango
        const { data: certificados } = await supabase
            .from('certificados_medicos')
            .select('id_alumno')
            .eq('estado', 'aprobado') // Solo los aprobados cuentan para justificar
            .lte('fecha_inicio', fecha) // Inicio <= fecha
            .gte('fecha_fin', fecha);   // Fin >= fecha

        const setCertificados = new Set();
        if (certificados) {
            certificados.forEach(c => setCertificados.add(c.id_alumno));
        }

        // 5. Renderizar
        container.innerHTML = '';
        document.getElementById('asistencia-conteo-alumnos').textContent = `${alumnos.length} estudiantes`;

        alumnos.forEach(alum => {
            const id = alum.id_alumno;
            const nombre = alum.usuarios ? `${alum.usuarios.nombre} ${alum.usuarios.apellido}` : 'Desconocido';

            // Estado previo de la BD
            let estado = mapaAsistencias.get(id);

            // Si no hay estado guardado, pero tiene certificado médico, sugerimos "Justificado"
            let tieneCertificado = setCertificados.has(id);
            if (!estado && tieneCertificado) {
                estado = 'justificado';
            }

            // Badge visual de certificado
            const badgeCertificado = tieneCertificado
                ? `<span class="badge bg-info text-white ms-2" title="Certificado Médico Activo"><i class="bi bi-file-medical"></i> Con Certificado</span>`
                : '';

            container.innerHTML += `
                <div class="student-attendance-row border-bottom py-2" data-id-alumno="${id}">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="fw-bold">
                            ${nombre} ${badgeCertificado}
                        </div>
                    </div>
                    <div class="btn-group w-100" role="group">
                        <input type="radio" class="btn-check" name="status-${id}" id="status-p-${id}" value="presente" ${estado === 'presente' ? 'checked' : ''}>
                        <label class="btn btn-outline-success btn-sm" for="status-p-${id}">Presente</label>

                        <input type="radio" class="btn-check" name="status-${id}" id="status-a-${id}" value="ausente" ${estado === 'ausente' ? 'checked' : ''}>
                        <label class="btn btn-outline-danger btn-sm" for="status-a-${id}">Ausente</label>

                        <input type="radio" class="btn-check" name="status-${id}" id="status-t-${id}" value="tarde" ${estado === 'tarde' ? 'checked' : ''}>
                        <label class="btn btn-outline-warning btn-sm" for="status-t-${id}">Tarde</label>

                        <input type="radio" class="btn-check" name="status-${id}" id="status-j-${id}" value="justificado" ${estado === 'justificado' ? 'checked' : ''}>
                        <label class="btn btn-outline-info btn-sm" for="status-j-${id}">Justif.</label>
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