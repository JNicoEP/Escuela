/* ----------------------------------
    Lógica para Panel de Admin (CON SUPABASE)
    (panel-admin.js - Módulo ESM)
---------------------------------- */
'use strict';

// 1. IMPORTAR SUPABASE
import { supabase, showMessage } from '../js/supabaseClient.js';

// --- Referencias al DOM ---
const welcomeAlert = document.getElementById('welcome-alert');
let currentUser = null; 
let currentDocenteFilter = 'pendiente';
let allUsersData = [];
let allRolesData = []; 

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

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    if (welcomeAlert) {
        setTimeout(() => {
            welcomeAlert.classList.add('fade-out');
            welcomeAlert.addEventListener('transitionend', () => {
                welcomeAlert.style.display = 'none';
            }, { once: true });
        }, 5000);
    }

    await loadPanelData();
    setupTabsAndFilters();
});

async function loadPanelData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "/index.html";
        return;
    }
    currentUser = user;

    // Verificar admin
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

    await loadAllRoles();
    await renderAuditoria('todos'); // Carga inicial: TODOS
    await renderDocentes(currentDocenteFilter);
    await renderDocumentos();
    await renderMensajesAdmin();
    await populateMensajeSelect();
    await populateGradoFilter();
}

function setupTabsAndFilters() {
    // --- Pestaña Auditoría/Usuarios ---
    auditoriaFilterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            auditoriaFilterButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            // El dataset.rol debe ser 'todos', 'docente' o 'alumno'
            renderAuditoria(e.currentTarget.dataset.rol); 
        });
    });

    auditoriaTableBody.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-user-btn');
        if (deleteButton) {
            const userId = deleteButton.dataset.id;
            const userName = deleteButton.dataset.name;
            handleSoftDeleteUser(userId, userName);
        }
        const editButton = e.target.closest('.edit-user-btn');
        if (editButton) {
            const userId = editButton.dataset.id;
            const user = allUsersData.find(u => u.id_usuario === userId);
            if (user) openUserDetailsModal(user);
        }
    });

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

    // --- Otras Pestañas ---
    filtroGrado.addEventListener('change', renderDocumentos);
    filtroProfesor.addEventListener('input', renderDocumentos);
    adminEnviarMensajeBtn.addEventListener('click', handleSendMensaje);
}

// =================================================================
// PESTAÑA 1: GESTIÓN DE USUARIOS (AUDITORÍA)
// =================================================================

