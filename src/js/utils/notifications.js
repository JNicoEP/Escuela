// src/js/utils/notifications.js

// Variables internas del módulo para cachear el modal
let messageModal = null;
let messageModalBody = null;
let messageModalTitle = null;

/**
 * Muestra un mensaje en el modal de Bootstrap #messageModal.
 * @param {string} message El texto a mostrar.
 * @param {string} [title='Aviso del Sistema'] Título opcional para el modal.
 */
export function showMessage(message, title = 'Aviso del Sistema') {
    if (!messageModal) {
        // Bootstrap (cargado desde el CDN) estará disponible en 'window'
        const modalEl = document.getElementById('messageModal');
        if (modalEl && window.bootstrap) {
            messageModal = new window.bootstrap.Modal(modalEl);
            messageModalBody = document.getElementById('messageModalBody');
            messageModalTitle = document.getElementById('messageModalLabel');
        } else {
            console.warn('Modal de mensajes #messageModal o Bootstrap JS no encontrado. Usando alert().');
            alert(message); // Fallback
            return;
        }
    }
    
    // Actualiza el contenido y muestra el modal
    messageModalTitle.textContent = title || 'Aviso del Sistema';
    messageModalBody.textContent = message;
    messageModal.show();
}