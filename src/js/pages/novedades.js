'use strict';

// 1. Importas la conexión a la Base de Datos (Configuración)
import { supabase } from '../config/supabaseClient.js';



async function cargarNovedadesPublicas() {
    const contenedor = document.getElementById('contenedor-noticias-escolares');
    if (!contenedor) return;

    const { data: noticias, error } = await supabase
        .from('novedades')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) {
        contenedor.innerHTML = '<p class="text-center text-danger">Error al cargar noticias.</p>';
        return;
    }

    if (noticias.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-muted">No hay noticias recientes.</p>';
        return;
    }

    // Generar el HTML de las tarjetas
    contenedor.innerHTML = noticias.map(nota => {
        // Si hay imagen usa la URL, si no, usa una imagen por defecto de la escuela
        const imagen = nota.imagen_url || '/img/logo-escuela.png'; 
        
        return `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100 shadow-sm border-0" style="border-radius: 16px; overflow: hidden;">
                <div style="height: 200px; overflow: hidden;">
                    <img src="${imagen}" class="card-img-top" alt="${nota.titulo}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="card-body">
                    <small class="text-muted fw-bold"><i class="far fa-calendar-alt me-1"></i> ${nota.fecha}</small>
                    <h5 class="card-title mt-2 fw-bold text-primary">${nota.titulo}</h5>
                    <p class="card-text text-secondary">${nota.descripcion}</p>
                </div>
            </div>
        </div>
        `;
    }).join('');
}


// ---------------------------------------------------------
// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', cargarNovedadesPublicas);