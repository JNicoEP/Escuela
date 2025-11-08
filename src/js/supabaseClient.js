/**
 * -------------------------------------------------------------------------
 * CONFIGURACIÓN DE SUPABASE PARA VITE
 * -------------------------------------------------------------------------
 * Este archivo inicializa el cliente de Supabase usando módulos ES6
 * y las variables de entorno de Vite.
 */

// 1. Importar el cliente desde el paquete NPM
import { createClient } from '@supabase/supabase-js';

// 2. Leer las variables de entorno de Vite (desde .env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 3. Exportar el cliente para que otros módulos puedan importarlo
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 4. Sistema de Mensajería (exportado como módulo)
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