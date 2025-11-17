/* ----------------------------------
   Lógica de Autenticación (auth.js)
   Versión para Vite y 'schema_completo.sql'
---------------------------------- */
'use strict';

import { supabase, showMessage } from './supabaseClient.js';

// <-- CAMBIO 1: Renombramos la variable para que sea más clara
let currentSelectedRole = 'alumno'; // Default

/**
 * Función helper para el botón de "Mostrar/Ocultar Contraseña"
 */
function setupPasswordToggle(inputId, buttonId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(buttonId);

    if (passwordInput && toggleButton) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleButton.querySelector('i').classList.toggle('fa-eye');
            toggleButton.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
}


/**
 * Función principal que se ejecuta al cargar el DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

    const loginModalTitle = document.getElementById('authModalLabel');
    const roleSelectButtons = document.querySelectorAll('.role-select-btn');

    roleSelectButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const roleAttribute = e.currentTarget.getAttribute('data-role');

            if (roleAttribute) {
                let role = roleAttribute.toLowerCase();

                // <-- CAMBIO 2: Actualizamos la variable global
                currentSelectedRole = role; // <-- ESTA ES LA PARTE IMPORTANTE

                if (loginModalTitle) {
                    const capitalRole = role.charAt(0).toUpperCase() + role.slice(1);
                    loginModalTitle.textContent = 'Acceso - Panel de ' + capitalRole;
                }
            }
            
            document.getElementById('registerForm')?.reset();
            document.getElementById('loginForm')?.reset();
        });
    });

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
            // <-- CAMBIO 3: Le decimos a la función qué rol QUEREMOS
            iniciarSesion(email, password, currentSelectedRole);
        });
    }

    // --- 4. MANEJAR FORMULARIO DE ADMIN (#adminForm) ---
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            // <-- CAMBIO 3: Le decimos a la función que QUEREMOS ser 'admin'
            iniciarSesion(email, password, 'admin');
        });
    }

    // --- 5. MANEJAR FORMULARIO DE REGISTRO (#registerForm) ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('registerNombre').value;
            const apellido = document.getElementById('registerApellido').value;
            const dni = document.getElementById('registerDNI').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            if (!nombre || !apellido || !dni || !email || !password) {
                showMessage('Por favor, complete todos los campos.', 'Error');
                return;
            }
            // Usamos la variable global con el nombre corregido
            const result = await registrarUsuario(nombre, apellido, dni, email, password, currentSelectedRole); 

            if (result.success) {
                if (result.requiresConfirmation) {
                    showMessage('Registro exitoso. Revisa tu correo...', 'Éxito');
                } else {
                    showMessage('¡Registro exitoso! Ya puedes iniciar sesión.', 'Éxito');
                }
                registerForm.reset();
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
 * @param {string} email - El email del usuario
 * @param {string} password - La contraseña del usuario
 * @param {string} intendedRole - El rol que el usuario INTENTA asumir ('alumno', 'docente', 'admin')
 */
async function iniciarSesion(email, password, intendedRole) { // <-- CAMBIO 4: Añadimos intendedRole
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
        // Usuario autenticado, ahora verificamos y redirigimos
        await handleRedirection(data.user, intendedRole); // <-- CAMBIO 4: Pasamos el rol
    }
}


/**
 * Registra un nuevo usuario en Auth y crea su perfil en las tablas públicas.
 */
