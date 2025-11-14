/* ----------------------------------
   Lógica para Panel de Padres
   (panel-padres.js - Módulo ESM)
---------------------------------- */
'use strict';


// Esta ruta asume que 'panel-padres.js' está en la raíz del proyecto (junto a index.html)
// y 'supabaseClient.js' está en 'src/js/'.
// En src/js/panel-padres.js
import { supabase, showMessage } from './supabaseClient.js';
// La sintaxis './' indica "empezar en esta misma carpeta".


const datosEstudiante = {
    matricula: "2024-001",
    nombre: "Juan Carlos Pérez García",
    grado: "10mo",
    seccion: "A",
    avatarLetter: "J",
    stats: {
        hijos: 1,
        mensajes: 2,
        tareas: 1,
        progreso: "Excelente"
    },
    resumen: {
        promedio: 20.0,
        alertaPromedio: "Necesita Mejorar",
        asistencia: "100%",
        asistenciaLabel: "1 de 1 días",
        cursos: 5
    },
    alertas: [
        { icono: "fa-triangle-exclamation", texto: "<strong>Promedio bajo</strong> en Matemáticas. Se recomienda agendar una reunión con el profesor." }
    ],
    asistencias: {
        total: "100%",
        presente: 1,
        ausente: 0,
        tardanza: 0,
        justificado: 0,
        detallado: [
            { materia: "Matemáticas", fecha: "2025-11-06", estado: "presente" },
            { materia: "Historia", fecha: "2025-11-06", estado: "presente" },
            { materia: "Literatura", fecha: "2025-11-05", estado: "presente" },
        ]
    },
    tareas: {
        pendientes: 1,
        enProgreso: 0,
        entregadas: 5,
        proximas: [
            { materia: "Historia", titulo: "Ensayo: Revolución Francesa", fecha: "2025-11-15", puntos: 25 },
            { materia: "Matemáticas", titulo: "Guía de Ejercicios: Trigonometría", fecha: "2025-11-10", puntos: 15 },
        ]
    },
    cursos: [
        { materia: "Matemáticas", profesor: "Prof. R. Gonzales", horario: "L-M-V / 8:00-9:30", aula: "A-101", creditos: 5, icon: "fa-calculator" },
        { materia: "Historia", profesor: "Prof. L. Campos", horario: "Ma-J / 10:00-11:30", aula: "B-203", creditos: 4, icon: "fa-landmark" },
        { materia: "Literatura", profesor: "Prof. A. Méndez", horario: "L-M-V / 9:30-10:30", aula: "A-102", creditos: 4, icon: "fa-book-open" },
        { materia: "Biología", profesor: "Prof. C. Salas", horario: "Ma-J / 8:00-9:30", aula: "C-105 (Lab)", creditos: 5, icon: "fa-dna" },
    ],
    mensajesRecibidos: [
        { remitente: "Prof. R. Gonzales", extracto: "Recordatorio: Examen de Matemáticas la próxima semana...", tag: "Nuevo" },
        { remitente: "Administración", extracto: "Pago de matrícula pendiente. Favor de regularizar...", tag: "Urgente" },
        { remitente: "Prof. L. Campos", extracto: "Sobre el desempeño de Juan en Historia...", tag: "" },
    ],
    mensajesEnviados: [
        { destinatario: "Prof. R. Gonzales", extracto: "Gracias por el aviso, profesor. ¿Habrá guía de estudio?", estado: "Leído" },
        { destinatario: "Administración", extracto: "Buen día, realicé el pago esta mañana. Adjunto comprobante...", estado: "Enviado" },
    ]
};

// --- Referencias al DOM ---
const selectorView = document.getElementById('selector-view');
const dashboardContent = document.getElementById('dashboard-content');
const nombreInput = document.getElementById('nombre-input'); // CAMBIO: de matriculaInput a nombreInput
const buscarBtn = document.getElementById('buscar-btn');
const errorMensaje = document.getElementById('error-mensaje');
const nuevoMensajeBtn = document.getElementById('nuevo-mensaje-btn');
const searchResultsList = document.getElementById('search-results-list');
let nuevoMensajeModal;

/**
 * Función Debounce
 * Evita que se llame a la API en cada tecla, espera 300ms
 */
function debounce(func, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Función principal que se ejecuta al cargar el DOM.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // Validar que todos los elementos existan
    if (!selectorView || !dashboardContent || !nombreInput || !buscarBtn || !errorMensaje || !nuevoMensajeBtn || !searchResultsList) { // <-- NUEVO
        console.error("Error: Faltan elementos clave en el HTML.");
        return;
    }

    // Inicializar el Modal de Bootstrap (para controlarlo con JS)
    const modalEl = document.getElementById('nuevoMensajeModal');
    if (modalEl) {
        nuevoMensajeModal = new bootstrap.Modal(modalEl);
    }

    // --- Event Listeners ---
    
    // 1. Botón de Búsqueda
    buscarBtn.addEventListener('click', handleBusqueda);
    
    // 2. Botón de Nuevo Mensaje
    nuevoMensajeBtn.addEventListener('click', () => {
        if (nuevoMensajeModal) {
            nuevoMensajeModal.show();
        }
    });

    // Permitir buscar con "Enter"
    nombreInput.addEventListener('keypress', (e) => { // CAMBIO: de matriculaInput a nombreInput
        if (e.key === 'Enter') {
            handleBusqueda();
        }
    }); 
    // Event listener para la búsqueda en vivo
    nombreInput.addEventListener('input', debounce(handleLiveSearch, 300));

    // Ocultar resultados si se hace clic fuera
    document.addEventListener('click', (e) => {
        if (!selectorView.contains(e.target)) { // Si el clic es FUERA del selector
            searchResultsList.innerHTML = ''; // Limpiar y ocultar
        }
    });

}); 

