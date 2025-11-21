/**
 * Inicializa la lógica para el botón de alternancia del Sidebar flotante.
 * NOTA: Esta función DEBE llamarse después de que el DOM haya cargado los elementos.
 */
export function setupSidebarToggle() {
    // Referencia el ID correcto del aside y el botón
    const sidebar = document.getElementById('sidebar_proyecto'); 
    const toggleBtn = document.getElementById('sidebar-toggle'); 

    // 📢 LÍNEA DE DEBUG 1: Para ver qué encontró
    console.log("DEBUG SIDEBAR: Sidebar encontrado:", !!sidebar, " | Botón encontrado:", !!toggleBtn);

    if (sidebar && toggleBtn) {
        // 📢 LÍNEA DE DEBUG 2: Para saber si el listener se adjunta
        console.log("DEBUG SIDEBAR: Listener de click ATTACHED.");
        toggleBtn.addEventListener('click', () => {
            // Alterna la clase 'active' para mostrar/ocultar el sidebar
            sidebar.classList.toggle('active');
            
            // Lógica para cambiar el ícono (hamburguesa <-> X)
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (sidebar.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times'); // Muestra la 'X'
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars'); // Muestra la hamburguesa
                }
            }
        });
    }
}