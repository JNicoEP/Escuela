/* ----------------------------------
   Lógica para Panel de Admin (CON SUPABASE)
   (panel-admin.js - Módulo ESM)
---------------------------------- */
'use strict';

// ¡NUEVO! Importamos el cliente de Supabase
// Ajusta esta ruta si es necesario (ej: '../js/supabaseClient.js')
import { supabase, showMessage } from '../js/supabaseClient.js';

// --- Referencias al DOM ---
const welcomeAlert = document.getElementById('welcome-alert');
let currentUser = null; // Para guardar el usuario admin
let currentDocenteFilter = 'pendiente'; // Estado del filtro de docentes

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "/index.html";
        return;
    }
    currentUser = user;

    // Verificar que el usuario sea un admin
    const { data, error } = await supabase
        .from('usuarios')
        .select('rol:rol(nombre_rol)')
        .eq('id', user.id)
        .single();
    
    if (error || !data || data.rol.nombre_rol !== 'admin') {
        showMessage('Acceso no autorizado.', 'Error');
        await supabase.auth.signOut();
        window.location.href = "/index.html";
        return;
    }

    // Carga inicial de datos para todas las pestañas
    await renderAuditoria('todos');
    await renderDocentes(currentDocenteFilter); // 'pendiente' por defecto
    await renderDocumentos();
    await renderMensajesAdmin();
    await populateMensajeSelect();
    await populateGradoFilter();
}

/**
 * Configura todos los event listeners para los botones de filtro y acciones.
 */
function setupTabsAndFilters() {
    // --- Pestaña Auditoría ---
    auditoriaFilterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            auditoriaFilterButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderAuditoria(e.currentTarget.dataset.rol);
        });
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

    // Checkbox "Seleccionar Todos"
    selectAllCheckbox.addEventListener('change', (e) => {
        docentesTableBody.querySelectorAll('.docente-checkbox').forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
        updateBulkActionsUI();
    });

    // Botón "Aplicar" acciones en lote
    bulkApplyBtn.addEventListener('click', handleBulkUpdate);

    // --- Pestaña Documentación ---
    filtroGrado.addEventListener('change', renderDocumentos);
    filtroProfesor.addEventListener('input', renderDocumentos);

    // --- Pestaña Mensajería ---
    adminEnviarMensajeBtn.addEventListener('click', handleSendMensaje);
}


// =================================================================
// PESTAÑA 1: AUDITORÍA
// =================================================================

/**
 * Renderiza la tabla de Auditoría consultando 'historial_accesos'.
 * @param {string} filtroRol - 'docente', 'alumno', 'padre' o 'todos'.
 */
async function renderAuditoria(filtroRol = 'todos') {
    auditoriaTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';

    let query = supabase
        .from('historial_accesos')
        .select(`
            user_id,
            rol,
            accion,
            ip_address,
            timestamp
        `)
        .order('timestamp', { ascending: false })
        .limit(50);

    if (filtroRol !== 'todos') {
        query = query.eq('rol', filtroRol);
    }

    const { data: historial, error } = await query;

    if (error) {
        console.error('Error fetching auditoria:', error);
        auditoriaTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar historial.</td></tr>`;
        return;
    }

    if (historial.length === 0) {
        auditoriaTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay registros para este filtro.</td></tr>`;
        return;
    }

    let html = '';
    historial.forEach(log => {
        html += `
            <tr>
                <td>${log.user_id ? log.user_id.substring(0, 8) : 'N/A'}...</td>
                <td>${log.rol || 'N/A'}</td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>
                    <span class="badge ${log.accion === 'LOGIN_SUCCESS' ? 'bg-success-soft' : 'bg-danger-soft'}">
                        ${log.accion}
                    </span>
                </td>
                <td>${log.ip_address || 'N/A'}</td>
            </tr>
        `;
    });
    auditoriaTableBody.innerHTML = html;
}


// =================================================================
// PESTAÑA 2: GESTIÓN DOCENTES
// =================================================================

/**
 * Renderiza la tabla de Gestión Docentes
 * @param {string} filtroEstado - 'pendiente', 'aprobado', 'rechazado'.
 */
async function renderDocentes(filtroEstado) {
    currentDocenteFilter = filtroEstado; // Guardar estado actual
    docentesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';
    selectAllCheckbox.checked = false; // Desmarcar al recargar
    updateBulkActionsUI(); // Ocultar menú bulk

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
                        </button>
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
    
    // Botones de acción individuales (Aprobar, Rechazar, Pendiente)
    docentesTableBody.querySelectorAll('.btn-accion').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const docenteId = e.currentTarget.closest('tr').dataset.id;
            const nuevaAccion = e.currentTarget.dataset.accion;
            
            if (confirm(`¿Está seguro de que desea cambiar el estado de este docente a "${nuevaAccion}"?`)) {
                await updateDocenteEstado([docenteId], nuevaAccion);
                await renderDocentes(currentDocenteFilter); // Recargar la tabla
            }
        });
    });

    // Checkboxes individuales
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

    // Sincronizar "Seleccionar Todos"
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
        await renderDocentes(currentDocenteFilter); // Recargar la tabla
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

    // Aplicar filtros
    if (gradoFiltro) {
        query = query.eq('id_grado', gradoFiltro);
    }
    if (profesorFiltro.length > 2) {
        // Asumimos que el filtro de profesor busca en el nombre/apellido del docente
        query = query.ilike('docente.usuario.nombre', `%${profesorFiltro}%`);
        // Nota: Supabase puede tener limitaciones en filtros de tablas anidadas.
        // Una mejor forma sería un RPC, pero esto puede funcionar.
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
        .select('id, nombre, apellido, rol:rol(nombre_rol)')
        .eq('rol.nombre_rol', 'docente');
    
    if (docentes) {
        html += '<optgroup label="Docentes">';
        docentes.forEach(d => {
            html += `<option value="${d.id}">${d.nombre} ${d.apellido}</option>`;
        });
        html += '</optgroup>';
    }

    // Cargar Padres (Aún no tienes padres en tu schema, esto es un placeholder)
    // const { data: padres, error: errPadres } = ...
    // html += '<optgroup label="Padres">';
    // ...
    // html += '</optgroup>';

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
        
        // Ocultar el modal manualmente
        const modalEl = document.getElementById('adminNuevoMensajeModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) {
            modalInstance.hide();
        }
        
        await renderMensajesAdmin(); // Recargar listas de mensajes
    }
}