/**
 *  Renderiza los resultados de la búsqueda en vivo.
 * @param {Array} users - El array de usuarios (alumnos) encontrados.
 */
function renderSearchResults(users) {
    searchResultsList.innerHTML = ''; // Limpiar resultados anteriores

    if (users.length === 0) {
        searchResultsList.innerHTML = '<span class="list-group-item text-muted">No se encontraron alumnos.</span>';
        return;
    }

    users.forEach(user => {
        const fullName = `${user.nombre} ${user.apellido}`;
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.textContent = fullName;
        
        // Event listener para autocompletar el input al hacer clic
        item.addEventListener('click', (e) => {
            e.preventDefault();
            nombreInput.value = fullName; // Poner el nombre completo en el input
            searchResultsList.innerHTML = ''; // Limpiar y ocultar la lista
        });

        searchResultsList.appendChild(item);
    });
}

/**
 * Maneja la lógica de búsqueda del estudiante por nombre.
 */
function handleBusqueda() {
    const nombreIngresado = nombreInput.value.trim().toLowerCase(); // CAMBIO: Obtener nombre
    const nombreEstudiante = datosEstudiante.nombre.trim().toLowerCase(); // CAMBIO: Nombre base de comparación
    
    // Simulación de búsqueda (comparación flexible)
    if (nombreIngresado === nombreEstudiante) {
        // Éxito
        errorMensaje.style.display = 'none';
        selectorView.style.display = 'none';
        dashboardContent.style.display = 'block';
        
        // Cargar todos los datos en el panel
        cargarDatosDashboard(datosEstudiante);

    } else {
        // Error
        errorMensaje.textContent = 'Nombre de alumno no encontrado. Verifique e intente de nuevo.'; // CAMBIO: Mensaje de error
        errorMensaje.style.display = 'block';
    }
}

/**
 * Rellena todos los elementos estáticos del dashboard.
 * @param {object} datos - El objeto datosEstudiante.
 */
function cargarDatosDashboard(datos) {
    try {
        // Pestaña INICIO
        document.getElementById('stat-hijos').textContent = datos.stats.hijos;
        document.getElementById('stat-mensajes').textContent = datos.stats.mensajes;
        document.getElementById('stat-tareas').textContent = datos.stats.tareas;
        document.getElementById('stat-progreso').textContent = datos.stats.progreso;

        document.getElementById('nav-mensajes-badge').textContent = datos.stats.mensajes;

        document.getElementById('student-avatar-letter').textContent = datos.avatarLetter;
        document.getElementById('student-name').textContent = datos.nombre;
        document.getElementById('student-grado-seccion').textContent = `${datos.grado} - Sección ${datos.seccion}`;
        document.getElementById('student-matricula').textContent = `Matrícula: ${datos.matricula}`;
        
        document.getElementById('summary-promedio').textContent = datos.resumen.promedio;
        if(datos.resumen.alertaPromedio) {
            const alertaProm = document.getElementById('summary-promedio-alerta');
            alertaProm.textContent = datos.resumen.alertaPromedio;
            alertaProm.style.display = 'inline-block';
        }
        document.getElementById('summary-asistencia').textContent = datos.resumen.asistencia;
        document.getElementById('summary-asistencia-label').textContent = datos.resumen.asistenciaLabel;
        document.getElementById('summary-cursos').textContent = datos.resumen.cursos;

        // Renderizar listas dinámicas
        renderAlertas(datos.alertas);
        renderAsistencia(datos.asistencias);
        renderTareas(datos.tareas);
        renderHorario(datos.cursos);
        renderMensajes(datos.mensajesRecibidos, datos.mensajesEnviados);

    } catch (e) {
        console.error("Error al cargar datos en el dashboard:", e);
        alert("Ocurrió un error al cargar la información del estudiante.");
    }
}

/**
 * Renderiza la lista de alertas recientes.
 */
function renderAlertas(alertas) {
    const lista = document.getElementById('alertas-recientes-lista');
    if (!lista) return;
    
    if (alertas.length === 0) {
        lista.innerHTML = '<p class="text-muted">No hay alertas recientes.</p>';
        return;
    }

    lista.innerHTML = alertas.map(alerta => `
        <div class="alerta-item">
            <i class="fas ${alerta.icono} alerta-icon"></i>
            <div class="text-muted">${alerta.texto}</div>
        </div>
    `).join('');
}

/**
 * Renderiza la pestaña de Asistencia.
 */
