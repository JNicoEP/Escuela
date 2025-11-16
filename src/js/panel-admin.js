/* ----------------------------------
    Lógica para Panel de Admin (CON SUPABASE)
    (panel-admin.js - Módulo ESM)
---------------------------------- */
'use strict';

// 1. IMPORTAR SUPABASE
import { supabase, showMessage } from '../js/supabaseClient.js';

// --- Referencias al DOM ---
const welcomeAlert = document.getElementById('welcome-alert');
let currentUser = null; // Para guardar el usuario admin
let currentDocenteFilter = 'pendiente'; // Estado del filtro de docentes
let allUsersData = []; // Para guardar los datos de los usuarios
let allRolesData = []; // Para guardar los roles (1, 2, 3)

// Pestaña Auditoría
const auditoriaTableBody = document.getElementById('auditoria-table-body');
const auditoriaFilterButtons = document.querySelectorAll('#auditoria-tab-pane .btn-success-soft');

// Pestaña Gestión Docentes
const docentesTableBody = document.getElementById('docentes-table-body');
const docenteFilterButtons = document.querySelectorAll('#gestion-docentes-tab-pane .btn-success-soft');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const bulkActionsContainer = document.getElementById('bulk-actions-container');
const bulkActionSelect = document.getElementById('bulk-action-select');
const bulkApplyBtn = document.getElementById('bulk-apply-btn');
const bulkCountSpan = document.getElementById('bulk-count');

// Pestaña Documentación
const documentacionList = document.getElementById('documentacion-list');
const filtroGrado = document.getElementById('filtro-grado');
const filtroProfesor = document.getElementById('filtro-profesor');

// Pestaña Mensajería
const adminRecibidosLista = document.getElementById('admin-recibidos-lista');
const adminEnviadosLista = document.getElementById('admin-enviados-lista');
const adminMensajePara = document.getElementById('admin-mensaje-para');
const adminEnviarMensajeBtn = document.getElementById('admin-enviar-mensaje-btn');
const formAdminNuevoMensaje = document.getElementById('form-admin-nuevo-mensaje');

// Modal de Detalles de Usuario
const userDetailsModalEl = document.getElementById('userDetailsModal');
const userDetailsModal = new bootstrap.Modal(userDetailsModalEl);
const formEditUser = document.getElementById('formEditUser');
const modalAlumnoInfo = document.getElementById('modal-alumno-info');


/**
 * Función principal que se ejecuta cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- Lógica para desvanecer el saludo ---
    if (welcomeAlert) {
        setTimeout(() => {
            welcomeAlert.classList.add('fade-out');
            welcomeAlert.addEventListener('transitionend', () => {
                welcomeAlert.style.display = 'none';
            }, { once: true });
        }, 5000);
    }

    // --- Carga de Datos y Autenticación ---
    await loadPanelData();

    // Configurar los listeners de los filtros
    setupTabsAndFilters();
});

/**
 * Verifica la sesión, el rol del usuario y carga los datos iniciales.
 */
async function loadPanelData() {
    // 1. Obtener y verificar el usuario
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "/index.html";
        return;
    }
    currentUser = user;

    // 2. Verificar que el usuario sea un admin
    const { data, error } = await supabase
        .from('usuarios')
        .select('rol:rol(nombre_rol)')
        .eq('id_usuario', user.id)
        .single();

    if (error || !data || data.rol.nombre_rol !== 'admin') {
        showMessage('Acceso no autorizado.', 'Error');
        await supabase.auth.signOut();
        window.location.href = "/index.html";
        return;
    }

    // 3. Carga inicial de datos para todas las pestañas
    await loadAllRoles(); // Carga los roles para el dropdown
    await renderAuditoria('todos'); // "Ver Todos" por defecto
    await renderDocentes(currentDocenteFilter);
    await renderDocumentos();
    await renderMensajesAdmin();
    await populateMensajeSelect();
    await populateGradoFilter();
}

/**
 * Configura todos los event listeners para los botones de filtro y acciones.
 */
