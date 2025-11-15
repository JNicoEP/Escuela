// src/js/historia.js

// 1. IMPORTAMOS EL JAVASCRIPT DE BOOTSTRAP
import * as bootstrap from 'bootstrap';

// 2. IMPORTAMOS LAS IMÁGENES (LA FORMA VITE)
// (La ruta '../css/img/' es correcta porque subimos de 'js' a 'src' y bajamos a 'css/img')
import imgHist1 from '../css/img/historia_page-0001.jpg';
import imgHist2 from '../css/img/historia2_page-0001.jpg';
import imgHist3 from '../css/img/historia3_page-0001.jpg';
import imgHist4 from '../css/img/historia4_page-0001.jpg';
import imgHist5 from '../css/img/historia5_page-0001.jpg';

// 3. CREAR UN ARRAY CON LAS RUTAS PROCESADAS
const galleryImages = [imgHist1, imgHist2, imgHist3, imgHist4, imgHist5];


// 4. TU CÓDIGO DE GALERÍA ORIGINAL
const panels = document.querySelectorAll('.panel');
const galleryModalEl = document.getElementById('galleryModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('galleryModalLabel');

// Verificamos que el modal exista antes de crearlo
if (galleryModalEl) {
    const galleryModal = new bootstrap.Modal(galleryModalEl);

    if (modalImage) {
        modalImage.addEventListener('click', () => {
            modalImage.classList.toggle('zoomed');
        });
    }

    let currentIndex = 0;
    let autoAdvanceTimer;

    function removeAllActiveClasses() {
        panels.forEach(panel => {
            panel.classList.remove('active');
        });
    }

    function autoAdvance() {
        removeAllActiveClasses();
        currentIndex = (currentIndex + 1) % panels.length;
        if (panels[currentIndex]) {
             panels[currentIndex].classList.add('active');
        }
    }

    autoAdvanceTimer = setInterval(autoAdvance, 3000);

    panels.forEach((panel, index) => { // <--- 'index' es la clave
        
        panel.addEventListener('mouseenter', () => {
            clearInterval(autoAdvanceTimer);
            removeAllActiveClasses();
            panel.classList.add('active');
        });

        panel.addEventListener('mouseleave', () => {
            currentIndex = index;
            autoAdvanceTimer = setInterval(autoAdvance, 3000);
        });

        // C. AL HACER CLIC (CÓDIGO CORREGIDO)
        panel.addEventListener('click', () => {
            
            // ✅ OBTENER DATOS (ESTA ES LA PARTE CORREGIDA)
            // Usamos el 'index' del loop para encontrar la imagen en nuestro array
            const imageUrl = galleryImages[index]; 
            const titleText = panel.querySelector('h3').textContent;

            // Poner datos en el modal
            modalImage.src = imageUrl; // <-- Ahora 'imageUrl' es la ruta final procesada por Vite
            modalTitle.textContent = titleText;
            
            galleryModal.show();
        });
    });
}