function renderAsistencia(asistencia) {
    document.getElementById('asistencia-presente').textContent = asistencia.presente;
    document.getElementById('asistencia-ausente').textContent = asistencia.ausente;
    document.getElementById('asistencia-tardanza').textContent = asistencia.tardanza;
    document.getElementById('asistencia-justificado').textContent = asistencia.justificado;
    document.getElementById('asistencia-total-porcentaje').textContent = asistencia.total;

    const lista = document.getElementById('asistencia-detallada-lista');
    if (!lista) return;

    // Helper para obtener clase de badge
    const getBadgeClass = (estado) => {
        switch (estado) {
            case 'presente': return 'bg-success-subtle text-success-emphasis';
            case 'ausente': return 'bg-danger-subtle text-danger-emphasis';
            case 'tardanza': return 'bg-warning-subtle text-warning-emphasis';
            default: return 'bg-secondary-subtle';
        }
    };

    lista.innerHTML = asistencia.detallado.map(item => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <div class="fw-medium">${item.materia}</div>
                <small class="text-muted">${item.fecha}</small>
            </div>
            <span class="badge ${getBadgeClass(item.estado)} rounded-pill text-capitalize">${item.estado}</span>
        </li>
    `).join('');
}

/**
 * Renderiza la pestaña de Tareas.
 */
function renderTareas(tareas) {
    document.getElementById('tareas-pendientes').textContent = tareas.pendientes;
    document.getElementById('tareas-progreso').textContent = tareas.enProgreso;
    document.getElementById('tareas-entregadas').textContent = tareas.entregadas;

    const lista = document.getElementById('tareas-proximas-lista');
    if (!lista) return;
    
    if (tareas.proximas.length === 0) {
        lista.innerHTML = '<p class="text-muted text-center">No hay tareas próximas.</p>';
        return;
    }

    lista.innerHTML = tareas.proximas.map(tarea => `
        <div class="tarea-item-card">
            <div>
                <div class="materia">${tarea.materia}</div>
                <div class="titulo">${tarea.titulo}</div>
                <div class="fecha"><i class="fas fa-calendar-alt me-2"></i>Entrega: ${tarea.fecha}</div>
            </div>
            <div class="text-end">
                <span class="puntos">${tarea.puntos}</span>
                <small class="d-block text-muted">Puntos</small>
            </div>
        </div>
    `).join('');
}

/**
 * Renderiza la pestaña de Horario.
 */
function renderHorario(cursos) {
    const grid = document.getElementById('horario-grid-container');
    if (!grid) return;

    if (cursos.length === 0) {
        grid.innerHTML = '<p class="text-muted">No hay cursos asignados.</p>';
        return;
    }

    grid.innerHTML = cursos.map(curso => `
        <div class="col-md-6 col-lg-4">
            <div class="horario-card h-100">
                <div class="horario-card-header">
                    <div class="horario-card-icon">
                        <i class="fas ${curso.icon || 'fa-book'}"></i>
                    </div>
                    <div>
                        <p class="materia">${curso.materia}</p>
                        <p class="profesor">${curso.profesor}</p>
                    </div>
                </div>
                <div class="d-flex flex-column gap-2">
                    <div class="info-item"><i class="fas fa-clock"></i> ${curso.horario}</div>
                    <div class="info-item"><i class="fas fa-map-marker-alt"></i> ${curso.aula}</div>
                    <div class="info-item"><i class="fas fa-star"></i> ${curso.creditos} Créditos</div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Renderiza la pestaña de Mensajes.
 */
function renderMensajes(recibidos, enviados) {
    const listaRecibidos = document.getElementById('mensajes-recibidos-lista');
    const listaEnviados = document.getElementById('mensajes-enviados-lista');
    if (!listaRecibidos || !listaEnviados) return;

    // Helper para tags
    const getTagHtml = (tag) => {
        if (!tag) return '';
        const tagClass = tag === 'Nuevo' ? 'mensaje-tag-nuevo' : 'mensaje-tag-urgente';
        return `<span class="badge rounded-pill mensaje-tag ${tagClass}">${tag}</span>`;
    };

    // Renderizar Recibidos
    if (recibidos.length === 0) {
        listaRecibidos.innerHTML = '<div class="list-group-item text-muted">Bandeja de entrada vacía.</div>';
    } else {
        listaRecibidos.innerHTML = recibidos.map(msg => `
            <a href="#" class="list-group-item list-group-item-action mensaje-item">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 remitente">${msg.remitente}</h6>
                    ${getTagHtml(msg.tag)}
                </div>
                <p class="mb-1 extracto">${msg.extracto}</p>
            </a>
        `).join('');
    }

    // Renderizar Enviados
    if (enviados.length === 0) {
        listaEnviados.innerHTML = '<div class="list-group-item text-muted">No has enviado mensajes.</div>';
    } else {
        listaEnviados.innerHTML = enviados.map(msg => `
            <div class="list-group-item mensaje-item">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 remitente">Para: ${msg.destinatario}</h6>
                    <small class="text-muted">${msg.estado}</small>
                </div>
                <p class="mb-1 extracto">${msg.extracto}</p>
            </div>
        `).join('');
    }
}