async function renderAuditoria(filtroRol = 'todos') {
    auditoriaTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div> Cargando...</td></tr>';

    // 1. Construir la consulta
    // CAMBIO CLAVE: Usamos 'rol:rol!inner' en lugar de 'rol:rol'.
    // El '!inner' funciona como un filtro estricto: si el usuario no tiene rol (es null), NO lo trae.
    let query = supabase
        .from('usuarios')
        .select(`
            id_usuario, nombre, apellido, email, dni, fecha_creacion, is_active,
            rol:rol!inner ( id_rol, nombre_rol ),
            alumnos (
                fecha_nacimiento, direccion, telefono,
                tutor_nombre, tutor_educacion, tutor_trabajo,
                grado ( nombre_grado )
            ),
            docentes (
                estado, plaza,
                tirilla_cuil_path, fotocopia_dni_path, acta_nacimiento_path,
                declaracion_jurada_path, titulo_habilitante_path
            )
        `)
        .order('fecha_creacion', { ascending: false })
        .eq('is_active', true);

    // 2. Aplicar Filtros
    if (filtroRol !== 'todos') {
        // Si apretas "Ver Docentes" o "Ver Alumnos", filtra solo esos
        query = query.eq('rol.nombre_rol', filtroRol);
    } else {
        // CAMBIO CLAVE: Si apretas "Ver Todos", filtramos explícitamente
        // para mostrar SOLO 'alumno' y 'docente'.
        // Esto oculta a los 'admin' y asegura que no se cuelen otros roles raros.
        query = query.in('rol.nombre_rol', ['alumno', 'docente']);
    }

    const { data: usuarios, error } = await query;

    if (error) {
        console.error('Error fetching usuarios:', error);
        auditoriaTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar usuarios: ${error.message}</td></tr>`;
        return;
    }

    if (!usuarios || usuarios.length === 0) {
        auditoriaTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron usuarios con el rol seleccionado.</td></tr>`;
        return;
    }

    allUsersData = usuarios;
    let html = '';

    usuarios.forEach(user => {
        const userRoleName = user.rol.nombre_rol; // Ya sabemos que existe por el !inner
        let badgeClass = 'bg-secondary';
        
        if (userRoleName === 'docente') badgeClass = 'bg-primary text-white';
        if (userRoleName === 'alumno') badgeClass = 'bg-success text-white';

        html += `
            <tr>
                <td>
                    <div class="fw-bold">${user.nombre} ${user.apellido}</div>
                </td>
                <td>${user.email}</td>
                <td>${user.dni || '-'}</td>
                <td><span class="badge ${badgeClass}">${userRoleName.toUpperCase()}</span></td>
                <td>${new Date(user.fecha_creacion).toLocaleDateString()}</td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-outline-primary btn-sm edit-user-btn me-1" 
                                data-id="${user.id_usuario}" title="Ver Detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm delete-user-btn" 
                                 data-id="${user.id_usuario}" 
                                 data-name="${user.nombre} ${user.apellido}" title="Desactivar">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
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
 */
async function openUserDetailsModal(user) {
    // Guardar el ID en el modal
    document.getElementById('modal-user-id').value = user.id_usuario;

    // Rellenar datos de USUARIO
    document.getElementById('modal-user-nombre').value = `${user.nombre} ${user.apellido}`;
    document.getElementById('modal-user-email').value = user.email;
    document.getElementById('modal-user-dni').value = user.dni || 'N/A';

    // Rellenar dropdown de rol
    const currentRoleId = user.rol ? user.rol.id_rol : null;
    populateRoleDropdown(currentRoleId);

    // --- LÓGICA ALUMNO ---
    const divAlumno = document.getElementById('modal-alumno-info');
    if (user.alumnos) { // user.alumnos es un objeto si es single, o array si no
        const alumno = Array.isArray(user.alumnos) ? user.alumnos[0] : user.alumnos;
        if (alumno) {
            document.getElementById('modal-alumno-grado').value = alumno.grado ? alumno.grado.nombre_grado : 'N/A';
            document.getElementById('modal-alumno-fecha').value = alumno.fecha_nacimiento || '';
            document.getElementById('modal-alumno-telefono').value = alumno.telefono || 'N/A';
            document.getElementById('modal-alumno-direccion').value = alumno.direccion || 'N/A';
            document.getElementById('modal-tutor-nombre').value = alumno.tutor_nombre || 'N/A';
            document.getElementById('modal-tutor-trabajo').value = alumno.tutor_trabajo || 'N/A';
            document.getElementById('modal-tutor-educacion').value = alumno.tutor_educacion || 'N/A';
            divAlumno.style.display = 'block';
        } else {
            divAlumno.style.display = 'none';
        }
    } else {
        divAlumno.style.display = 'none';
    }

    // --- LÓGICA DOCENTE (NUEVO) ---
    const divDocente = document.getElementById('modal-docente-info');
    
    // Verificamos si tiene datos de docente
    // Nota: Supabase devuelve un array si la relación es hasMany o un objeto si es single. 
    // En tu consulta 'auditoria', 'docentes' suele venir como objeto o array dependiendo de la definición.
    // Asumiremos array o objeto seguro:
    const docenteData = Array.isArray(user.docentes) ? user.docentes[0] : user.docentes;

    if (docenteData) {
        divDocente.style.display = 'block';
        
        document.getElementById('modal-doc-estado').value = docenteData.estado?.toUpperCase() || 'PENDIENTE';
        document.getElementById('modal-doc-plaza').value = docenteData.plaza || 'No asignada';

        // Helper para configurar botones de archivo
        const setupFileBtn = async (path, btnId) => {
            const btn = document.getElementById(btnId);
            if (path) {
                // Generar link firmado (seguro)
                const { data: urlData } = await supabase.storage
                    .from('materiales')
                    .createSignedUrl(path, 3600); // 1 hora de validez

                if (urlData) {
                    btn.href = urlData.signedUrl;
                    btn.classList.remove('disabled', 'btn-outline-secondary');
                    btn.classList.add('btn-primary');
                    btn.innerHTML = '<i class="fas fa-download"></i> Ver Archivo';
                    return;
                }
            }
            // Si no hay archivo o falla
            btn.href = '#';
            btn.classList.add('disabled', 'btn-outline-secondary');
            btn.classList.remove('btn-primary');
            btn.textContent = 'No subido';
        };

        // Cargar los 5 archivos en paralelo
        await Promise.all([
            setupFileBtn(docenteData.tirilla_cuil_path, 'btn-view-cuil'),
            setupFileBtn(docenteData.fotocopia_dni_path, 'btn-view-dni'),
            setupFileBtn(docenteData.acta_nacimiento_path, 'btn-view-acta'),
            setupFileBtn(docenteData.declaracion_jurada_path, 'btn-view-ddjj'),
            setupFileBtn(docenteData.titulo_habilitante_path, 'btn-view-titulo')
        ]);

    } else {
        divDocente.style.display = 'none';
    }

    // Abrir el modal
    userDetailsModal.show();
}

/**
 * Lee el nuevo rol del modal, lo actualiza en la DB y crea el perfil necesario.
 */
async function handleUpdateRole() {
    const userId = document.getElementById('modal-user-id').value;
    const newRoleId = document.getElementById('modal-user-rol').value;

    // Encontrar el nombre del rol seleccionado basado en el ID
    // (Usamos la variable global allRolesData que ya cargaste)
    const selectedRoleObj = allRolesData.find(r => r.id_rol == newRoleId);
    const roleName = selectedRoleObj ? selectedRoleObj.nombre_rol : '';

    if (!userId || !newRoleId) {
        showMessage('Error, no se pudo identificar al usuario o al rol.', 'Error');
        return;
    }

    const btnGuardar = document.getElementById('modal-guardar-rol-btn'); // Asegúrate de que tu botón tenga este ID en el HTML si quieres efecto de carga
    if(btnGuardar) btnGuardar.disabled = true;

    try {
        // 1. Actualizar la tabla USUARIOS
        const { error: userError } = await supabase
            .from('usuarios')
            .update({ id_rol: newRoleId })
            .eq('id_usuario', userId);
        
        if (userError) throw userError;

        // 2. Crear el perfil correspondiente (Docente o Alumno) si no existe
        if (roleName === 'docente') {
            // Intentamos insertar. Si ya existe, no pasa nada (onConflict ignore)
            const { error: docError } = await supabase
                .from('docentes')
                .upsert({ id_docente: userId, estado: 'pendiente' }, { onConflict: 'id_docente', ignoreDuplicates: true });
            
            if (docError) console.error('Error creando perfil docente:', docError);

        } else if (roleName === 'alumno') {
             // Intentamos insertar perfil de alumno
             const { error: alumError } = await supabase
                .from('alumnos')
                .upsert({ id_alumno: userId, estatus_inscripcion: 'activo' }, { onConflict: 'id_alumno', ignoreDuplicates: true });

            if (alumError) console.error('Error creando perfil alumno:', alumError);
        }

        showMessage('Rol actualizado y perfil generado con éxito.', 'Éxito');
        userDetailsModal.hide(); // Ocultar modal
        
        // Recargar la tabla
        const activeFilterBtn = document.querySelector('#auditoria-tab-pane .btn-success-soft.active');
        const activeFilter = activeFilterBtn ? activeFilterBtn.dataset.rol : 'todos';
        await renderAuditoria(activeFilter);

    } catch (error) {
        console.error('Error al actualizar rol:', error);
        showMessage('Error al actualizar el rol: ' + error.message, 'Error');
    } finally {
        if(btnGuardar) btnGuardar.disabled = false;
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
            id_docente, estado,
            usuario:usuarios ( email, nombre, apellido )
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
            'pendiente': 'bg-warning text-dark',
            'aprobado': 'bg-success text-white',
            'rechazado': 'bg-danger text-white'
        }[docente.estado];

        html += `
            <tr data-id="${docente.id_docente}">
                <td class="text-center">
                    <input class="form-check-input docente-checkbox" type="checkbox" value="${docente.id_docente}">
                </td>
                <td>${fullName}</td>
                <td>${usuario.email}</td>
                <td><span class="badge ${badgeClass}">${docente.estado.toUpperCase()}</span></td>
                <td>
                    <button class="btn btn-info btn-sm btn-ver-detalles me-1" title="Ver Legajo Completo">
                        <i class="fas fa-eye text-white"></i>
                    </button>

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
    // Listener para Botones de Aprobar/Rechazar
    docentesTableBody.querySelectorAll('.btn-accion').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const docenteId = e.currentTarget.closest('tr').dataset.id;
            const nuevaAccion = e.currentTarget.dataset.accion;
            
            if (confirm(`¿Está seguro de que desea cambiar el estado a "${nuevaAccion}"?`)) {
                await updateDocenteEstado([docenteId], nuevaAccion);
                await renderDocentes(currentDocenteFilter);
            }
        });
    });

    // NUEVO: Listener para el botón "Ver Detalles" (Ojito)
    docentesTableBody.querySelectorAll('.btn-ver-detalles').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const docenteId = e.currentTarget.closest('tr').dataset.id;
            verDetallesDocente(docenteId);
        });
    });

    // Listener para Checkboxes
    docentesTableBody.querySelectorAll('.docente-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateBulkActionsUI();
        });
    });
}
/**
 * Abre el modal con toda la info y documentos del docente
 */