function setupTabsAndFilters() {

    // --- Pestaña Auditoría/Usuarios ---
    auditoriaFilterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            auditoriaFilterButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderAuditoria(e.currentTarget.dataset.rol);
        });
    });

    auditoriaTableBody.addEventListener('click', (e) => {
        // Botón Borrar
        const deleteButton = e.target.closest('.delete-user-btn');
        if (deleteButton) {
            const userId = deleteButton.dataset.id;
            const userName = deleteButton.dataset.name;
            handleSoftDeleteUser(userId, userName);
        }
        // Botón Ver/Editar
        const editButton = e.target.closest('.edit-user-btn');
        if (editButton) {
            const userId = editButton.dataset.id;
            const user = allUsersData.find(u => u.id_usuario === userId);
            if (user) {
                openUserDetailsModal(user);
            }
        }
    });

    // Listener para el formulario del modal de edición
    formEditUser.addEventListener('submit', (e) => {
        e.preventDefault();
        handleUpdateRole();
    });

    // --- Pestaña Gestión Docentes ---
    docenteFilterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            docenteFilterButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentDocenteFilter = e.currentTarget.dataset.estado;
            renderDocentes(currentDocenteFilter);
        });
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        docentesTableBody.querySelectorAll('.docente-checkbox').forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
        updateBulkActionsUI();
    });

    bulkApplyBtn.addEventListener('click', handleBulkUpdate);

    // --- Pestaña Documentación ---
    filtroGrado.addEventListener('change', renderDocumentos);
    filtroProfesor.addEventListener('input', renderDocumentos);

    // --- Pestaña Mensajería ---
    adminEnviarMensajeBtn.addEventListener('click', handleSendMensaje);
}

// =================================================================
// PESTAÑA 1: GESTIÓN DE USUARIOS (antes Auditoría)
// =================================================================

/**
 * Renderiza la tabla de Gestión de Usuarios
 */
/**
 * Renderiza la tabla de Gestión de Usuarios
 */
async function renderAuditoria(filtroRol = 'todos') {
    auditoriaTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';

    let query = supabase
        .from('usuarios')
        .select(`
            id_usuario, nombre, apellido, email, dni, fecha_creacion, is_active,
            rol:rol ( id_rol, nombre_rol ),
            alumnos (
                fecha_nacimiento, direccion, telefono,
                tutor_nombre, tutor_educacion, tutor_trabajo,
                grado ( nombre_grado )
            )
        `)
        .order('fecha_creacion', { ascending: false })
        .eq('is_active', true); // Solo usuarios activos

    if (filtroRol !== 'todos') {
        query = query.eq('rol.nombre_rol', filtroRol);
    } else {
        query = query.in('rol.nombre_rol', ['alumno', 'docente']);
    }

    const { data: usuarios, error } = await query;

    if (error) {
        console.error('Error fetching usuarios:', error);
        auditoriaTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar usuarios.</td></tr>`;
        return;
    }

    if (usuarios.length === 0) {
        auditoriaTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay usuarios para este filtro.</td></tr>`;
        return;
    }

    allUsersData = usuarios; // Guardamos los datos globalmente
    let html = '';

    usuarios.forEach(user => {
        const userRoleName = user.rol ? user.rol.nombre_rol : 'Sin rol';
        let badgeClass = 'bg-secondary';
        if (userRoleName === 'docente') badgeClass = 'bg-primary-soft';
        if (userRoleName === 'alumno') badgeClass = 'bg-success-soft';

        html += `
            <tr>
                <td>${user.nombre} ${user.apellido}</td>
                <td>${user.email}</td>
                <td>${user.dni || 'N/A'}</td>
                <td><span class="badge ${badgeClass} fs-6">${userRoleName}</span></td>
                <td>${new Date(user.fecha_creacion).toLocaleDateString()}</td>
                
                <td>
                    <button class="btn btn-primary btn-sm edit-user-btn" 
                            data-id="${user.id_usuario}" 
                            title="Editar Rol"> <i class="fas fa-pencil-alt"></i> </button>
                    ${userRoleName !== 'admin' ? 
                    `<button class="btn btn-danger btn-sm delete-user-btn" 
                             data-id="${user.id_usuario}" 
                             data-name="${user.nombre} ${user.apellido}" title="Borrar">
                        <i class="fas fa-trash-alt"></i>
                    </button>` : ''}
                </td>
            </tr>
        `;
    });
    auditoriaTableBody.innerHTML = html;
}

/**
 * Desactiva un usuario (Borrado Lógico).
 * @param {string} userId - El ID (uuid) del usuario a borrar.
 * @param {string} userName - El nombre del usuario (para el confirm).
 */
