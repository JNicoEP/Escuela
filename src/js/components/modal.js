// Envolvemos todo en DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    const roleChooserModalEl = document.getElementById('roleChooserModal');
    const authModalEl = document.getElementById('authModal');
    const adminModalEl = document.getElementById('adminModal');
    
    // Instanciamos los modales de Bootstrap UNA SOLA VEZ
    const roleChooserModal = new window.bootstrap.Modal(roleChooserModalEl);
    const authModal = new window.bootstrap.Modal(authModalEl);
    const adminModal = new window.bootstrap.Modal(adminModalEl);


    // --- 1. Lógica de botones de Rol (Alumno/Docente) ---
    const roleButtons = document.querySelectorAll('.role-select-btn');
    roleButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault(); // <-- ¡MUY IMPORTANTE!
            
            // Ocultar el modal de selección de rol
            roleChooserModal.hide();

            // Mostrar el modal de autenticación
            authModal.show();
        });
    });

    // --- 2. Lógica del botón de Admin ---
    const adminRedirectButton = document.querySelector('[data-bs-target="#adminModal"]');
    if (adminRedirectButton) {
        adminRedirectButton.addEventListener('click', (event) => {
            event.preventDefault(); // <-- ¡MUY IMPORTANTE!
            
            roleChooserModal.hide();
            adminModal.show();
        });
    }
    
    // --- 3. Lógica del Botón "Volver" (Si lo borraste, esto no hará nada) ---
    const backToRolesButtons = document.querySelectorAll('.btn-back-to-roles');
    backToRolesButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Encuentra el modal actual en el que está el botón
            const currentModalEl = button.closest('.modal');
            if (!currentModalEl) return;
            
            if (currentModalEl.id === 'authModal') {
                authModal.hide();
            } else if (currentModalEl.id === 'adminModal') {
                adminModal.hide();
            }
            
            // Muestra el modal de selección de roles
            roleChooserModal.show();
        });
    });


    // --- 4. ARREGLO PARA EL "BACKDROP ATASCADO" (PROBLEMA DE LA 'X') ---
    // Este código es más robusto y escucha CADA VEZ que un modal se oculta
    
    function fixBackdrop() {
        // Espera un instante para que Bootstrap termine sus animaciones
        setTimeout(() => {
            // Revisa si queda algún otro modal abierto
            const anyModalOpen = document.querySelector('.modal.show');
            
            if (!anyModalOpen) {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }
        }, 300); // 300ms es un tiempo seguro
    }

    // Enganchamos la función a TODOS los modales
    roleChooserModalEl.addEventListener('hidden.bs.modal', fixBackdrop);
    authModalEl.addEventListener('hidden.bs.modal', fixBackdrop);
    adminModalEl.addEventListener('hidden.bs.modal', fixBackdrop);
    // Añade tu messageModal también
    document.getElementById('messageModal')?.addEventListener('hidden.bs.modal', fixBackdrop);

});