
// El código se ejecuta en cuanto main.js lo importa.

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.createElement('div');
    notificacion.classList.add('notificacion', tipo);
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    // Ocultar la notificación después de 3 segundos
    setTimeout(() => {
        notificacion.remove();
    }, 3000);
}

// Función para mostrar mensaje de bienvenida
function mostrarMensajeBienvenida(nombre, rol) {
    mostrarNotificacion(`Bienvenido al sistema panel ${rol}, ${nombre}!`, 'success');
}



// 4. Filtrado de archivos
window.filtrarArchivos = function () {
    let input = document.getElementById("searchInput").value.toLowerCase();
    let rows = document.getElementById("tablaArchivos").getElementsByTagName("tr");
    let resultadosEncontrados = false;

    for (let i = 0; i < rows.length; i++) {
        let archivo = rows[i].getElementsByTagName("td")[0].textContent.toLowerCase();
        if (archivo.includes(input)) {
            rows[i].style.display = "";
            resultadosEncontrados = true;
        } else {
            rows[i].style.display = "none";
        }
    }

    // Mostrar mensaje si no hay resultados
    let mensajeNoResultados = document.getElementById("mensajeNoResultados");
    if (!resultadosEncontrados) {
        if (!mensajeNoResultados) {
            let nuevaFila = document.createElement("tr");
            nuevaFila.id = "mensajeNoResultados";
            nuevaFila.innerHTML = `<td colspan="4" class="text-center">No se encontraron resultados.</td>`;
            document.getElementById("tablaArchivos").appendChild(nuevaFila);
        }
    } else {
        if (mensajeNoResultados) {
            mensajeNoResultados.remove();
        }
    }
};

// 7. Efecto pop-up del sidebar
const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggleBtn");

if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("active");
    });
}

// CODIGO COMBINADO CON EL LOGIN.JS
// /src/js/pages/index.js (COMBINADO)

// 1. IMPORTA EL CLIENTE DE SUPABASE
// (Asegúrate que la ruta a supabaseClient.js sea correcta)
import { supabase } from '../supabaseClient.js';

// Variable global para guardar el rol seleccionado
let selectedRoleForRegistration = 'Alumno';



// ===============================================
// FUNCIONES DE AUTENTICACIÓN (DE TU login.js)
// ===============================================

// handleRedirection (CORREGIDA)
async function handleRedirection(user) {
  try {
    if (!user || !user.id) {
        alert("No se pudo identificar al usuario. Por favor, inicie sesión de nuevo.");
        await supabase.auth.signOut();
        return;
    }

    // 1. Obtener el perfil del usuario (¡¡PLURAL!!)
    const { data: userData, error: queryError } = await supabase
        .from('usuarios') // <-- CORREGIDO
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
        window.location.assign('/paneles/admin_panel.html');
        break;
        case 'Docente':
        window.location.assign('/profesores.html');
        break;
        case 'Alumno':
        window.location.assign('/alumnos.html');
        break;
        case 'Padre':
        window.location.assign('/padres.html');
        break;
        case 'Padres':
        window.location.assign('/alumnos.html'); 
        break;
        default:
    console.warn("Rol desconocido:", roleName);
        alert("Rol de usuario no reconocido. Redirigiendo a la página de inicio.");
        window.location.assign('/index.html');
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

// 6. FUNCIÓN DE REGISTRO (CORREGIDA)
async function registrarUsuario(nombre, apellido, dni, email, password, roleName) {
  // 1. Obtener el id_rol
  const { data: roleData, error: roleError } = await supabase
    .from('rol')
    .select('id_rol')
    .eq('nombre_rol', roleName)
    .single();

  if (roleError || !roleData) {
    alert("Error de configuración: No se pudo encontrar el rol especificado.");
    return { success: false };
  }

  // 2. Registrar el usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError) {
    console.error("Error de Registro (Auth):", authError.message);
    alert(`Error al registrar: ${authError.message}`);
    return { success: false };
  }

  if (!authData.user) {
    alert("Se ha enviado un email de confirmación. Confirma tu correo para completar el registro.");
    return { success: true, requiresConfirmation: true };
  }

  // 3. Crear el perfil del usuario (¡¡PLURAL!!)
  const estado_acceso = (roleName === 'Alumno' || roleName === 'Padre') ? 'aprobado' : 'pendiente';
  
  const { error: upsertError } = await supabase
    .from('usuarios') // <-- CORREGIDO
    .upsert({
      id_usuario: authData.user.id,
      nombre: nombre,
      apellido: apellido,
      dni: dni, 
      email: email,
      id_rol: roleData.id_rol,
      estado_acceso: estado_acceso
    }, { onConflict: 'id_usuario' }); // IMPORTANTE: Usa 'upsert'

  if (upsertError) {
    console.error("Error al crear perfil (upsert):", upsertError); 
    alert("Error al crear el perfil de usuario. Contacta al administrador.");
    return { success: false };
  }

  return { success: true, status: estado_acceso };
}


// ===============================================
// EJECUCIÓN INMEDIATA (EVENT LISTENERS)
// ===============================================

const loginModalTitle = document.getElementById('authModalLabel');
const roleSelectButtons = document.querySelectorAll('.role-select-btn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const adminForm = document.getElementById('adminForm');

// --- Lógica del Modal 1 (Selección de Rol) ---
roleSelectButtons.forEach(button => {
  button.addEventListener('click', function(event) {
    const role = this.getAttribute('data-role');
    selectedRoleForRegistration = role; 
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
    
    // CORREGIDO: IDs de tu HTML
    const nombre = document.getElementById('registerName').value; // Asumiendo 'registerName'
    const apellido = document.getElementById('registerApellido').value; // Asumiendo 'registerApellido'
    const dniRaw = document.getElementById('registerDNI').value; // Asumiendo 'registerDNI'
    const dniClean = dniRaw.replaceAll('.', ''); 
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    if (!nombre || !apellido || !dniClean || !email || !password) {
        alert('Por favor, complete todos los campos.');
        return;
    }

    const result = await registrarUsuario(nombre, apellido, dniClean, email, password, selectedRoleForRegistration);

    if (result && result.success) {
      
        if (result.requiresConfirmation) {
            alert('¡Registro casi listo! Revisa tu email para confirmar la cuenta.');
        }
        else if (result.status === 'aprobado') {
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
function setupPasswordToggle(inputId, buttonId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(buttonId);

    if (passwordInput && toggleButton) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = toggleButton.querySelector('i');
            if (type === 'text') {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
  D         } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
}

// Conectamos la función a los 3 botones de tus modales
setupPasswordToggle('loginPassword', 'toggleLoginPassword');
setupPasswordToggle('registerPassword', 'toggleRegisterPassword');
setupPasswordToggle('adminPassword', 'toggleAdminPassword');