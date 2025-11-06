// src/js/main.js

/**
 * Función para cargar los modals
 * Usa async/await para que podamos esperar a que termine.
 */
async function loadModals() {
    const modalsPath = '/src/components/modal/modals.html';
    try {
        const response = await fetch(modalsPath);
        if (!response.ok) {
            throw new Error('No se pudo cargar el archivo de modals.');
        }
        const html = await response.text();
        
        // Crear un contenedor temporal para manipular el DOM
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = html;

        // Extraer la barra de navegación
        const navbar = tempContainer.querySelector('nav');
        const navbarContainer = document.getElementById('navbar-container');
        
        if (navbar && navbarContainer) {
            navbarContainer.appendChild(navbar);
        } else {
            console.error('No se encontró la barra de navegación o el contenedor.');
        }

        // Extraer y adjuntar los modales directamente al body
        const modals = tempContainer.querySelectorAll('.modal');
        modals.forEach(modal => {
            document.body.appendChild(modal);
        });
        console.log('Modals cargados e inyectados.');

    } catch (error) {
        console.error('Error al cargar los modals:', error);
    }
}

/**
 * Función principal que arranca la aplicación
 */
async function bootstrapApp() {
    
    // 1. Cargamos los modals y ESPERAMOS a que estén listos
    await loadModals();

    // 2. AHORA que los modals ESTÁN en el DOM, importamos los scripts
    //    que los necesitan (como login.js e index.js)
    try {
        // Importamos el script de login (que ahora sí encontrará los modals)
        await import('/src/js/login.js');
        
        // Importamos el script de la página de inicio
        await import('/src/js/pages/index.js');

    } catch (error) {
        console.error('Error al cargar los scripts de la página:', error);
    }
}

// 3. Iniciar todo
bootstrapApp();