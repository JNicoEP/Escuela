import { AuthService } from '../services/auth.service.js';
// Asegúrate de tener showMessage en utils o config
import { showMessage } from '../utils/notifications.js'; 

// --- VARIABLES GLOBALES ---
let currentSelectedRole = 'alumno';

export function initLogin() {
    console.log(' initLogin ejecutado: Configurando eventos del Login...');

    const loginModalTitle = document.getElementById('authModalLabel');
    const roleSelectButtons = document.querySelectorAll('.role-select-btn');

    // 1. Botones de Rol
    roleSelectButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const roleAttribute = e.currentTarget.getAttribute('data-role');
            if (roleAttribute) {
                let role = roleAttribute.toLowerCase();
                currentSelectedRole = role; 

                if (loginModalTitle) {
                    const capitalRole = role.charAt(0).toUpperCase() + role.slice(1);
                    loginModalTitle.textContent = 'Acceso - Panel de ' + capitalRole;
                }
            }
            document.getElementById('registerForm')?.reset();
            document.getElementById('loginForm')?.reset();
        });
    });

    // 2. Password Toggles
    setupPasswordToggle('loginPassword', 'toggleLoginPassword');
    setupPasswordToggle('registerPassword', 'toggleRegisterPassword');
    setupPasswordToggle('adminPassword', 'toggleAdminPassword');

    // 3. Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            iniciarSesion(email, password, currentSelectedRole);
        });
    }

    // 4. Admin Form
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            iniciarSesion(email, password, 'admin');
        });
    }

    // 5. Register Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Recolectar datos...
            const nombre = document.getElementById('registerNombre').value;
            const apellido = document.getElementById('registerApellido').value;
            const dni = document.getElementById('registerDNI').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            if (!nombre || !apellido || !dni || !email || !password) {
                showMessage('Por favor, complete todos los campos.', 'Error');
                return;
            }

            // LLAMADA AL SERVICIO (Reemplaza tu función registrarUsuario local)
            try {
                const result = await AuthService.registerUserFull(email, password, {
                    nombre, apellido, dni, roleName: currentSelectedRole
                });

                if (result.success) {
                     // Tu lógica de éxito original
                    showMessage('¡Registro exitoso! Ya puedes iniciar sesión.', 'Éxito');
                    registerForm.reset();
                    const loginTabButton = document.getElementById('login-tab');
                    if (loginTabButton) new bootstrap.Tab(loginTabButton).show();
                } else {
                    throw result.error;
                }
            } catch (error) {
                console.error('Error registro:', error);
                showMessage(`Error al registrar: ${error.message}`, 'Error');
            }
        });
    }
}

// --- FUNCIONES LÓGICAS (CONTROLADORES) ---

async function iniciarSesion(email, password, intendedRole) {
    // LLAMADA AL SERVICIO
    const { data, error } = await AuthService.signIn(email, password);

    if (error) {
        console.error('Error de inicio de sesión:', error);
        showMessage('Error al iniciar sesión: Email o contraseña incorrectos.', 'Error');
        return;
    }

    if (data.user) {
        // Mantenemos tu lógica de redirección aquí
        await handleRedirection(data.user, intendedRole);
    }
}

/**
 * Tu función handleRedirection ORIGINAL (ligeramente adaptada para usar el servicio)
 */
async function handleRedirection(user, intendedRole) {
    try {
        // 1. PEDIR DATOS AL SERVICIO (En vez de hacer la query aquí)
        const userData = await AuthService.getUserDataForRedirection(user.id);

        if (!userData || !userData.rol) throw new Error("Perfil de usuario o rol no encontrado.");

        const userRole = userData.rol.nombre_rol; 

        // --- TU LÓGICA DE VALIDACIÓN DE ROL INTACTA ---
        if (intendedRole !== userRole) {
            const capitalRole = userRole.charAt(0).toUpperCase() + userRole.slice(1);
            
            // Ocultar modales (Bootstrap)
            hideModal('authModal');
            hideModal('adminModal');

            showMessage(`Usted es ${capitalRole}. No puede entrar a este panel.`, 'Acceso Denegado');
            await AuthService.signOut();
            return;
        }

        // 2. Caso especial: Docente (TU LÓGICA INTACTA)
        if (userRole === 'docente') {
            const docenteInfo = userData.docentes; 
            if (!docenteInfo) throw new Error("Datos de docente no encontrados.");

            if (docenteInfo.estado === 'pendiente') {
                showMessage('Tu cuenta de docente está pendiente de aprobación.', 'Cuenta Pendiente');
                await AuthService.signOut(); 
                hideModal('authModal');
                hideModal('roleChooserModal');
                return;
            }
            if (docenteInfo.estado === 'rechazado') {
                showMessage('Tu solicitud ha sido rechazada.', 'Cuenta Rechazada');
                await AuthService.signOut(); 
                return;
            }
        }

        // 3. Redirecciones (TU LÓGICA INTACTA)
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
                showMessage('Rol desconocido.', 'Error');
                await AuthService.signOut();
        }

    } catch (error) {
        console.error('Error redirección:', error);
        showMessage(`Error: ${error.message}`, 'Error');
        await AuthService.signOut(); 
    }
}

// --- HELPERS ---

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

function hideModal(modalId) {
    try {
        const el = document.getElementById(modalId);
        const modal = bootstrap.Modal.getInstance(el);
        if (modal) modal.hide();
    } catch(e) {}
}