async function verDetallesDocente(idDocente) {
    // 1. Buscar datos completos
    const { data, error } = await supabase
        .from('docentes')
        .select(`
            *,
            usuario:usuarios ( nombre, apellido, email, dni )
        `)
        .eq('id_docente', idDocente)
        .single();

    if (error) {
        showMessage('Error al cargar detalles: ' + error.message, 'Error');
        return;
    }

    // 2. Rellenar Textos
    document.getElementById('view-doc-nombre').textContent = `${data.usuario.nombre} ${data.usuario.apellido}`;
    document.getElementById('view-doc-email').textContent = data.usuario.email;
    document.getElementById('view-doc-dni').textContent = data.usuario.dni || 'N/A';
    document.getElementById('view-doc-estado').textContent = data.estado.toUpperCase();
    document.getElementById('view-doc-plaza').textContent = data.plaza || 'No asignada';

    // 3. Configurar botones de descarga (Helper function)
    const setupLink = async (path, elementId) => {
        const btn = document.getElementById(elementId);
        if (path) {
            // Generar URL firmada (segura)
            const { data: urlData } = await supabase.storage
                .from('materiales')
                .createSignedUrl(path, 3600); // Válido por 1 hora

            if (urlData) {
                btn.href = urlData.signedUrl;
                btn.classList.remove('disabled', 'btn-outline-secondary');
                btn.classList.add('btn-primary');
                btn.innerHTML = '<i class="fas fa-download me-1"></i> Ver/Descargar';
            }
        } else {
            btn.href = '#';
            btn.classList.add('disabled', 'btn-outline-secondary');
            btn.classList.remove('btn-primary');
            btn.innerHTML = 'No subido';
        }
    };

    // Configurar los 5 documentos
    await Promise.all([
        setupLink(data.tirilla_cuil_path, 'link-view-cuil'),
        setupLink(data.fotocopia_dni_path, 'link-view-dni'),
        setupLink(data.acta_nacimiento_path, 'link-view-acta'),
        setupLink(data.declaracion_jurada_path, 'link-view-ddjj'),
        setupLink(data.titulo_habilitante_path, 'link-view-titulo')
    ]);

    // 4. Mostrar Modal
    const modal = new bootstrap.Modal(document.getElementById('modalVerDocente'));
    modal.show();
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
/**
 * Renderiza la lista de Tareas con Archivos (Documentación)
 */
async function renderDocumentos() {
    const documentacionList = document.getElementById('documentacion-list');
    const filtroGrado = document.getElementById('filtro-grado');
    const filtroProfesorInput = document.getElementById('filtro-profesor');

    documentacionList.innerHTML = '<div class="text-center text-muted p-4"><span class="spinner-border spinner-border-sm"></span> Cargando documentación...</div>';
    
    const gradoId = filtroGrado.value;
    const textoProfesor = filtroProfesorInput.value.toLowerCase().trim();

    try {
        // 1. Construir consulta a la tabla TAREAS
        // Usamos !inner en materia para poder filtrar por grado si es necesario
        let query = supabase
            .from('tareas')
            .select(`
                id_tarea,
                titulo,
                archivo_path,
                fecha_creacion,
                docente:docentes (
                    usuario:usuarios (nombre, apellido)
                ),
                materia:materias!inner (
                    nombre_materia,
                    grado:grado (id_grado, nombre_grado)
                )
            `)
            .not('archivo_path', 'is', null) // Solo tareas con archivo
            .order('fecha_creacion', { ascending: false });

        // 2. Filtros Server-Side (Base de datos)
        if (gradoId) {
            // Filtramos las tareas cuya materia pertenezca al grado seleccionado
            query = query.eq('materia.id_grado', gradoId);
        }

        const { data: tareas, error } = await query;

        if (error) throw error;

        // 3. Filtros Client-Side (JavaScript) - Para el nombre del profesor
        const documentosFiltrados = tareas.filter(tarea => {
            if (!textoProfesor) return true;
            const nombre = tarea.docente?.usuario?.nombre?.toLowerCase() || '';
            const apellido = tarea.docente?.usuario?.apellido?.toLowerCase() || '';
            return nombre.includes(textoProfesor) || apellido.includes(textoProfesor);
        });

        if (documentosFiltrados.length === 0) {
            documentacionList.innerHTML = '<div class="text-center text-muted p-4">No se encontraron archivos con esos filtros.</div>';
            return;
        }

        // 4. Generar HTML
        let html = '';
        
        for (const doc of documentosFiltrados) {
            const profesor = doc.docente?.usuario ? `${doc.docente.usuario.nombre} ${doc.docente.usuario.apellido}` : 'Desconocido';
            const materiaNombre = doc.materia?.nombre_materia || 'Sin materia';
            const gradoNombre = doc.materia?.grado?.nombre_grado || 'Sin grado';
            const fecha = new Date(doc.fecha_creacion).toLocaleDateString();
            const nombreArchivo = doc.archivo_path.split('/').pop(); // Obtener nombre real del archivo

            // Generar enlace de descarga seguro
            let botonDescarga = '<button class="btn btn-sm btn-outline-secondary disabled">Error</button>';
            
            if (doc.archivo_path) {
                const { data: urlData } = await supabase.storage
                    .from('materiales')
                    .createSignedUrl(doc.archivo_path, 3600);

                if (urlData?.signedUrl) {
                    botonDescarga = `
                        <a href="${urlData.signedUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-download me-1"></i> Descargar
                        </a>
                    `;
                }
            }

            html += `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3">
                    <div class="d-flex align-items-center">
                        <div class="icon me-3 fs-4 text-primary">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <div>
                            <h6 class="mb-0 fw-bold">${doc.titulo}</h6>
                            <div class="small text-muted mb-1">Arch: ${nombreArchivo}</div>
                            <div class="small text-muted">
                                <span class="badge bg-light text-dark border me-1"><i class="fas fa-chalkboard-teacher"></i> ${profesor}</span>
                                <span class="badge bg-light text-dark border me-1"><i class="fas fa-layer-group"></i> ${gradoNombre}</span>
                                <span class="badge bg-light text-dark border"><i class="fas fa-book"></i> ${materiaNombre}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="small text-muted mb-1">${fecha}</div>
                        ${botonDescarga}
                    </div>
                </div>
            `;
        }

        documentacionList.innerHTML = html;

    } catch (error) {
        console.error('Error rendering documentos:', error);
        documentacionList.innerHTML = `<div class="text-center text-danger p-4">Error al cargar documentos: ${error.message}</div>`;
    }
}

/**
 * Llena el <select> de filtro de grados.
 */
async function populateGradoFilter() {
    const filtroGrado = document.getElementById('filtro-grado');
    if (!filtroGrado) return;

    try {
        const { data, error } = await supabase.from('grado').select('id_grado, nombre_grado').order('id_grado');
        if (error) throw error;

        filtroGrado.innerHTML = '<option value="">Filtrar por Grado...</option>';
        data.forEach(grado => {
            filtroGrado.innerHTML += `<option value="${grado.id_grado}">${grado.nombre_grado}</option>`;
        });
    } catch (error) {
        console.error("Error cargando grados:", error);
    }
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