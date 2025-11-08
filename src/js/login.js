import { supabase } from '/src/js/supabaseClient.js';

// Variable global para guardar el rol seleccionado
// Esta variable la setea `modal.js` o los listeners de aquí
let selectedRoleForRegistration = 'Alumno'; 

// handleRedirection mejorada: busca por id_usuario primero, luego por email si es necesario
async function handleRedirection(user) {
  try {
    if (!user || !user.id) {
        alert("No se pudo identificar al usuario. Por favor, inicie sesión de nuevo.");
        await supabase.auth.signOut();
        return;
    }

    // 1. Obtener el perfil del usuario desde tu tabla 'usuario'
    const { data: userData, error: queryError } = await supabase
        .from('usuario')
        .select('id_rol, estado_acceso')
        .eq('id_usuario', user.id)
        .single();

    if (queryError || !userData) {
        console.error("Error al cargar perfil de usuario:", queryError);
        alert("Su perfil aún no está creado o no se pudo cargar. Contacte al administrador.");
        await supabase.auth.signOut();
        return;
    }

    // 2. Verificar si la cuenta está aprobada
    if (userData.estado_acceso !== 'aprobado') {
        console.warn("Intento de login de usuario no aprobado. Estado:", userData.estado_acceso);
        alert("Su cuenta está pendiente de aprobación por un administrador.");
        await supabase.auth.signOut();
        return;
    }

    // 3. Obtener el nombre del rol
    const { data: roleData, error: roleError } = await supabase
        .from('rol')
        .select('nombre_rol')
        .eq('id_rol', userData.id_rol)
        .single();

    if (roleError || !roleData) {
        console.error("Error al determinar el rol:", roleError);
        alert("Error interno: no se pudo determinar el rol del usuario.");
        await supabase.auth.signOut();
        return;
    }

    const roleName = roleData.nombre_rol;
    console.log("DEBUG: roleName:", roleName);

    // 4. Redirigir según el rol
    switch (roleName) {
        case 'Administrador':
        window.location.assign('../pages/admin_panel.html');
        break;
        case 'Docente':
        window.location.assign('../pages/profesores.html');
        break;
        case 'Alumno':
        window.location.assign('../pages/alumnos.html');
        break;
        case 'Padre':
        window.location.assign('../pages/padres.html');
        break;
        case 'Padres':
        window.location.assign('../pages/alumnos.html'); 
        break;
        default:
    console.warn("Rol desconocido:", roleName);
        alert("Rol de usuario no reconocido. Redirigiendo a la página de inicio.");
        window.location.assign('../../index.html');
    }

} catch (err) {
    console.error("Error inesperado en handleRedirection:", err);
    alert("Ocurrió un error inesperado durante el inicio de sesión.");
    try { await supabase.auth.signOut(); } catch (e) { /* No hacer nada */ }
}
}

// 5. FUNCIÓN DE INICIO DE SESIÓN (MODAL DE TABS)
async function iniciarSesion(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert(`Error al iniciar sesión: ${error.message}`);
    return;
  }
  if (!data.user) {
    alert("No se pudo verificar el usuario. Si es la primera vez que te registras, confirma tu correo electrónico.");
    return;
  }

  await handleRedirection(data.user);
}

// 6. FUNCIÓN DE REGISTRO (ACTUALIZADA con apellido y dni)
async function registrarUsuario(nombre, apellido, dni, email, password, roleName) {
  // 1. Obtener el id_rol (esto no cambia)
  const { data: roleData, error: roleError } = await supabase
    .from('rol')
    .select('id_rol')
    .eq('nombre_rol', roleName)
    .single();

  if (roleError || !roleData) {
    alert("Error de configuración: No se pudo encontrar el rol especificado.");
    return { success: false };
  }

  // 2. Registrar el usuario en Supabase Auth (esto no cambia)
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError) {
    // ... (manejo de error no cambia)
    return { success: false };
  }

  if (!authData.user) {
    // ... (manejo de confirmación no cambia)
    return { success: true, requiresConfirmation: true };
  }

  // 3. Crear el perfil del usuario en la tabla 'usuario' (ACTUALIZADO)
  const estado_acceso = (roleName === 'Alumno' || roleName === 'Padre') ? 'aprobado' : 'pendiente';
  
  const { error: insertError } = await supabase
    .from('usuario')
    .insert({
      id_usuario: authData.user.id,
      nombre: nombre,
      apellido: apellido, // <-- CAMPO AÑADIDO
      dni: dni,           // <-- CAMPO AÑADIDO
      email: email,
      id_rol: roleData.id_rol,
      estado_acceso: estado_acceso
    });

  if (insertError) {
    console.error("Error al crear perfil:", insertError); // <-- Añadí esto para depurar
    alert("Error al crear el perfil de usuario. Contacta al administrador.");
    return { success: false };
  }

  return { success: true, status: estado_acceso };
}


