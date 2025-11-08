const roleChooserModal = document.getElementById('roleChooserModal');
let selectedRole = '';

if (roleChooserModal) {
    roleChooserModal.addEventListener('show.bs.modal', () => {
        console.log('Modal de selección de rol abierto');
    });

    const roleButtons = document.querySelectorAll('.role-select-btn');
    roleButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            selectedRole = button.getAttribute('data-role');
            console.log(`Rol seleccionado: ${selectedRole}`);
            
            // Ocultar el modal de selección de rol
            // AÑADIMOS window.
            const modal = window.bootstrap.Modal.getInstance(roleChooserModal);
            if (modal) {
                modal.hide();
            }

            // Mostrar el modal de autenticación
            // AÑADIMOS window.
            const authModal = new window.bootstrap.Modal(document.getElementById('authModal'));
            authModal.show();
        });
    });
}

const authModal = document.getElementById('authModal');
if (authModal) {
    authModal.addEventListener('show.bs.modal', () => {
        const authModalLabel = document.getElementById('authModalLabel');
        if (authModalLabel) {
            authModalLabel.textContent = `Acceso para ${selectedRole}`;
        }
    });
}

const adminRedirectButton = document.querySelector('[data-bs-target="#adminModal"]');
if (adminRedirectButton) {
    adminRedirectButton.addEventListener('click', (event) => {
        event.preventDefault();
        
        // AÑADIMOS window.
        const roleModal = window.bootstrap.Modal.getInstance(roleChooserModal);
        if(roleModal) {
            roleModal.hide();
        }
        
        // AÑADIMOS window.
        const adminModal = new window.bootstrap.Modal(document.getElementById('adminModal'));
        adminModal.show();
    });
}
// --- LÓGICA DEL BOTÓN "ATRÁS" ---
const backToRolesButtons = document.querySelectorAll('.btn-back-to-roles');
const mainRolesModal = document.getElementById('roleChooserModal');

backToRolesButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Encuentra el modal actual en el que está el botón
        const currentModalEl = button.closest('.modal');
        if (!currentModalEl) return;

        // Oculta el modal actual
        const currentModalInstance = window.bootstrap.Modal.getInstance(currentModalEl);
        if (currentModalInstance) {
            currentModalInstance.hide();
        }

        // Muestra el modal de selección de roles
        const rolesModalInstance = new window.bootstrap.Modal(mainRolesModal);
        rolesModalInstance.show();
    });
});


// AÑADIR AL FINAL DE src/js/modal.js

// --- ARREGLO PARA EL "BACKDROP ATASCADO" (PROBLEMA DE LA 'X') ---
// Esto limpia la pantalla si cierras el último modal con la 'X'
document.querySelectorAll('.modal').forEach(modal => {
    
    modal.addEventListener('hidden.bs.modal', event => {
        // Espera un instante para que Bootstrap termine sus animaciones
        setTimeout(() => {
            // Revisa si queda algún otro modal abierto
            const anyModalOpen = document.querySelector('.modal.show');
            
            if (!anyModalOpen) {
                // Si no hay más modales abiertos, forzamos la limpieza
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }
        }, 100);
    });
});