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
    const btnGuardarRol = document.getElementById('modal-guardar-rol-btn');
    if (btnGuardarRol) {
        // Elimina cualquier listener anterior por si acaso (opcional pero seguro)
        btnGuardarRol.removeEventListener('click', handleUpdateRole); 
        // Agrega el listener nuevo
        btnGuardarRol.addEventListener('click', handleUpdateRole);
    }

   auditoriaTableBody.addEventListener('click', (e) => {
        // Botón Ver/Editar
        const editButton = e.target.closest('.edit-user-btn');
        if (editButton) {
            const userId = editButton.dataset.id;
            const user = allUsersData.find(u => u.id_usuario === userId);
            if (user) openUserDetailsModal(user);
        }

        // Botón Desactivar (Amarillo)
        const softDeleteButton = e.target.closest('.soft-delete-user-btn');
        if (softDeleteButton) {
            const userId = softDeleteButton.dataset.id;
            const userName = softDeleteButton.dataset.name;
            handleSoftDeleteUser(userId, userName, false); // false = desactivar
        }

        // Botón Reactivar (Verde - Opcional por si quieres volver a activar)
        const reactivateButton = e.target.closest('.reactivate-user-btn');
        if (reactivateButton) {
            const userId = reactivateButton.dataset.id;
            const userName = reactivateButton.dataset.name;
            handleSoftDeleteUser(userId, userName, true); // true = activar
        }

        // Botón Eliminar Físico (Rojo)
        const hardDeleteButton = e.target.closest('.hard-delete-user-btn');
        if (hardDeleteButton) {
            const userId = hardDeleteButton.dataset.id;
            const userName = hardDeleteButton.dataset.name;
            handleHardDeleteUser(userId, userName);
        }
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
        .order('fecha_creacion', { ascending: false });
        // QUITE EL .eq('is_active', true) PARA QUE PUEDAS VER A LOS DESACTIVADOS TAMBIÉN

    if (filtroRol !== 'todos') {
        query = query.eq('rol.nombre_rol', filtroRol);
    } else {
        query = query.in('rol.nombre_rol', ['alumno', 'docente']);
    }

    const { data: usuarios, error } = await query;

    if (error) {
        console.error('Error fetching usuarios:', error);
        auditoriaTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar usuarios: ${error.message}</td></tr>`;
        return;
    }

    if (!usuarios || usuarios.length === 0) {
        auditoriaTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron usuarios.</td></tr>`;
        return;
    }

    allUsersData = usuarios;
    let html = '';

    usuarios.forEach(user => {
        const userRoleName = user.rol.nombre_rol;
        
        // Estilos visuales
        let badgeClass = 'bg-secondary';
        if (userRoleName === 'docente') badgeClass = 'bg-primary text-white';
        if (userRoleName === 'alumno') badgeClass = 'bg-success text-white';
        
        // Si está desactivado, ponemos la fila gris
        const rowClass = !user.is_active ? 'table-secondary text-muted' : '';
        const estadoTexto = !user.is_active ? '<span class="badge bg-danger ms-2">INACTIVO</span>' : '';

        html += `
            <tr class="${rowClass}">
                <td>
                    <div class="fw-bold">${user.nombre} ${user.apellido} ${estadoTexto}</div>
                </td>
                <td>${user.email}</td>
                <td>${user.dni || '-'}</td>
                <td><span class="badge ${badgeClass}">${userRoleName.toUpperCase()}</span></td>
                <td>${new Date(user.fecha_creacion).toLocaleDateString()}</td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-outline-primary btn-sm edit-user-btn" 
                                data-id="${user.id_usuario}" title="Ver Detalles / Cambiar Rol">
                            <i class="fas fa-eye"></i>
                        </button>
                        
                        ${userRoleName !== 'admin' ? `
                            ${user.is_active ? `
                                <button class="btn btn-outline-warning btn-sm soft-delete-user-btn" 
                                        data-id="${user.id_usuario}" 
                                        data-name="${user.nombre} ${user.apellido}" title="Desactivar acceso">
                                    <i class="fas fa-ban"></i>
                                </button>
                            ` : `
                                <button class="btn btn-outline-success btn-sm reactivate-user-btn" 
                                        data-id="${user.id_usuario}" 
                                        data-name="${user.nombre} ${user.apellido}" title="Reactivar acceso">
                                    <i class="fas fa-check"></i>
                                </button>
                            `}

                            <button class="btn btn-outline-danger btn-sm hard-delete-user-btn" 
                                     data-id="${user.id_usuario}" 
                                     data-name="${user.nombre} ${user.apellido}" title="ELIMINAR DEFINITIVAMENTE">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    auditoriaTableBody.innerHTML = html;
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
/**
 * Abre y rellena el modal de Detalles de Usuario con la lógica de Alumno/Docente.
 */
async function openUserDetailsModal(user) {
    console.log("Abriendo detalles del usuario:", user);

    // 1. Llenar Datos Básicos (Siempre visibles)
    document.getElementById('modal-user-id').value = user.id_usuario;
    document.getElementById('modal-user-nombre').value = `${user.nombre} ${user.apellido}`;
    document.getElementById('modal-user-email').value = user.email;
    document.getElementById('modal-user-dni').value = user.dni || 'Sin DNI';

    // 2. Rellenar dropdown de rol
    const currentRoleId = user.rol ? user.rol.id_rol : null;
    const currentRoleName = user.rol ? user.rol.nombre_rol : ''; 
    populateRoleDropdown(currentRoleId); // Tu función auxiliar existente

    // 3. Referencias a las secciones ocultas
    const divAlumno = document.getElementById('modal-alumno-info');
    const divDocente = document.getElementById('modal-docente-info');

    // Ocultar ambas por defecto para empezar limpio
    divAlumno.style.display = 'none';
    divDocente.style.display = 'none';

    // =========================================================
    // LÓGICA PARA ALUMNOS
    // =========================================================
    if (currentRoleName === 'alumno') {
        divAlumno.style.display = 'block'; // Mostrar sección alumno
        
        // Supabase suele devolver 'alumnos' como un array si es una relación 1:N
        // Intentamos obtener el primer elemento
        const alumnoData = Array.isArray(user.alumnos) ? user.alumnos[0] : user.alumnos;

        if (alumnoData) {
            // Datos Escolares
            const nombreGrado = alumnoData.grado ? alumnoData.grado.nombre_grado : 'Sin Grado';
            document.getElementById('modal-alumno-grado').value = nombreGrado;
            document.getElementById('modal-alumno-fecha').value = alumnoData.fecha_nacimiento || '';
            document.getElementById('modal-alumno-telefono').value = alumnoData.telefono || '';
            document.getElementById('modal-alumno-direccion').value = alumnoData.direccion || '';

            // Datos del Tutor
            document.getElementById('modal-tutor-nombre').value = alumnoData.tutor_nombre || '';
            document.getElementById('modal-tutor-trabajo').value = alumnoData.tutor_trabajo || '';
            document.getElementById('modal-tutor-educacion').value = alumnoData.tutor_educacion || '';
        } else {
            // Si tiene el rol pero no el perfil creado aún
            console.warn("El usuario es alumno pero no tiene perfil en tabla 'alumnos'");
            document.getElementById('modal-alumno-grado').value = "Perfil incompleto";
        }
    }

    // =========================================================
    // LÓGICA PARA DOCENTES
    // =========================================================
    else if (currentRoleName === 'docente') {
        divDocente.style.display = 'block'; // Mostrar sección docente
        
        const docenteData = Array.isArray(user.docentes) ? user.docentes[0] : user.docentes;

        if (docenteData) {
            // Textos
            const estado = docenteData.estado?.toUpperCase() || 'PENDIENTE';
            document.getElementById('modal-doc-estado').value = estado;
            document.getElementById('modal-doc-plaza').value = docenteData.plaza || 'Sin asignar';

            // Colores del estado
            const inputEstado = document.getElementById('modal-doc-estado');
            if (estado === 'APROBADO') inputEstado.style.color = '#198754'; // Verde
            else if (estado === 'RECHAZADO') inputEstado.style.color = '#dc3545'; // Rojo
            else inputEstado.style.color = '#ffc107'; // Amarillo

            // Helper para los botones de archivos
            const setupFileBtn = async (path, btnId) => {
                const btn = document.getElementById(btnId);
                // Resetear estilos
                btn.className = 'badge text-decoration-none text-white'; 
                
                if (path) {
                    // Generar URL firmada
                    const { data: urlData } = await supabase.storage
                        .from('materiales') // O el bucket que uses para legajos
                        .createSignedUrl(path, 3600);

                    if (urlData) {
                        btn.href = urlData.signedUrl;
                        btn.classList.add('bg-primary');
                        btn.textContent = 'Ver Archivo';
                        btn.target = "_blank";
                        return;
                    }
                }
                // Si no hay archivo
                btn.href = '#';
                btn.classList.add('bg-secondary');
                btn.textContent = 'Falta';
                btn.removeAttribute('target');
            };

            // Cargar los 5 archivos
            await Promise.all([
                setupFileBtn(docenteData.tirilla_cuil_path, 'btn-view-cuil'),
                setupFileBtn(docenteData.fotocopia_dni_path, 'btn-view-dni'),
                setupFileBtn(docenteData.acta_nacimiento_path, 'btn-view-acta'),
                setupFileBtn(docenteData.declaracion_jurada_path, 'btn-view-ddjj'),
                setupFileBtn(docenteData.titulo_habilitante_path, 'btn-view-titulo')
            ]);
        }
    }

    // 4. Mostrar el Modal
    // Asegúrate de que 'userDetailsModal' esté definido globalmente al inicio de tu archivo
    // const userDetailsModal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
    userDetailsModal.show();
}


async function handleUpdateRole() {
    console.clear(); // Limpiamos consola para ver limpio
    console.log("🚀 INICIANDO CAMBIO DE ROL...");

    const userId = document.getElementById('modal-user-id').value;
    const newRoleId = document.getElementById('modal-user-rol').value;

    if (!userId || !newRoleId) return;

    const btnGuardar = document.getElementById('modal-guardar-rol-btn');
    // Aseguramos que no sea submit por si se te olvidó cambiar el HTML
    if (event) event.preventDefault(); 

    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';
    }

    try {
        // 1. Obtener Rol Anterior
        const { data: userData } = await supabase
            .from('usuarios')
            .select('rol(nombre_rol)')
            .eq('id_usuario', userId)
            .single();
        
        const oldRoleName = userData?.rol?.nombre_rol;
        
        const selectedRoleObj = allRolesData.find(r => r.id_rol == newRoleId);
        const newRoleName = selectedRoleObj ? selectedRoleObj.nombre_rol : '';

        console.log(`🔄 Cambio: ${oldRoleName} -> ${newRoleName}`);

        // 2. Actualizar Rol en USUARIOS
        const { error: userError } = await supabase
            .from('usuarios')
            .update({ id_rol: newRoleId })
            .eq('id_usuario', userId);
        
        if (userError) throw userError;
        console.log("✅ Tabla 'usuarios' actualizada.");

        // 3. INTENTO DE LIMPIEZA (Con manejo de FK)
        
        // CASO: Era Docente -> Ahora No
        if (oldRoleName === 'docente' && newRoleName !== 'docente') {
            console.log("🧹 Intentando borrar perfil de Docente...");
            const { error } = await supabase.from('docentes').delete().eq('id_docente', userId);
            
            if (error) {
                // Código 23503 es violación de llave foránea (tiene materias/tareas)
                if (error.code === '23503') {
                    console.warn("⚠️ NO SE PUDO BORRAR EL PERFIL DOCENTE: El usuario tiene materias o tareas asignadas.");
                    alert("Aviso: Se cambió el rol, pero no se eliminó el legajo docente porque tiene materias o historial asociado.");
                } else {
                    console.error("❌ Error borrando docente:", error);
                }
            } else {
                console.log("🗑️ Perfil docente eliminado limpiamente.");
            }
        }

        // CASO: Era Alumno -> Ahora No
        if (oldRoleName === 'alumno' && newRoleName !== 'alumno') {
            console.log("🧹 Intentando borrar perfil de Alumno...");
            const { error } = await supabase.from('alumnos').delete().eq('id_alumno', userId);
            
            if (error) {
                if (error.code === '23503') {
                    console.warn("⚠️ NO SE PUDO BORRAR EL PERFIL ALUMNO: Tiene inscripciones o notas.");
                    alert("Aviso: Se cambió el rol, pero queda el historial académico del alumno.");
                } else {
                    console.error("❌ Error borrando alumno:", error);
                }
            } else {
                console.log("🗑️ Perfil alumno eliminado limpiamente.");
            }
        }

        // 4. Crear Nuevo Perfil
        if (newRoleName === 'docente') {
            await supabase.from('docentes')
                .upsert({ id_docente: userId, estado: 'pendiente' }, { onConflict: 'id_docente', ignoreDuplicates: true });
            console.log("✨ Perfil docente creado/verificado.");
        }
        if (newRoleName === 'alumno') {
            await supabase.from('alumnos')
                .upsert({ id_alumno: userId, estatus_inscripcion: 'activo' }, { onConflict: 'id_alumno', ignoreDuplicates: true });
            console.log("✨ Perfil alumno creado/verificado.");
        }

       showMessage('Rol actualizado correctamente.', 'Éxito');
        userDetailsModal.hide(); 

        // ============================================================
        // 5. RECARGAS VISUALES (CON PEQUEÑA PAUSA)
        // ============================================================
        console.log("⏳ Esperando confirmación de BD para recargar tablas...");
        
        // Limpiamos visualmente antes para que se note que está cargando
        const auditoriaTableBody = document.getElementById('auditoria-table-body');
        if(auditoriaTableBody) auditoriaTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div> Actualizando vista...</td></tr>';

        // Usamos setTimeout para dar 500ms (medio segundo) a la BD antes de leer
        setTimeout(async () => {
            console.log("🔄 Recargando tablas ahora...");
            
            // Recargar Auditoría
            const activeBtn = document.querySelector('#auditoria-tab-pane .btn-success-soft.active');
            const activeFilter = activeBtn ? activeBtn.dataset.rol : 'todos';
            await renderAuditoria(activeFilter);

            // Recargar Docentes (si aplica)
            if (newRoleName === 'docente' || oldRoleName === 'docente') {
                await renderDocentes(currentDocenteFilter);
            }
        }, 500); // <--- ESTOS 500ms SON LA CLAVE

    } catch (error) {
        console.error(error);
        showMessage('Error crítico: ' + error.message, 'Error');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save me-2"></i> Guardar Rol';
        }
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

/**
 * Cambia el estado activo/inactivo (Borrado Lógico - X Amarilla)
 */
async function handleSoftDeleteUser(userId, userName, isActive) {
    const accion = isActive ? "reactivar" : "desactivar";
    if (!confirm(`¿Seguro que quieres ${accion} al usuario "${userName}"?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('usuarios')
            .update({ is_active: isActive })
            .eq('id_usuario', userId);

        if (error) throw error;

        showMessage(`Usuario ${isActive ? 'reactivado' : 'desactivado'} con éxito.`, 'Éxito');
        
        // Recargar tabla manteniendo el filtro actual
        const activeBtn = document.querySelector('#auditoria-tab-pane .btn-success-soft.active');
        const activeFilter = activeBtn ? activeBtn.dataset.rol : 'todos';
        await renderAuditoria(activeFilter);

    } catch (error) {
        console.error(error);
        showMessage('Error: ' + error.message, 'Error');
    }
}

/**
 * Elimina el registro de la base de datos (Borrado Físico - Basura Roja)
 */
async function handleHardDeleteUser(userId, userName) {
    if (!confirm(`⚠️ ¡PELIGRO! ⚠️\n\n¿Estás seguro de ELIMINAR DEFINITIVAMENTE a "${userName}"?\n\nSe borrarán sus notas, asistencias y documentos. Esta acción NO se puede deshacer.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id_usuario', userId);

        if (error) throw error;

        showMessage('Usuario eliminado permanentemente.', 'Éxito');
        
        const activeBtn = document.querySelector('#auditoria-tab-pane .btn-success-soft.active');
        const activeFilter = activeBtn ? activeBtn.dataset.rol : 'todos';
        await renderAuditoria(activeFilter);

    } catch (error) {
        console.error(error);
        showMessage('Error al eliminar: ' + error.message, 'Error');
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