async function handleSoftDeleteUser(userId, userName) {
    if (!confirm(`¿Estás seguro de que quieres desactivar al usuario "${userName}"? El usuario no podrá iniciar sesión.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('usuarios')
            .update({ is_active: false }) // <-- LA ACCIÓN DE BORRADO!
            .eq('id_usuario', userId);

        if (error) throw error;

        showMessage('Usuario desactivado con éxito.', 'Éxito');
        
        // Recarga la lista (obteniendo el filtro activo)
        const activeFilter = document.querySelector('#auditoria-tab-pane .btn-success-soft.active').dataset.rol;
        await renderAuditoria(activeFilter);

    } catch (error) {
        console.error('Error al desactivar usuario:', error);
        showMessage('Error al desactivar el usuario: ' + error.message, 'Error');
    }
}

/**
 * Carga todos los roles (alumno, docente, admin) en una variable global.
 */
async function loadAllRoles() {
    const { data, error } = await supabase.from('rol').select('*');
    if (error) {
        console.error('Error cargando roles:', error);
    } else {
        allRolesData = data;
    }
}

/**
 * Rellena el dropdown de roles en el modal.
 * @param {number} currentRoleId - El ID del rol actual del usuario.
 */
function populateRoleDropdown(currentRoleId) {
    const selectEl = document.getElementById('modal-user-rol');
    selectEl.innerHTML = ''; // Limpiar

    allRolesData.forEach(rol => {
        // No permitimos cambiar a "padre" ya que se eliminó
        if (rol.nombre_rol !== 'padre') {
            const option = document.createElement('option');
            option.value = rol.id_rol;
            option.textContent = rol.nombre_rol;
            selectEl.appendChild(option);
        }
    });
    
    // Seleccionar el rol actual del usuario
    selectEl.value = currentRoleId;
}

/**
 * Abre y rellena el modal de Detalles de Usuario.
 * @param {object} user - El objeto de usuario completo (con 'alumnos' y 'rol').
 */
function openUserDetailsModal(user) {
    // Guardar el ID en el modal para usarlo al guardar
    document.getElementById('modal-user-id').value = user.id_usuario;

    // Rellenar datos de USUARIO
    document.getElementById('modal-user-nombre').value = `${user.nombre} ${user.apellido}`;
    document.getElementById('modal-user-email').value = user.email;
    document.getElementById('modal-user-dni').value = user.dni || 'N/A';

    // =============================================
    //              ¡LA CORRECCIÓN!
    //   Verificamos si user.rol existe ANTES de usarlo
    // =============================================
    
    // 1. Obtenemos el ID del rol de forma segura
    const currentRoleId = user.rol ? user.rol.id_rol : null;

    // 2. Rellenamos el dropdown y le pasamos el ID (que puede ser null)
    populateRoleDropdown(currentRoleId);

    // =============================================
    //            FIN DE LA CORRECCIÓN
    // =============================================

    // Rellenar datos de ALUMNO (si existe)
    if (user.alumnos) {
        // Corrección: user.alumnos es un objeto, no un array
        const alumno = user.alumnos; 
        document.getElementById('modal-alumno-grado').value = alumno.grado ? alumno.grado.nombre_grado : 'N/A';
        document.getElementById('modal-alumno-fecha').value = alumno.fecha_nacimiento || '';
        document.getElementById('modal-alumno-telefono').value = alumno.telefono || 'N/A';
        document.getElementById('modal-alumno-direccion').value = alumno.direccion || 'N/A';
        document.getElementById('modal-tutor-nombre').value = alumno.tutor_nombre || 'N/A';
        document.getElementById('modal-tutor-trabajo').value = alumno.tutor_trabajo || 'N/A';
        document.getElementById('modal-tutor-educacion').value = alumno.tutor_educacion || 'N/A';
        
        modalAlumnoInfo.style.display = 'block'; // Mostrar la sección de alumno
    } else {
        modalAlumnoInfo.style.display = 'none'; // Ocultar si es docente
    }

    // Abrir el modal
    userDetailsModal.show();
}

/**
 * Lee el nuevo rol del modal y lo actualiza en la DB.
 */
async function handleUpdateRole() {
    const userId = document.getElementById('modal-user-id').value;
    const newRoleId = document.getElementById('modal-user-rol').value;

    if (!userId || !newRoleId) {
        showMessage('Error, no se pudo identificar al usuario o al rol.', 'Error');
        return;
    }

    try {
        const { error } = await supabase
            .from('usuarios')
            .update({ id_rol: newRoleId })
            .eq('id_usuario', userId);
        
        if (error) throw error;

        showMessage('Rol de usuario actualizado con éxito.', 'Éxito');
        userDetailsModal.hide(); // Ocultar modal
        
        const activeFilter = document.querySelector('#auditoria-tab-pane .btn-success-soft.active').dataset.rol;
        await renderAuditoria(activeFilter);

    } catch (error) {
        console.error('Error al actualizar rol:', error);
        showMessage('Error al actualizar el rol: ' + error.message, 'Error');
    }
}


// =================================================================
// PESTAÑA 2: GESTIÓN DOCENTES
// =================================================================

/**
 * Renderiza la tabla de Gestión Docentes
 * @param {string} filtroEstado - 'pendiente', 'aprobado', 'rechazado'.
 */
async function renderDocentes(filtroEstado) {
    currentDocenteFilter = filtroEstado;
    docentesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';
    selectAllCheckbox.checked = false;
    updateBulkActionsUI();

    const { data: docentes, error } = await supabase
        .from('docentes')
        .select(`
            id_docente,
            estado,
            usuario:usuarios (
                email,
                nombre,
                apellido
            )
        `)
        .eq('estado', filtroEstado);

    if (error) {
        console.error('Error fetching docentes:', error);
        docentesTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar docentes.</td></tr>`;
        return;
    }

    if (docentes.length === 0) {
        docentesTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay docentes ${filtroEstado}s.</td></tr>`;
        return;
    }
    
    let html = '';
    docentes.forEach(docente => {
        const usuario = docente.usuario;
        if (!usuario) return;

        const fullName = `${usuario.nombre} ${usuario.apellido}`;
        const badgeClass = {
            'pendiente': 'bg-warning-soft',
            'aprobado': 'bg-success-soft',
            'rechazado': 'bg-danger-soft'
        }[docente.estado];

        html += `
            <tr data-id="${docente.id_docente}">
                <td class="text-center">
                    <input class="form-check-input docente-checkbox" type="checkbox" value="${docente.id_docente}">
                </td>
                <td>${fullName}</td>
                <td>${usuario.email}</td>
                <td>
                    <span class="badge ${badgeClass} fs-6">${docente.estado}</span>
                </td>
                <td>
                    ${docente.estado !== 'aprobado' ? `
                        <button class="btn btn-success btn-sm btn-accion" data-accion="aprobado" title="Aprobar">
                            <i class="fas fa-check"></i>
                        </button>,
                    ` : ''}
                    ${docente.estado !== 'rechazado' ? `
                        <button class="btn btn-danger btn-sm btn-accion" data-accion="rechazado" title="Rechazar">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    ${docente.estado !== 'pendiente' ? `
                        <button class="btn btn-warning btn-sm btn-accion" data-accion="pendiente" title="Poner en Pendiente">
                            <i class="fas fa-clock"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    });
    
    docentesTableBody.innerHTML = html;
    addDocenteActionListeners();
}

/**
 * Añade listeners a los botones de acción individuales y checkboxes.
 */
function addDocenteActionListeners() {
    docentesTableBody.querySelectorAll('.btn-accion').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const docenteId = e.currentTarget.closest('tr').dataset.id;
            const nuevaAccion = e.currentTarget.dataset.accion;
            
            if (confirm(`¿Está seguro de que desea cambiar el estado de este docente a "${nuevaAccion}"?`)) {
                await updateDocenteEstado([docenteId], nuevaAccion);
                await renderDocentes(currentDocenteFilter);
            }
        });
    });

    docentesTableBody.querySelectorAll('.docente-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateBulkActionsUI();
        });
    });
}

