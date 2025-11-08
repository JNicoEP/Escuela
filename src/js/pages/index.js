// ¡YA NO HAY 'DOMContentLoaded'!
// El código se ejecuta en cuanto main.js lo importa.

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.createElement('div');
    notificacion.classList.add('notificacion', tipo);
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    // Ocultar la notificación después de 3 segundos
    setTimeout(() => {
        notificacion.remove();
    }, 3000);
}

// Función para mostrar mensaje de bienvenida
function mostrarMensajeBienvenida(nombre, rol) {
    mostrarNotificacion(`Bienvenido al sistema panel ${rol}, ${nombre}!`, 'success');
}



// 4. Filtrado de archivos
window.filtrarArchivos = function () {
    let input = document.getElementById("searchInput").value.toLowerCase();
    let rows = document.getElementById("tablaArchivos").getElementsByTagName("tr");
    let resultadosEncontrados = false;

    for (let i = 0; i < rows.length; i++) {
        let archivo = rows[i].getElementsByTagName("td")[0].textContent.toLowerCase();
        if (archivo.includes(input)) {
            rows[i].style.display = "";
            resultadosEncontrados = true;
        } else {
            rows[i].style.display = "none";
        }
    }

    // Mostrar mensaje si no hay resultados
    let mensajeNoResultados = document.getElementById("mensajeNoResultados");
    if (!resultadosEncontrados) {
        if (!mensajeNoResultados) {
            let nuevaFila = document.createElement("tr");
            nuevaFila.id = "mensajeNoResultados";
            nuevaFila.innerHTML = `<td colspan="4" class="text-center">No se encontraron resultados.</td>`;
            document.getElementById("tablaArchivos").appendChild(nuevaFila);
        }
    } else {
        if (mensajeNoResultados) {
            mensajeNoResultados.remove();
        }
    }
};

// 7. Efecto pop-up del sidebar
const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggleBtn");

if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("active");
    });
}