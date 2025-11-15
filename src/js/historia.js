// src/js/historia.js

// 1. IMPORTAMOS SOLAMENTE EL MÓDULO 'Modal' DE BOOTSTRAP
import { Modal } from 'bootstrap';

// (Array de rutas estáticas - SIN CAMBIOS)
const galleryImages = [
    '/img/historia_page-0001.jpg',
    '/img/historia2_page-0001.jpg',
    '/img/historia3_page-0001.jpg',
    '/img/historia4_page-0001.jpg',
    '/img/historia5_page-0001.jpg'
];

// 2. LA FUNCIÓN EXPORTABLE
export function initHistoriaGallery() {
    
    const panels = document.querySelectorAll('.panel');
    const galleryModalEl = document.getElementById('galleryModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('galleryModalLabel');

    // 3. USAMOS 'Modal' (la variable importada)
    if (galleryModalEl) {
        
        const galleryModal = new Modal(galleryModalEl); 

        if (modalImage) {
            modalImage.addEventListener('click', () => {
                modalImage.classList.toggle('zoomed');
            });
        }
    
        let currentIndex = 0;
        let autoAdvanceTimer;
    
        function removeAllActiveClasses() {
            panels.forEach(panel => panel.classList.remove('active'));
        }
    
        function autoAdvance() {
            removeAllActiveClasses();
            currentIndex = (currentIndex + 1) % panels.length;
            if (panels[currentIndex]) {
                panels[currentIndex].classList.add('active');
            }
        }
    
        autoAdvanceTimer = setInterval(autoAdvance, 3000);
    
        panels.forEach((panel, index) => {
            
            panel.addEventListener('mouseenter', () => {
                clearInterval(autoAdvanceTimer);
                removeAllActiveClasses();
                panel.classList.add('active');
            });
    
            panel.addEventListener('mouseleave', () => {
                currentIndex = index;
                autoAdvanceTimer = setInterval(autoAdvance, 3000);
            });
    
            panel.addEventListener('click', () => {
                const imageUrl = galleryImages[index]; 
                const titleText = panel.querySelector('h3').textContent;
    
                modalImage.src = imageUrl; 
                modalTitle.textContent = titleText;
                
                galleryModal.show();
            });
        });

    }
}