async function registrarUsuario(nombre, apellido, dni, email, password, roleName) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (authError) throw authError;

        if (authData.user && !authData.session) {
            const profileStatus = await createFullUserProfile(
                authData.user.id, nombre, apellido, dni, email, roleName
            );
            if (!profileStatus.success) {
                throw profileStatus.error;
            }
            return { success: true, requiresConfirmation: true };
        }

        if (authData.user) {
            const profileStatus = await createFullUserProfile(
                authData.user.id, nombre, apellido, dni, email, roleName
            );
            if (profileStatus.success) {
                return { success: true, status: profileStatus.estado };
            } else {
                throw profileStatus.error;
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
        const { data: rolData, error: rolError } = await supabase
            .from('rol')
            .select('id_rol')
            .eq('nombre_rol', roleName)
            .single();

        if (rolError) throw new Error(`Error buscando rol: ${rolError.message}`);
        if (!rolData) throw new Error(`Rol "${roleName}" no encontrado.`);

        const rolId = rolData.id_rol;

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

        let estadoFinal = 'aprobado'; 

        if (roleName === 'alumno') {
            const { error: alumnoError } = await supabase
                .from('alumnos')
                .insert({ id_alumno: userId, estatus_inscripcion: 'activo' });
            if (alumnoError) throw new Error(`Error creando alumno: ${alumnoError.message}`);

        } else if (roleName === 'docente') {
            estadoFinal = 'pendiente'; 
            const { error: docenteError } = await supabase
                .from('docentes')
                .insert({ id_docente: userId, estado: 'pendiente' });
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
 * @param {object} user - El objeto de usuario de Supabase Auth
 * @param {string} intendedRole - El rol que el usuario INTENTÓ asumir
 */
async function handleRedirection(user, intendedRole) { // <-- CAMBIO 4: Recibimos intendedRole
    try {
        const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select(`
                rol (nombre_rol),
                docentes (estado) 
            `)
            .eq('id_usuario', user.id)
            .single();

        if (userError) throw userError;
        if (!userData || !userData.rol) throw new Error("Perfil de usuario o rol no encontrado.");

        const userRole = userData.rol.nombre_rol; // Rol REAL del usuario

        // --- INICIO DE LA VALIDACIÓN DE ROL ---
        // Compara el rol que el usuario INTENTÓ usar (intendedRole) con su rol REAL (userRole).
        if (intendedRole !== userRole) {
            const capitalRole = userRole.charAt(0).toUpperCase() + userRole.slice(1);
            
            // Ocultar modales ANTES de mostrar el mensaje
            try {
                const authModalEl = document.getElementById('authModal');
                const authModal = bootstrap.Modal.getInstance(authModalEl);
                if (authModal) authModal.hide();
            } catch (e) {}
            try {
                const adminModalEl = document.getElementById('adminModal');
                const adminModal = bootstrap.Modal.getInstance(adminModalEl);
                if (adminModal) adminModal.hide();
            } catch (e) {}

            // Muestra el error que pediste
            showMessage(
                `Usted es ${capitalRole}. No puede entrar a este panel.`, 
                'Acceso Denegado'
            );
            await supabase.auth.signOut(); // Desloguear
            return; // Detener la redirección
        }
        // --- FIN DE LA VALIDACIÓN DE ROL ---

        // 2. Caso especial: Docente pendiente o rechazado
        if (userRole === 'docente') {
            const docenteInfo = userData.docentes; 
            if (!docenteInfo) {
                throw new Error("Datos de docente no encontrados.");
            }

            if (docenteInfo.estado === 'pendiente') {
                showMessage('Tu cuenta de docente está pendiente de aprobación por un administrador.', 'Cuenta Pendiente');
                await supabase.auth.signOut(); 
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
                await supabase.auth.signOut(); 
                return;
            }
        }

        // 3. Redirecciones exitosas
        const baseUrl = window.location.origin;
        switch (userRole) {
            case 'alumno':
                window.location.href = `${baseUrl}/pages/panel-alumno.html`;
                break;
            case 'docente':
                window.location.href = `${baseUrl}/pages/panel-docente.html`;
                break;
            case 'admin':
                window.location.href = `${baseUrl}/pages/panel-admin.html`;
                break;
            default:
                showMessage('Rol de usuario desconocido.', 'Error');
                await supabase.auth.signOut();
        }

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        showMessage(`Error al cargar tu perfil: ${error.message}. Contacta a soporte.`, 'Error');
        await supabase.auth.signOut(); 
    }
}