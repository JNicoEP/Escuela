import { supabase } from '../config/supabaseClient.js';


document.addEventListener('DOMContentLoaded', () => {
    // 1. Referencias a los elementos del DOM
    const form = document.getElementById('updatePasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const messageContainer = document.getElementById('messageContainer');
    const submitBtn = document.getElementById('submitBtn');

    // 2. Configurar los botones de "Ver Contraseña"
    setupPasswordToggle('newPassword', 'toggleNewPassword');
    setupPasswordToggle('confirmPassword', 'toggleConfirmPassword');

    // 3. Manejar el envío del formulario
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validaciones locales
            if (newPassword !== confirmPassword) {
                showMessage('Las contraseñas no coinciden. Por favor, verifica.', 'danger');
                return;
            }

            if (newPassword.length < 6) {
                showMessage('La contraseña debe tener al menos 6 caracteres.', 'danger');
                return;
            }

            // Cambiar estado del botón a "Cargando"
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Guardando...';
            submitBtn.disabled = true;

            try {
                // 4. Enviar la nueva contraseña a Supabase
                const { error } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                // 5. Éxito: Mostrar mensaje y redirigir
                showMessage('¡Contraseña actualizada con éxito! Redirigiendo al inicio de sesión...', 'success');
                form.reset();
                
                // Esperamos 3 segundos para que el usuario lea el mensaje y lo enviamos al index
                setTimeout(() => {
                    window.location.href = '../index.html'; 
                }, 3000);

            } catch (error) {
                console.error('Error al actualizar contraseña:', error);
                showMessage(`Hubo un error: ${error.message}`, 'danger');
                
                // Restaurar el botón si hubo error
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // --- Funciones Auxiliares ---

    // Muestra alertas usando las clases de Bootstrap (success, danger, warning, etc.)
    function showMessage(text, type) {
        messageContainer.textContent = text;
        messageContainer.className = `alert alert-${type} mb-4 text-center d-block`;
    }

    // Reutilizamos tu lógica para alternar la visibilidad de la contraseña
    function setupPasswordToggle(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        
        if (input && btn) {
            btn.addEventListener('click', () => {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                }
            });
        }
    }
});