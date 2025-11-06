document.addEventListener('DOMContentLoaded', function () {

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

    // 3. Carga del header
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        fetch('header.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error('No se pudo cargar el header.');
                }
                return response.text();
            })
            .then(data => {
                headerContainer.innerHTML = data;
            })
            .catch(error => {
                console.error('Error al cargar el header:', error);
            });
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
    
});

// Pantalla de carga
document.addEventListener('DOMContentLoaded', function() {
    const loaderContainer = document.getElementById('loader-container');
    if (loaderContainer) {
      setTimeout(function() {
        loaderContainer.style.display = 'none';
      }, 1250);
    } else {
      console.error('El elemento loader-container no se encontró.');
    }
  });