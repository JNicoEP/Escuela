// js/login.js

import supabase from './supabaseClient.js';

// Variable global para guardar el rol seleccionado en el Modal 1
let selectedRoleForRegistration = 'Alumno'; 

// 1. FUNCIÓN DE REDIRECCIÓN (¡¡CORREGIDA PARA USAR EMAIL!!)
async function handleRedirection(user) {
    
    // ¡¡CAMBIO!! Buscamos por email, no por ID.
    console.log("DEBUG: Buscando rol y estado para el email:", user.email); 
    
    const { data: userData, error: userError } = await supabase
        .from('usuario')
        .select('id_rol, estado_acceso') 
        .eq('email', user.email) // ¡¡AQUÍ ESTÁ EL CAMBIO!!
        .single();
    
    if (userError) {
        console.error("DEBUG-ERROR: Fallo al obtener id_rol/estado del usuario:", userError.message);
        alert("Error de seguridad: No se pudo cargar el perfil. Verifique su política RLS.");
        await supabase.auth.signOut();
        return;
    }
    
    // 2. VERIFICACIÓN DE ESTADO
    if (userData.estado_acceso !== 'aprobado') {
        console.warn("Intento de login de usuario no aprobado. Estado:", userData.estado_acceso);
        alert("Su cuenta está pendiente de aprobación por un administrador.");
        await supabase.auth.signOut();
        return;
    }
    
    const idRol = userData.id_rol;

    // 3. SEGUNDO PASO: Obtener el nombre del rol
    console.log("DEBUG: ID de rol encontrado:", idRol); 

    const { data: roleData, error: roleError } = await supabase
        .from('rol') 
        .select('nombre_rol') 
        .eq('id_rol', idRol)
        .single();
        
    if (roleError) {
        console.error("DEBUG-ERROR: Fallo al obtener nombre del rol:", roleError.message);
        alert("Error de configuración: Rol de usuario no encontrado.");
        await supabase.auth.signOut();
        return;
    }

    const roleName = roleData.nombre_rol;
    console.log("DEBUG: Redirigiendo como:", roleName); 

    // 4. Redirección basada en el rol
    if (roleName === 'Administrador') {
        window.location.href = '/paneles/admin_panel.html';
    } else if (roleName === 'Docente') {
        window.location.href = '/profesores.html';
    } else if (roleName === 'Alumno') {
        window.location.href = '/alumnos.html';
    } else if (roleName === 'Padre') {
        window.location.href = '/padres.html'; 
    } else {
        alert("Rol de usuario desconocido. Redirigiendo a inicio.");
        window.location.href = '/'; 
    }
}

// 5. FUNCIÓN DE INICIO DE SESIÓN (MODAL DE TABS)
async function iniciarSesion(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error("Error de Login:", error.message);
        alert(`Error: ${error.message}`);
        return;
    }
    
    await handleRedirection(data.user);
}

// 6. FUNCIÓN DE REGISTRO (CON LÓGICA DE APROBACIÓN)
async function registrarUsuario(nombre, email, password, roleName) {
    
    // Paso 1: Obtener el ID del rol
    let id_rol_seleccionado;
    try {
        const { data: roleData, error: roleError } = await supabase
            .from('rol') 
            .select('id_rol')
            .eq('nombre_rol', roleName) 
            .single();
        
        if (roleError) throw roleError;
        id_rol_seleccionado = roleData.id_rol;

    } catch (error) {
        console.error("Error buscando el rol:", error.message);
        alert(`Error de configuración: No se pudo encontrar el rol '${roleName}'.`);
        return null;
    }

    // Paso 2: Registra al usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (authError) {
        console.error("Error de Registro (Auth):", authError.message);
        alert(`Error al registrar: ${authError.message}`);
        return null;
    }

    // LÓGICA DE APROBACIÓN AUTOMÁTICA
    const estado_del_usuario = (roleName === 'Alumno' || roleName === 'Padre') ? 'aprobado' : 'pendiente';

    // Paso 3: Actualizamos la fila en 'usuario'
    // (Esta consulta funciona porque la RLS de UPDATE también usa el email)
    const { data: updateData, error: updateError } = await supabase
        .from('usuario') 
        .update({ 
            nombre: nombre, 
            apellido: '',
            id_rol: id_rol_seleccionado,
            estado_acceso: estado_del_usuario 
        })
        .eq('id_usuario', authData.user.id); // Usamos el ID de Auth para el UPDATE

    if (updateError) {
        console.error("Error al actualizar perfil:", updateError.message);
    }
    
    // Devuelve el estado para que el listener decida qué alerta mostrar
    return estado_del_usuario; 
}

// 7. LÓGICA DE LOS MODALES
document.addEventListener('DOMContentLoaded', function() {
    
    // --- Referencias a los Modales ---
    const loginModalTitle = document.getElementById('authModalLabel');
    const roleSelectButtons = document.querySelectorAll('.role-select-btn'); 
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const adminForm = document.getElementById('adminForm');

    // --- Lógica del Modal 1 (Selección de Rol) ---
    roleSelectButtons.forEach(button => {
        button.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            selectedRoleForRegistration = role; 
            if (loginModalTitle) {
                loginModalTitle.textContent = 'Acceso - Panel de ' + role;
            }
        });
    });

    // --- Lógica del Modal 2 (Formularios de Login/Registro) ---
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            if (!email || !password) {
                alert('Por favor, complete todos los campos.');
            } else {
                iniciarSesion(email, password);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const nombre = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            if (!nombre || !email || !password) {
                alert('Por favor, complete todos los campos.');
                return;
            }
            
            const estado_final = await registrarUsuario(nombre, email, password, selectedRoleForRegistration);

            if (estado_final) { 
                if (estado_final === 'aprobado') {
                    alert('¡Registro exitoso! Por favor inicie sesión.');
                } else {
                    alert('¡Registro exitoso! Espere a confirmación de administración.');
                }

                const loginTabButton = document.getElementById('login-tab');
                if (loginTabButton) {
                    const tab = new bootstrap.Tab(loginTabButton);
                    tab.show();
                }
                registerForm.reset();
            }
        });
    }

    // --- LÓGICA PARA EL MODAL DE ADMIN (#adminModal) ---
    if (adminForm) {
        adminForm.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;

            if (!email || !password) {
                alert('Por favor, complete todos los campos.');
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                console.error("Error de Login (Admin):", error.message);
                alert(`Error: ${error.message}`);
                return;
            }
            
            await handleRedirection(data.user);
        });
    }
});