/**
 * Actualiza la UI del menú de acciones en lote (lo muestra/oculta y actualiza el contador).
 */
function updateBulkActionsUI() {
    const selectedCheckboxes = docentesTableBody.querySelectorAll('.docente-checkbox:checked');
    const count = selectedCheckboxes.length;

    if (count > 0) {
        bulkCountSpan.textContent = `${count} seleccionado${count > 1 ? 's' : ''}`;
        bulkActionsContainer.style.display = 'block';
    } else {
        bulkActionsContainer.style.display = 'none';
    }

    const totalCheckboxes = docentesTableBody.querySelectorAll('.docente-checkbox').length;
    selectAllCheckbox.checked = (count > 0 && count === totalCheckboxes);
}

/**
 * Maneja el clic en el botón "Aplicar" para la actualización en lote.
 */
async function handleBulkUpdate() {
    const selectedIds = Array.from(docentesTableBody.querySelectorAll('.docente-checkbox:checked'))
                            .map(cb => cb.value);
    
    const nuevoEstado = bulkActionSelect.value;

    if (selectedIds.length === 0) {
        showMessage('No ha seleccionado ningún docente.', 'Error');
        return;
    }
    if (!nuevoEstado) {
        showMessage('Por favor, seleccione una acción para aplicar.', 'Error');
        return;
    }

    if (confirm(`¿Está seguro de que desea cambiar el estado de ${selectedIds.length} docente(s) a "${nuevoEstado}"?`)) {
        await updateDocenteEstado(selectedIds, nuevoEstado);
        await renderDocentes(currentDocenteFilter);
    }
}

