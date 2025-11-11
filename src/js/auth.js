/* ----------------------------------
   Lógica de Autenticación (auth.js)
   Versión para Vite y 'schema_completo.sql'
---------------------------------- */
'use strict';

// Importamos el cliente de Supabase y la función de mensajes
// (Asume que supabaseClient.js está en la misma carpeta 'src/js/')
import { supabase, showMessage } from './supabaseClient.js';

// Variable global para guardar el rol seleccionado
let selectedRoleForRegistration = 'alumno'; // Default

/**
 * Función helper para el botón de "Mostrar/Ocultar Contraseña"
 * @param {string} inputId - El ID del input de contraseña
 * @param {string} buttonId - El ID del botón
 */
function setupPasswordToggle(inputId, buttonId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(buttonId);

    if (passwordInput && toggleButton) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Cambiar ícono
            toggleButton.querySelector('i').classList.toggle('fa-eye');
            toggleButton.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
}

/**
 * Función principal que se ejecuta al cargar el DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CAPTURAR EL ROL SELECCIONADO ---
    const loginModalTitle = document.getElementById('authModalLabel');
    const roleSelectButtons = document.querySelectorAll('.role-select-btn');

    roleSelectButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // No prevenimos el default, ya que data-bs-toggle lo necesita
            let role = e.currentTarget.getAttribute('data-role').toLowerCase();

            // Manejar 'Padres' (plural) a 'padre' (singular)
            if (role === 'padres') {
                role = 'padre';
            }

            selectedRoleForRegistration = role;

            if (loginModalTitle) {
                // Pone el título del modal (ej: "Acceso - Panel de Alumno")
                const capitalRole = role.charAt(0).toUpperCase() + role.slice(1);
                loginModalTitle.textContent = 'Acceso - Panel de ' + capitalRole;
            }

            // Limpiar formularios
            document.getElementById('registerForm')?.reset();
            document.getElementById('loginForm')?.reset();
        });
    });

    // --- 2. CONFIGURAR BOTONES DE VER CONTRASEÑA ---
    setupPasswordToggle('loginPassword', 'toggleLoginPassword');
    setupPasswordToggle('registerPassword', 'toggleRegisterPassword');
    setupPasswordToggle('adminPassword', 'toggleAdminPassword');

    // --- 3. MANEJAR FORMULARIO DE LOGIN (#loginForm) ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            iniciarSesion(email, password);
        });
    }

    // --- 4. MANEJAR FORMULARIO DE ADMIN (#adminForm) ---
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            iniciarSesion(email, password); // Usa la misma función de login
        });
    }

    // --- 5. MANEJAR FORMULARIO DE REGISTRO (#registerForm) ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombre = document.getElementById('registerNombre').value;
            const apellido = document.getElementById('registerApellido').value;
            const dni = document.getElementById('registerDNI').value; // <-- AÑADIR ESTA LÍNEA
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            if (!nombre || !apellido || !dni || !email || !password) { // <-- AÑADIR !dni
                showMessage('Por favor, complete todos los campos.', 'Error');
                return;
            }

            // Llamar a la función de registro
            const result = await registrarUsuario(nombre, apellido, dni, email, password, selectedRoleForRegistration);

            if (result.success) {

                // 1. Muestra el mensaje de éxito (esto ya lo hace)
                if (result.requiresConfirmation) {
                    showMessage('Registro exitoso. Revisa tu correo...', 'Éxito');
                } else {
                    showMessage('¡Registro exitoso! Ya puedes iniciar sesión.', 'Éxito');
                }

                // 2. Resetea el formulario de registro
                registerForm.reset();

                // 3. Cambia automáticamente a la pestaña de Iniciar Sesión
                const loginTabButton = document.getElementById('login-tab');
                if (loginTabButton) {
                    new bootstrap.Tab(loginTabButton).show();
                }
            }
        });
    }
});


// --- FUNCIONES DE AUTENTICACIÓN ---

/**
 * Inicia sesión de un usuario existente.
 */
async function iniciarSesion(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Error de inicio de sesión:', error);
        showMessage('Error al iniciar sesión: Email o contraseña incorrectos.', 'Error');
        return;
    }

    if (data.user) {
        // Usuario autenticado, ahora redirigir según su rol
        await handleRedirection(data.user);
    }
}


/**
 * Registra un nuevo usuario en Auth y crea su perfil en las tablas públicas.
 */
async function registrarUsuario(nombre, apellido, dni, email, password, roleName) {
    try {
        // 1. Registrar el usuario en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (authError) throw authError;

        // Si signUp devuelve un usuario pero no una sesión (requiere confirmación)
        if (authData.user && !authData.session) {
            // Nota: El trigger 'handle_new_user' que BORRAMOS ya no existe,
            // así que debemos crear el perfil de 'usuarios' manualmente aquí.
            const profileStatus = await createFullUserProfile(
                authData.user.id,
                nombre,
                apellido,
                dni,
                email,
                roleName
            );

            if (!profileStatus.success) {
                // Si falla la creación del perfil, mostramos un error.
                // (En un sistema real, aquí deberíamos borrar el usuario de auth)
                throw profileStatus.error;
            }

            return { success: true, requiresConfirmation: true };
        }

        // Si el usuario ya está creado y confirmado (ej. en localhost)
        if (authData.user) {
            // 2. Crear el perfil completo
            const profileStatus = await createFullUserProfile(
                authData.user.id,
                nombre,
                apellido,
                dni,
                email,
                roleName
            );

            if (profileStatus.success) {
                return { success: true, status: profileStatus.estado };
            } else {
                throw profileStatus.error; // Lanzar el error de creación de perfil
            }
        }

        return { success: false, error: new Error("Respuesta de autenticación desconocida.") };

    } catch (error) {
        console.error('Error en el proceso de registro:', error);
        showMessage(`Error al registrar: ${error.message}`, 'Error');
        return { success: false, error: error };
    }
}