// --- INICIO DE LA LÓGICA (SE EJECUTA AHORA DIRECTAMENTE) ---

const loginModalTitle = document.getElementById('authModalLabel');
const roleSelectButtons = document.querySelectorAll('.role-select-btn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const adminForm = document.getElementById('adminForm');

// --- Lógica del Modal 1 (Selección de Rol) ---
// Nota: 'modal.js' ya maneja la navegación. Esto es solo para setear el rol.
roleSelectButtons.forEach(button => {
  button.addEventListener('click', function(event) {
    // event.preventDefault() es manejado por modal.js
    const role = this.getAttribute('data-role');
    selectedRoleForRegistration = role; // Setea la variable global
    
    // modal.js también setea el título, pero lo re-seteamos por si acaso.
    if (loginModalTitle) {
        loginModalTitle.textContent = 'Acceso - Panel de ' + role;
    }
  });
});

// --- Lógica del Modal 2 (Formularios de Login/Registro) ---
if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
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
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const nombre = document.getElementById('registerNombre').value;
    const apellido = document.getElementById('registerApellido').value;
    
    // 1. Obtenemos el DNI "sucio" (tal como lo escribió el usuario)
    const dniRaw = document.getElementById('registerDNI').value;
    
    // 2. Lo limpiamos quitando TODOS los puntos
    const dniClean = dniRaw.replaceAll('.', ''); // Ej: "30.123.456" -> "30123456"

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    // 3. Validamos usando la versión limpia
    if (!nombre || !apellido || !dniClean || !email || !password) {
        alert('Por favor, complete todos los campos.');
        return;
    }

    // 4. Enviamos la versión limpia a la base de datos
    const result = await registrarUsuario(nombre, apellido, dniClean, email, password, selectedRoleForRegistration);

    if (result.success) {
      // ... (el resto del código no cambia)
    }
  });
}

// --- LÓGICA PARA EL MODAL DE ADMIN (#adminModal) ---
if (adminForm) {
  adminForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    if (!email || !password) {
        alert('Por favor, complete todos los campos.');
    } else {
        iniciarSesion(email, password);
    }
  });
}
// --- CÓDIGO PARA MOSTRAR/OCULTAR CONTRASEÑA ---

/**
 * Función reutilizable para configurar el botón "ver contraseña"
 * @param {string} inputId - El ID del <input> de la contraseña
 * @param {string} buttonId - El ID del <button> que tiene el ícono del ojo
 */
function setupPasswordToggle(inputId, buttonId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(buttonId);

    // Nos aseguramos de que ambos elementos existan
    if (passwordInput && toggleButton) {
        
        toggleButton.addEventListener('click', () => {
            // Revisa el tipo actual del input
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Cambia el ícono del ojo
            const icon = toggleButton.querySelector('i');
            if (type === 'text') {
                // Si es texto, muestra el ojo tachado
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                // Si es contraseña, muestra el ojo normal
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
}

// Conectamos la función a los 3 botones de tus modales
// (Esto se ejecuta en cuanto main.js carga login.js)
setupPasswordToggle('loginPassword', 'toggleLoginPassword');
setupPasswordToggle('registerPassword', 'toggleRegisterPassword');
setupPasswordToggle('adminPassword', 'toggleAdminPassword');