/**
 * Función reutilizable para actualizar el estado de uno o varios docentes.
 * @param {string[]} ids - Array de IDs de docentes.
 * @param {string} estado - 'aprobado', 'rechazado', o 'pendiente'.
 */
async function updateDocenteEstado(ids, estado) {
    const { error } = await supabase
        .from('docentes')
        .update({ estado: estado })
        .in('id_docente', ids);
    
    if (error) {
        showMessage('Error al actualizar docentes: ' + error.message, 'Error');
    } else {
        showMessage(`Se actualizaron ${ids.length} docente(s) con éxito.`, 'Éxito');
    }
}


// =================================================================
// PESTAÑA 3: DOCUMENTACIÓN
// =================================================================

/**
 * Renderiza la lista de Documentación (Materiales)
 */
async function renderDocumentos() {
    documentacionList.innerHTML = '<p class="text-center text-muted">Cargando documentos...</p>';
    
    const gradoFiltro = filtroGrado.value;
    const profesorFiltro = filtroProfesor.value;

    let query = supabase
        .from('materiales')
        .select(`
            nombre_archivo,
            ubicacion_archivo,
            docente:docentes (
                usuario:usuarios (nombre, apellido)
            ),
            grado:grado (id_grado, nombre_grado),
            materia:materias (nombre_materia)
        `)
        .order('fecha_subida', { ascending: false });

    if (gradoFiltro) {
        query = query.eq('id_grado', gradoFiltro);
    }
    if (profesorFiltro.length > 2) {
        query = query.ilike('docente.usuario.nombre', `%${profesorFiltro}%`);
    }

    const { data: materiales, error } = await query;

    if (error) {
        console.error('Error fetching documentos:', error);
        documentacionList.innerHTML = '<p class="text-center text-danger">Error al cargar documentos.</p>';
        return;
    }

    if (materiales.length === 0) {
        documentacionList.innerHTML = '<p class="text-center text-muted">No hay documentos que coincidan con los filtros.</p>';
        return;
    }

    let html = '';
    materiales.forEach(doc => {
        const profesor = doc.docente?.usuario ? `${doc.docente.usuario.nombre} ${doc.docente.usuario.apellido}` : 'Desconocido';
        const grado = doc.grado?.nombre_grado || 'N/A';
        const materia = doc.materia?.nombre_materia || 'General';

        html += `
            <a href="${doc.ubicacion_archivo}" target="_blank" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center document-item">
                <div class="d-flex align-items-center">
                    <div class="icon me-3">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="info">
                        <h6 class="mb-0">${doc.nombre_archivo}</h6>
                        <span class="profesor">${profesor}</span> | 
                        <span class="grado">${grado} / ${materia}</span>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-download me-1"></i> Ver/Descargar
                </button>
            </a>
        `;
    });
    documentacionList.innerHTML = html;
}

/**
 * Llena el <select> de filtro de grados.
 */
async function populateGradoFilter() {
    const { data, error } = await supabase.from('grado').select('id_grado, nombre_grado');
    if (error) {
        console.error("Error cargando grados:", error);
        return;
    }
    data.forEach(grado => {
        filtroGrado.innerHTML += `<option value="${grado.id_grado}">${grado.nombre_grado}</option>`;
    });
}


// =================================================================
// PESTAÑA 4: MENSAJERÍA
// =================================================================

/**
 * Renderiza las listas de Mensajería
 */