/**
 * Crea la entrada completa del perfil en 'usuarios' y 'alumnos'/'docentes'
 */
async function createFullUserProfile(userId, nombre, apellido, dni, email, roleName) {
    try {
        // 1. Obtener el ID del rol desde la tabla 'rol'
        const { data: rolData, error: rolError } = await supabase
            .from('rol')
            .select('id_rol')
            .eq('nombre_rol', roleName) // 'alumno', 'padre', 'docente'
            .single();

        if (rolError) throw new Error(`Error buscando rol: ${rolError.message}`);
        if (!rolData) throw new Error(`Rol "${roleName}" no encontrado.`);

        const rolId = rolData.id_rol;

        // 2. Insertar en la tabla 'usuarios'
        // (fecha_creacion es DEFAULT now())
        const { error: userError } = await supabase
            .from('usuarios')
            .insert({
                id_usuario: userId,
                nombre: nombre,
                apellido: apellido,
                dni: dni,
                email: email,
                id_rol: rolId
            });

        if (userError) throw new Error(`Error creando usuario: ${userError.message}`);

        // 3. Insertar en la tabla específica del rol
        let estadoFinal = 'aprobado'; // Estado por defecto

        if (roleName === 'alumno') {
            const { error: alumnoError } = await supabase
                .from('alumnos')
                .insert({
                    id_alumno: userId,
                    estatus_inscripcion: 'activo'
                });
            if (alumnoError) throw new Error(`Error creando alumno: ${alumnoError.message}`);

        } else if (roleName === 'docente') {
            estadoFinal = 'pendiente'; // Los docentes SÍ requieren aprobación
            const { error: docenteError } = await supabase
                .from('docentes')
                .insert({
                    id_docente: userId,
                    estado: 'pendiente' // Estado por defecto
                });
            if (docenteError) throw new Error(`Error creando docente: ${docenteError.message}`);

        } else if (roleName === 'padre') {
            // No se requiere acción extra
        }

        return { success: true, estado: estadoFinal };

    } catch (error) {
        console.error('Error al crear el perfil completo:', error);
        return { success: false, error: error };
    }
}


/**
 * Decide a qué panel redirigir al usuario después de iniciar sesión.
 */
async function handleRedirection(user) {
    try {
        // 1. Consultar el rol del usuario y el estado (si es docente)
        const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select(`
                rol (nombre_rol),
                docentes (estado) 
            `) // Trae el rol Y la info de docente (si existe)
            .eq('id_usuario', user.id)
            .single();

        if (userError) throw userError;
        if (!userData || !userData.rol) throw new Error("Perfil de usuario o rol no encontrado.");

        const userRole = userData.rol.nombre_rol;

        // 2. Caso especial: Docente pendiente o rechazado
        if (userRole === 'docente') {
            // 'docentes' es un array (relación 1:1), tomamos el primero [0]
            const docenteInfo = userData.docentes[0];

            if (!docenteInfo) {
                // Esto no debería pasar si el registro fue correcto, pero es un control
                throw new Error("Datos de docente no encontrados.");
            }

            if (docenteInfo.estado === 'pendiente') {
                showMessage('Tu cuenta de docente está pendiente de aprobación por un administrador.', 'Cuenta Pendiente');
                await supabase.auth.signOut(); // Desloguear

                // Ocultar modales manualmente
                try {
                    const authModalEl = document.getElementById('authModal');
                    const authModal = bootstrap.Modal.getInstance(authModalEl);
                    if (authModal) authModal.hide();
                } catch (e) { }
                try {
                    const roleModalEl = document.getElementById('roleChooserModal');
                    const roleModal = bootstrap.Modal.getInstance(roleModalEl);
                    if (roleModal) roleModal.hide();
                } catch (e) { }

                return;
            }
            if (docenteInfo.estado === 'rechazado') {
                showMessage('Tu solicitud de cuenta de docente ha sido rechazada. Contacta a administración.', 'Cuenta Rechazada');
                await supabase.auth.signOut(); // Desloguear
                return;
            }
        }

        // 3. Redirecciones exitosas
        // Asumiendo que index.html está en la raíz
        const baseUrl = window.location.origin;
        switch (userRole) {
            case 'alumno':
                window.location.href = `${baseUrl}/public/pages/panel-alumno.html`;
                break;
            case 'padre':
                window.location.href = `${baseUrl}/public/pages/panel-padres.html`;
                break;
            case 'docente':
                // Ya sabemos que está 'aprobado' si llegó aquí
                window.location.href = `${baseUrl}/public/pages/docentes.html`;
                break;
            case 'admin':
                window.location.href = `${baseUrl}/public/pages/panel-admin.html`;
                break;
            default:
                showMessage('Rol de usuario desconocido.', 'Error');
                await supabase.auth.signOut();
        }

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        showMessage(`Error al cargar tu perfil: ${error.message}. Contacta a soporte.`, 'Error');
        await supabase.auth.signOut(); // Desloguear si hay error de perfil
    }
}