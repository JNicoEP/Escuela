document.addEventListener('DOMContentLoaded', () => {

    
    const archivoSelector = document.getElementById("archivoSelector");
    const descargarBtn = document.getElementById("descargarBtn");
    const borrarBtn = document.getElementById("borrarBtn");
    const editarBtn = document.getElementById("editarBtn");

    const searchInput = document.getElementById('documentacionSubidaSearchInput');
    let debounceTimer;
    
    //SELECCIONA EL CURSO EN EL FORMULARIO DE PROFESORES
    const cursoSelect = document.getElementById('curso');
    if (cursoSelect) {
        cursoSelect.addEventListener('change', () => {
            cargarMateriales();
        });
    }
    //SUBIR Y EDITA EL NOMBRE DEL ARCHIVO
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const formData = new FormData(this);

            const nuevoNombreBase = prompt("Ingrese el nuevo nombre del archivo :");
            if (nuevoNombreBase) {
                const nombreArchivoOriginal = formData.get('material').name;
                const extension = nombreArchivoOriginal.split('.').pop();
                const nuevoNombre = nuevoNombreBase + '.' + extension;

                formData.set('material', formData.get('material'), nuevoNombre);

                fetch('php/subir_material.php', {
                    method: 'POST',
                    body: formData
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            cargarMateriales(data.archivos);
                            alert(data.message);
                            document.getElementById('uploadForm').reset();
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(error => {
                        console.error("Error al subir el archivo:", error);
                        alert("Error al subir el archivo.");
                    });
            } else {
                alert("Subida cancelada.");
            }
        });
    }

    const filterForm = document.querySelector('.mb-4 form');

    if (filterForm) {
        filterForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const formData = new FormData(filterForm);

            fetch('php/filtrar_documentos.php', {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    cargarMateriales(data);
                });
        });
    }

    if (archivoSelector) {
        archivoSelector.addEventListener("change", () => {
            const archivoSeleccionado = archivoSelector.value;
            if (archivoSeleccionado) {
                descargarBtn.disabled = false;
                if (borrarBtn) {
                    borrarBtn.disabled = false;
                }
                if (editarBtn) {
                    editarBtn.disabled = false;
                }
            } else {
                descargarBtn.disabled = true;
                if (borrarBtn) {
                    borrarBtn.disabled = true;
                }
                if (editarBtn) {
                    editarBtn.disabled = true;
                }
            }
        });
    }

    //Filtros para alumnos y profesores

    const filterAulaSelect = document.getElementById('filterAula');
    const filterTypeSelect = document.getElementById('filterType');
    const filterSearchInput = document.getElementById('filterSearch');

    if (filterAulaSelect && filterTypeSelect && filterSearchInput) {
        filterAulaSelect.addEventListener('change', filterFiles);
        filterTypeSelect.addEventListener('change', filterFiles);
        filterSearchInput.addEventListener('input', filterFiles);
    }

    const filterCursoSelectProfesores = document.getElementById('filterCurso');
    const filterTypeSelectProfesores = document.getElementById('filterType');
    const filterSearchInputProfesores = document.getElementById('filterSearch');

    if (filterCursoSelectProfesores && filterTypeSelectProfesores && filterSearchInputProfesores) {
        filterCursoSelectProfesores.addEventListener('change', filtrarTabla);
        filterTypeSelectProfesores.addEventListener('change', filtrarTabla);
        filterSearchInputProfesores.addEventListener('input', filtrarTabla);
    }

    //FILTRAR ARCHIVOS
    function filtrarArchivos() {
        const textoBusqueda = document.getElementById('documentacionSubidaSearchInput').value.toLowerCase();
        const filas = document.querySelectorAll('#documentacionSubidaFileList tbody tr');
        const searchInput = document.getElementById('documentacionSubidaSearchInput');

        filas.forEach(fila => {
            const nombreArchivo = fila.querySelector('td:nth-child(1)').textContent.toLowerCase();
            if (nombreArchivo.includes(textoBusqueda)) {
                fila.style.display = '';
            } else {
                fila.style.display = 'none';
            }
        });
    }

    //tabla archivos
    function filterFiles() {
        const filterAula = document.getElementById('filterAula').value;
        const filterType = document.getElementById('filterType').value.toLowerCase();
        const filterSearch = document.getElementById('filterSearch').value.toLowerCase();

        const filas = document.querySelectorAll('#documentacionSubidaFileList tbody tr');

        filas.forEach(fila => {
            const aula = fila.querySelector('td:nth-child(1)').textContent.toLowerCase();
            const tipo = fila.querySelector('td:nth-child(2)').textContent.toLowerCase();
            const nombre = fila.querySelector('td:nth-child(3)').textContent.toLowerCase();

            const aulaCoincide = filterAula === 'all' || aula.includes(filterAula.toLowerCase());
            const tipoCoincide = filterType === 'all' || tipo.includes(filterType);
            const nombreCoincide = nombre.includes(filterSearch);

            if (aulaCoincide && tipoCoincide && nombreCoincide) {
                fila.style.display = '';
            } else {
                fila.style.display = 'none';
            }
        });
    }

    //tabla profesores
    function filtrarTabla() {
        const filterCurso = document.getElementById('filterCurso').value;
        const filterTipo = document.getElementById('filterType').value.toLowerCase();
        const filterBusqueda = document.getElementById('filterSearch').value.toLowerCase();

        const filas = document.querySelectorAll('#documentacionSubidaFileList tbody tr');

        filas.forEach(fila => {
            const curso = fila.querySelector('td:nth-child(1)').textContent.toLowerCase();
            const tipo = fila.querySelector('td:nth-child(2)').textContent.toLowerCase();
            const nombre = fila.querySelector('td:nth-child(3)').textContent.toLowerCase();

            const cursoCoincide = filterCurso === 'all' || curso.includes(filterCurso.toLowerCase());
            const tipoCoincide = filterTipo === 'all' || tipo.includes(filterTipo);
            const nombreCoincide = nombre.includes(filterBusqueda);

            if (cursoCoincide && tipoCoincide && nombreCoincide) {
                fila.style.display = '';
            } else {
                fila.style.display = 'none';
            }
        });
    }

    function obtenerExtension(nombreArchivo) {
        return nombreArchivo.split('.').pop();
    }

    //cargar materiales
    function cargarMateriales(data) {
        console.log("Datos recibidos:", data);
        console.log('cargarMateriales() se está ejecutando', data);

        const fileList = document.getElementById('documentacionSubidaFileList');

        fileList.innerHTML = '';

        if (data && data.length > 0) {
            let table = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Nombre del Archivo</th>
                            <th>Tipo</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.forEach(material => {
                console.log('Procesando material:', material);

                table += `
                    <tr>
                        <td>${material.nombre_archivo}</td>
                        <td>${obtenerExtension(material.nombre_archivo).toUpperCase()}</td>
                        <td>${material.fecha_subida}</td>
                    </tr>
                `;
            });

            table += `
                        </tbody>
                    </table>
            `;

            fileList.innerHTML = table;
        } else {
            fileList.innerHTML = '<p>No se encontraron materiales para este curso.</p>';
        }

        const archivoSelector = document.getElementById("archivoSelector");
        archivoSelector.innerHTML = '<option value="">Selecciona un archivo</option>';

        if (data && Array.isArray(data)) {
            data.forEach(material => {
                const option = document.createElement("option");
                option.value = material.nombre_archivo;
                option.textContent = material.nombre_archivo;
                archivoSelector.appendChild(option);
            });
        }
    }

    function obtenerExtension(nombreArchivo) {
        return nombreArchivo.split('.').pop().toLowerCase();
    }

    const form = document.querySelector("form");
    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            fetch("php/filtrar_documentos.php", {
                method: "POST",
                body: formData
            })
                .then(response => response.json())
                .then(data => cargarMateriales(data))
                .catch(error => console.error("Error al obtener archivos:", error));
        });
    }
    //BOTON BORRAR
    if (borrarBtn) {
        borrarBtn.addEventListener("click", () => {
            const archivoSeleccionado = archivoSelector.value;
            const aulaSeleccionada = document.getElementById("filterCurso").value;
            if (archivoSeleccionado) {
                fetch("php/borrar_archivo.php", {
                    method: "POST",
                    body: JSON.stringify({
                        nombreArchivo: archivoSeleccionado,
                        aula: aulaSeleccionada
                    })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            cargarMateriales(data.archivos);
                        } else {
                            alert("Error al borrar el archivo.");
                        }
                    })
                    .catch(error => console.error("Error al borrar el archivo:", error));
            }
        });
    }
    //BOTON EDITAR
    if (editarBtn) {
        editarBtn.addEventListener("click", () => {
            const archivoSeleccionado = archivoSelector.value;
            const aulaSeleccionada = document.getElementById("filterCurso").value;
            if (archivoSeleccionado) {
                const nuevoNombreBase = prompt("Ingrese el nuevo nombre del archivo (sin extensión):");
                if (nuevoNombreBase) {
                    const extension = archivoSeleccionado.split('.').pop();
                    const nuevoNombre = nuevoNombreBase + '.' + extension;
                    fetch("php/editar_archivo.php", {
                        method: "POST",
                        body: JSON.stringify({
                            nombreArchivo: archivoSeleccionado,
                            nuevoNombre: nuevoNombre,
                            aula: aulaSeleccionada
                        })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                cargarMateriales(data.archivos);
                            } else {
                                alert("Error al editar el archivo.");
                            }
                        })
                        .catch(error => console.error("Error al editar el archivo:", error));
                }
            }
        });
    }
    //BOTON DESCARGAR
    if (descargarBtn) {
        descargarBtn.addEventListener("click", () => {
            const archivoSeleccionado = archivoSelector.value;
            const aulaSeleccionada = document.getElementById("filterCurso").value;
            if (archivoSeleccionado) {
                fetch("php/descargar.php", {
                    method: "POST",
                    body: JSON.stringify({
                        nombreArchivo: archivoSeleccionado,
                        aula: aulaSeleccionada
                    })
                })
                    .then(response => {
                        if (response.ok) {
                            return response.blob();
                        } else {
                            return response.json().then(data => {
                                throw new Error(data.message);
                            });
                        }
                    })
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const enlaceDescarga = document.createElement("a");
                        enlaceDescarga.href = url;
                        enlaceDescarga.download = archivoSeleccionado;
                        enlaceDescarga.style.display = "none";
                        document.body.appendChild(enlaceDescarga);
                        enlaceDescarga.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(enlaceDescarga);
                    })
                    .catch(error => {
                        alert("Error al descargar el archivo: " + error.message);
                    });
            }
        });
    }
});