import supabase from './supabaseClient.js';

// Variable global para guardar el rol seleccionado en el Modal 1
let selectedRoleForRegistration = 'Alumno';

// handleRedirection mejorada: busca por id_usuario primero, luego por email si es necesario
async function handleRedirection(user) {
  try {
    const authUserId = user?.id ?? null;
    console.log("DEBUG: authUserId:", authUserId, "user.email:", user?.email);

    let userData = null;
    let queryError = null;

    // Buscar por id_usuario (PK) - .single() está bien si es PK
    if (authUserId) {
      const resById = await supabase
        .from('usuario')
        .select('id_rol, estado_acceso, email')
        .eq('id_usuario', authUserId)
        .single(); // PK -> single está apropiado

      userData = resById.data;
      queryError = resById.error;
      console.log("DEBUG: búsqueda por id_usuario result:", resById);
    }

    // Si no existe perfil por id, buscar por email con maybeSingle()
    if (!userData) {
      const emailToSearch = user?.email ?? null;
      if (!emailToSearch) {
        console.error("DEBUG: No hay id ni email para buscar el perfil del usuario.");
        alert("No se pudo identificar al usuario. Por favor, inicie sesión de nuevo.");
        await supabase.auth.signOut();
        return;
      }

      const resByEmail = await supabase
        .from('usuario')
        .select('id_rol, estado_acceso, id_usuario')
        .eq('email', emailToSearch)
        .maybeSingle(); // permite 0 o 1 fila

      userData = resByEmail.data;
      queryError = resByEmail.error;
      console.log("DEBUG: búsqueda por email result:", resByEmail);
    }

    // Manejo de errores en las consultas (incluye posibles errores RLS)
    if (queryError) {
      console.error("DEBUG-ERROR: Falló consulta usuario:", queryError);
      alert("Error al cargar perfil de usuario. Si el problema persiste, contacte al administrador.");
      await supabase.auth.signOut();
      return;
    }

    if (!userData) {
      console.warn("DEBUG: No se encontró fila en 'usuario' para el usuario autenticado.");
      alert("Su perfil aún no está creado en el sistema. Contacte al administrador o intente iniciar sesión más tarde.");
      await supabase.auth.signOut();
      return;
    }

    // Verificar estado de acceso
    if (userData.estado_acceso !== 'aprobado') {
      console.warn("Intento de login de usuario no aprobado. Estado:", userData.estado_acceso);
      alert("Su cuenta está pendiente de aprobación por un administrador.");
      await supabase.auth.signOut();
      return;
    }

    const idRol = userData.id_rol;
    console.log("DEBUG: idRol:", idRol);

    const { data: roleData, error: roleError } = await supabase
      .from('rol')
      .select('nombre_rol')
      .eq('id_rol', idRol)
      .single();

    if (roleError || !roleData) {
      console.error("DEBUG-ERROR: Falló al leer rol:", roleError);
      alert("Error interno: no se pudo determinar el rol del usuario.");
      await supabase.auth.signOut();
      return;
    }

    const roleName = roleData.nombre_rol;
    console.log("DEBUG: roleName:", roleName);

    // Redirecciones según rol
    if (roleName === 'Administrador') {
      window.location.href = '/paneles/admin_panel.html';
    } else if (roleName === 'Docente') {
      window.location.href = '/profesores.html';
    } else if (roleName === 'Alumno') {
      window.location.href = '/alumnos.html';
    } else if (roleName === 'Padre' || roleName === 'Padres') {
      window.location.href = '/padres.html';
    } else {
      console.warn("Rol desconocido:", roleName);
      alert("Rol de usuario desconocido. Redirigiendo a inicio.");
      window.location.href = '/';
    }

  } catch (err) {
    console.error("DEBUG-ERROR inesperado en handleRedirection:", err);
    alert("Error inesperado durante el inicio de sesión. Revisa la consola.");
    try { await supabase.auth.signOut(); } catch (e) { /* noop */ }
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

  // data.user puede ser undefined si la sesión no se crea (confirmación por email)
  if (!data?.user) {
    console.warn("No se obtuvo user en la respuesta de signIn. data:", data);
    alert("Inicio de sesión parcial. Si no puedes acceder, verifica tu correo para confirmar la cuenta.");
    return;
  }

  await handleRedirection(data.user);
}

// 6. FUNCIÓN DE REGISTRO (CON LÓGICA DE APROBACIÓN)
async function registrarUsuario(nombre, email, password, roleName) {
  // Paso 1: Obtener el ID del rol usando maybeSingle (acepta 0 o 1 fila)
  const { data: roleData, error: roleError } = await supabase
    .from('rol')
    .select('id_rol, nombre_rol')
    .eq('nombre_rol', roleName)
    .maybeSingle();

  if (roleError) {
    console.error("Error buscando el rol:", roleError);
    alert("Error al buscar el rol. Intenta de nuevo más tarde.");
    return null;
  }

  if (!roleData) {
    console.warn(`Rol '${roleName}' no encontrado en la tabla rol.`);
    alert(`El rol '${roleName}' no existe. Contacta al administrador.`);
    return null;
  }

  const id_rol_seleccionado = roleData.id_rol;

  // Paso 2: Registra al usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
  });

  console.log('DEBUG signUp result:', { authData, authError });
  if (authError) {
    console.error("Error de Registro (Auth):", authError.message);
    alert(`Error al registrar: ${authError.message}`);
    return null;
  }

  // LÓGICA DE APROBACIÓN AUTOMÁTICA
  const estado_del_usuario = (roleName === 'Alumno' || roleName === 'Padre' || roleName === 'Padres') ? 'aprobado' : 'pendiente';

  // Paso 3: Upsert en 'usuario' para crear o actualizar el perfil
  const userId = authData?.user?.id ?? null;
  if (!userId) {
    console.warn('No se obtuvo user.id en signUp. Probablemente se requiera confirmación por email.');
    alert('Se ha enviado un email de confirmación. Confirma tu correo para completar el registro.');
    return estado_del_usuario;
  }

  const { data: upsertData, error: upsertError } = await supabase
    .from('usuario')
    .upsert({
      id_usuario: userId,
      nombre: nombre,
      apellido: '',
      email: email,
      id_rol: id_rol_seleccionado,
      estado_acceso: estado_del_usuario
    }, { onConflict: 'id_usuario' });

  console.log('DEBUG upsert result:', { upsertData, upsertError });
  if (upsertError) {
    console.error("Error al upsert usuario:", upsertError);
    if (upsertError.message && upsertError.message.toLowerCase().includes('rls')) {
      alert('Error de permisos en la base de datos. Contacte al administrador.');
    } else {
      alert('Error al crear el perfil de usuario. Verifica la consola.');
    }
    return null;
  }

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

      if (!data?.user) {
        console.warn("No se obtuvo user en la respuesta de signIn (admin). data:", data);
        alert("Inicio de sesión parcial. Si no puedes acceder, verifica tu correo para confirmar la cuenta.");
        return;
      }

      await handleRedirection(data.user);
    });
  }
});