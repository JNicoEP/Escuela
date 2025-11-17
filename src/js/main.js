// main.js

// ==========================================================
// 1. IMPORTAR CSS Y JS DE BOOTSTRAP
// ==========================================================

// Importa Bootstrap CSS 
import 'bootstrap/dist/css/bootstrap.min.css';

// (Esto activa carruseles, modals, dropdowns, etc.)
//import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { Dropdown } from 'bootstrap';
// ==========================================================
// 2. IMPORTAR TUS ESTILOS
// ==========================================================

// Importa estilos 
import '../css/style.css';
import '../css/modal/modal.css';


// ==========================================================
// 3. IMPORTAR COMPONENTES HTML 
// ==========================================================
// // Importar el HTML como texto plano (¡La forma Vite!)
// Usamos rutas relativas (..) para "subir" de /js a /src
import navbarHtml from '../components/navbar/navbar.html?raw';
import modalsHtml from '../components/modal/modals.html?raw';
import footerHtml from '../components/footer/footer.html?raw';
import { setupSidebarToggle } from './sidebarToggle.js';
import { initHistoriaGallery } from './historia.js';


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
function loadFooter() {
    try {
        const footerContainer = document.getElementById('footer-container');
        if (footerContainer) {
            footerContainer.innerHTML = footerHtml;
        } else {
            console.error('No se encontró el contenedor del footer (#footer-container).');
        }
    } catch (error) {
        console.error('Error al INYECTAR el footer:', error);
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

    //  Inyectar el esqueleto HTML.
    loadNavbar();
    loadModals();
    loadFooter();
    // INICIALIZA EL NAVBAR MANUALMENTE
    const dropdownElementList = document.querySelectorAll('.dropdown-toggle');
    [...dropdownElementList].map(dropdownToggleEl => new Dropdown(dropdownToggleEl));

    // Lógica del Sidebar (condicional)
    if (document.getElementById('sidebar_proyecto')) {
        setupSidebarToggle();
    }

    //  Iniciar la carga de scripts DE FORMA ASÍNCRONA
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
    //  Crear una promesa de tiempo mínimo (1000ms = 1 segundo)
    // Esto debe coincidir con la duración de tu animación CSS
    const minimumDisplayTime = new Promise(resolve => setTimeout(resolve, 1000));

    //  Esperar a que AMBAS promesas se cumplan
    // La app carga Y el temporizador de 1s termina.
    await Promise.all([
        loadScripts(),
        minimumDisplayTime
    ]);
    // En este punto, estamos seguros de que main.js ha cargado todo.
    if (document.querySelector('.expanding-gallery-container')) {
        initHistoriaGallery();
    }
    //  Ocultar el loader
    // Esto ahora solo se ejecuta DESPUÉS de 1 segundo Y cuando la app está lista.
    hideLoader();
}
// Iniciar todo SÓLO cuando el DOM esté listo
// Esto asegura que 'bootstrap.bundle.min.js' haya tenido tiempo de cargarse
// y 'window.bootstrap' exista ANTES de que llamemos a bootstrapApp().
document.addEventListener('DOMContentLoaded', bootstrapApp);