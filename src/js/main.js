// PASO 1: Importar el HTML como texto plano (¡La forma Vite!)
// Usamos rutas relativas (..) para "subir" de /js a /src
import navbarHtml from '../components/navbar/navbar.html?raw';
import modalsHtml from '../components/modal/modals.html?raw';

/**
 * Función para cargar la barra de navegación
 */
function loadNavbar() {
    try {
        const navbarContainer = document.getElementById('navbar-container');
        if (navbarContainer) {
            navbarContainer.innerHTML = navbarHtml;
        } else {
            console.error('No se encontró el contenedor del navbar (#navbar-container).');
        }
    } catch (error) {
        console.error('Error al INYECTAR el navbar:', error);
    }
}

/**
 * Función para cargar los modals
 */
function loadModals() {
    try {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = modalsHtml;

        const modals = tempContainer.querySelectorAll('.modal');
        modals.forEach(modal => {
            document.body.appendChild(modal);
        });
        console.log('Modals inyectados (desde import ?raw).');
    } catch (error) {
        console.error('Error al INYECTAR los modals:', error);
    }
}

/**
 * Función para ocultar la pantalla de carga
 */
function hideLoader() {
    const loaderContainer = document.getElementById('loader-container');
    if (loaderContainer) {
        loaderContainer.style.display = 'none';
    }
}
/**
 * Función principal que arranca la aplicación
 */
async function bootstrapApp() {

    // PASO 1: Inyectar el esqueleto HTML.
    loadNavbar();
    loadModals();

    // PASO 2: Iniciar la carga de scripts DE FORMA ASÍNCRONA
    const loadScripts = async () => {
        try {
            console.log("Intentando cargar modal.js...");
            await import('./modal.js');
            console.log("OK: modal.js cargado.");

            /*console.log("Intentando cargar auth.js...");
            await import('./auth.js'); // <-- AÑADE ESTA LÍNEA
            console.log("OK: auth.js cargado.");*/
        } catch (error) {
            console.error('Error al cargar los scripts de la página:', error);
        }
    };

    // PASO 3: Crear una promesa de tiempo mínimo (1000ms = 1 segundo)
    // Esto debe coincidir con la duración de tu animación CSS
    const minimumDisplayTime = new Promise(resolve => setTimeout(resolve, 1000));

    // PASO 4: Esperar a que AMBAS promesas se cumplan
    // La app carga Y el temporizador de 1s termina.
    await Promise.all([
        loadScripts(),
        minimumDisplayTime
    ]);

    // PASO 5: Ocultar el loader
    // Esto ahora solo se ejecuta DESPUÉS de 1 segundo Y cuando la app está lista.
    hideLoader();
}

// Iniciar todo
bootstrapApp();