async function renderMensajesAdmin() {
    adminRecibidosLista.innerHTML = '<p class="text-center text-muted p-3">Cargando...</p>';
    adminEnviadosLista.innerHTML = '<p class="text-center text-muted p-3">Cargando...</p>';

    // Mensajes Recibidos
    const { data: recibidos, error: errRecibidos } = await supabase
        .from('mensajes')
        .select(`
            id, asunto, contenido, created_at, is_read,
            sender:usuarios (nombre, apellido, rol:rol(nombre_rol))
        `)
        .eq('receiver_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (errRecibidos) {
        adminRecibidosLista.innerHTML = '<p class="text-center text-danger p-3">Error al cargar mensajes.</p>';
    } else {
        let recibidosHtml = '';
        recibidos.forEach(msg => {
            const remitente = msg.sender ? `${msg.sender.nombre} ${msg.sender.apellido} (${msg.sender.rol ? msg.sender.rol.nombre_rol : '...'})` : 'Usuario Eliminado';
            recibidosHtml += `
                <div class="list-group-item list-group-item-action mensaje-item ${!msg.is_read ? 'fw-bold' : ''}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 remitente">${remitente}</h6>
                        <small class="text-muted">${new Date(msg.created_at).toLocaleDateString()}</small>
                    </div>
                    <p class="mb-1 extracto">${msg.asunto || '(Sin Asunto)'}</p>
                    <small class="text-muted extracto">${msg.contenido.substring(0, 50)}...</small>
                </div>
            `;
        });
        adminRecibidosLista.innerHTML = recibidosHtml || '<p class="text-center text-muted p-3">No hay mensajes recibidos.</p>';
    }

    // Mensajes Enviados
    const { data: enviados, error: errEnviados } = await supabase
        .from('mensajes')
        .select(`
            id, asunto, contenido, created_at,
            receiver:usuarios (nombre, apellido, rol:rol(nombre_rol))
        `)
        .eq('sender_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (errEnviados) {
        adminEnviadosLista.innerHTML = '<p class="text-center text-danger p-3">Error al cargar mensajes.</p>';
    } else {
        let enviadosHtml = '';
        enviados.forEach(msg => {
            const destinatario = msg.receiver ? `${msg.receiver.nombre} ${msg.receiver.apellido} (${msg.receiver.rol ? msg.receiver.rol.nombre_rol : '...'})` : 'Usuario Eliminado';
            enviadosHtml += `
                <div class="list-group-item mensaje-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 remitente">Para: ${destinatario}</h6>
                        <small class="text-muted">${new Date(msg.created_at).toLocaleDateString()}</small>
                    </div>
                    <p class="mb-1 extracto">${msg.asunto || '(Sin Asunto)'}</p>
                </div>
            `;
        });
        adminEnviadosLista.innerHTML = enviadosHtml || '<p class="text-center text-muted p-3">No hay mensajes enviados.</p>';
    }
}

/**
 * Llena el <select> del modal de mensajes con docentes y padres.
 */
async function populateMensajeSelect() {
    let html = '<option value="">Seleccionar destinatario...</option>';

    // Cargar Docentes
    const { data: docentes, error: errDocentes } = await supabase
        .from('usuarios')
        .select(`
            id_usuario, 
            nombre, 
            apellido, 
            rol!inner(nombre_rol)
        `)
        .eq('rol.nombre_rol', 'docente');

    if (errDocentes) {
        console.error('Error al cargar destinatarios (docentes):', errDocentes);
    }

    if (docentes) {
        html += '<optgroup label="Docentes">';
        docentes.forEach(d => {
            html += `<option value="${d.id_usuario}">${d.nombre} ${d.apellido}</option>`;
        });
        html += '</optgroup>';
    }

    adminMensajePara.innerHTML = html;
}

/**
 * Maneja el envío del formulario de nuevo mensaje.
 */
async function handleSendMensaje() {
    const receiverId = adminMensajePara.value;
    const asunto = document.getElementById('admin-mensaje-asunto').value;
    const contenido = document.getElementById('admin-mensaje-cuerpo').value;

    if (!receiverId || !contenido) {
        showMessage('Debe seleccionar un destinatario y escribir un contenido.', 'Error');
        return;
    }

    const { error } = await supabase
        .from('mensajes')
        .insert({
            sender_id: currentUser.id,
            receiver_id: receiverId,
            asunto: asunto,
            contenido: contenido
        });

    if (error) {
        showMessage('Error al enviar el mensaje: ' + error.message, 'Error');
    } else {
        showMessage('Mensaje enviado con éxito.', 'Éxito');
        formAdminNuevoMensaje.reset();
        
        const modalEl = document.getElementById('adminNuevoMensajeModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) {
            modalInstance.hide();
        }
        
        await renderMensajesAdmin(); // Recargar listas de mensajes
    }
}