// Pruebas manuales automáticas sobre la app real.
// Solo se usan durante el desarrollo; no forman parte de la aplicación.
window.addEventListener("load", function () {
    const resultados = [];
    const doc = document;

    function revisar(nombre, ok, detalle) {
        resultados.push((ok ? "OK    " : "FALLO ") + nombre + (detalle ? "  ->  " + detalle : ""));
    }

    function $(id) {
        return doc.getElementById(id);
    }

    function texto(id) {
        return $(id).textContent.trim();
    }

    function filas() {
        return doc.querySelectorAll("#listaMovimientos .movimiento").length;
    }

    function grupos() {
        return doc.querySelectorAll("#listaMovimientos .dia").length;
    }

    function filaCon(descripcion) {
        return Array.prototype.slice
            .call(doc.querySelectorAll("#listaMovimientos .movimiento"))
            .filter(function (fila) {
                const textoDesc = fila.querySelector(".movimiento__desc");
                return textoDesc && textoDesc.textContent === descripcion;
            })[0];
    }

    function enviar(formulario) {
        formulario.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }

    function registrar(tipo, descripcion, monto, categoria, fecha) {
        const radio = doc.querySelector('input[name="tipo"][value="' + tipo + '"]');
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));

        $("descripcion").value = descripcion;
        $("monto").value = monto;

        if (fecha) {
            $("fecha").value = fecha;
        }
        if (categoria) {
            $("categoria").value = categoria;
        }

        enviar($("formMovimiento"));
    }

    function buscar(textoBusqueda) {
        $("buscar").value = textoBusqueda;
        $("buscar").dispatchEvent(new Event("input", { bubbles: true }));
    }

    // ---------- Respaldo de los datos reales ----------
    const respaldo = {};
    for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        respaldo[clave] = localStorage.getItem(clave);
    }

    function restaurarRespaldo() {
        localStorage.clear();
        Object.keys(respaldo).forEach(function (clave) {
            localStorage.setItem(clave, respaldo[clave]);
        });
    }

    localStorage.clear();

    try {
        // ---------- Estado inicial ----------
        revisar("Al arrancar no se ve el botón de cancelar",
            getComputedStyle($("btnCancelarEdicion")).display === "none",
            getComputedStyle($("btnCancelarEdicion")).display);
        revisar("Al arrancar no se ve el botón de limpiar filtros",
            getComputedStyle($("limpiarFiltros")).display === "none",
            getComputedStyle($("limpiarFiltros")).display);
        revisar("Al arrancar se ve el aviso de lista vacía", !$("sinMovimientos").hidden);

        // ---------- Base ----------
        registrar("ingreso", "Sueldo", "1000", null, null);
        revisar("Ingreso de 1000 suma al balance", texto("balance").includes("1,000.00"), texto("balance"));
        revisar("La lista muestra 1 movimiento", filas() === 1, String(filas()));
        revisar("El grupo del día se llama Hoy",
            doc.querySelector(".dia__titulo").textContent.trim() === "Hoy",
            doc.querySelector(".dia__titulo").textContent.trim());

        registrar("gasto", "Supermercado", "300", "comida", null);
        revisar("Gasto de 300 baja el balance", texto("balance").includes("700.00"), texto("balance"));
        revisar("Gasto suma en su tarjeta", texto("gastos").includes("300.00"), texto("gastos"));

        registrar("gasto", "Compra imposible", "5000", "compras", null);
        revisar("Gasto mayor al balance se rechaza", filas() === 2, String(filas()));

        $("montoAhorro").value = "200";
        enviar($("formAhorro"));
        revisar("Aportar 200 baja el balance a 500", texto("balance").includes("500.00"), texto("balance"));
        revisar("Aportar 200 sube los ahorros a 200", texto("ahorros").includes("200.00"), texto("ahorros"));

        $("montoRetiro").value = "500";
        enviar($("formRetiro"));
        revisar("Retiro mayor a lo ahorrado se rechaza", texto("ahorros").includes("200.00"), texto("ahorros"));

        $("montoRetiro").value = "200";
        enviar($("formRetiro"));
        revisar("Retiro de 200 devuelve el balance a 700", texto("balance").includes("700.00"), texto("balance"));

        // ---------- Validaciones ----------
        const antes = filas();
        registrar("gasto", "", "50", "otros", null);
        registrar("gasto", "Futuro", "50", "otros", "2030-01-01");
        registrar("gasto", "Monto cero", "0", "otros", null);
        revisar("Descripción vacía, fecha futura y monto cero se rechazan", filas() === antes, String(filas()));

        // ---------- Ahorros no editables ----------
        const filaAhorro = doc.querySelector(".movimiento--ahorro");
        filaAhorro.querySelector('[data-accion="editar"]').click();
        revisar("Un movimiento de ahorro no entra en edición",
            $("btnRegistrar").textContent.trim() === "Registrar movimiento",
            $("btnRegistrar").textContent.trim());

        // ---------- Iconos por categoría ----------
        const filaSuper = filaCon("Supermercado");
        revisar("El gasto usa el icono de su categoría",
            Boolean(filaSuper.querySelector('use[href="#icono-comida"]')));

        // ---------- Tipografía del balance ----------
        const fuenteBalance = getComputedStyle($("balance")).fontSize;
        const fuenteIngresos = getComputedStyle($("ingresos")).fontSize;
        revisar("El balance usa el mismo tamaño que las demás cifras",
            fuenteBalance === fuenteIngresos, fuenteBalance + " vs " + fuenteIngresos);

        // ---------- Agrupar por día ----------
        const ayer = window.fechaLocalISO(new Date(Date.now() - 86400000));
        registrar("gasto", "Panadería", "50", "comida", ayer);
        revisar("Un gasto de ayer crea un segundo grupo", grupos() === 2, String(grupos()));
        revisar("Los grupos van de más reciente a más antiguo",
            doc.querySelectorAll(".dia__titulo")[0].textContent.trim() === "Hoy" &&
            doc.querySelectorAll(".dia__titulo")[1].textContent.trim() === "Ayer",
            doc.querySelectorAll(".dia__titulo")[0].textContent.trim() + ", " +
            doc.querySelectorAll(".dia__titulo")[1].textContent.trim());

        // ---------- Editar ----------
        filaCon("Supermercado").querySelector('[data-accion="editar"]').click();
        revisar("Editar rellena el formulario",
            $("descripcion").value === "Supermercado" &&
            $("monto").value === "300" &&
            $("btnRegistrar").textContent.trim() === "Guardar cambios",
            $("btnRegistrar").textContent.trim());

        $("btnCancelarEdicion").click();
        revisar("Cancelar deja el formulario como estaba",
            $("btnRegistrar").textContent.trim() === "Registrar movimiento" &&
            $("descripcion").value === "",
            $("btnRegistrar").textContent.trim());

        filaCon("Panadería").querySelector('[data-accion="editar"]').click();
        revisar("Editar conserva la fecha del movimiento", $("fecha").value === ayer, $("fecha").value);

        $("monto").value = "80";
        enviar($("formMovimiento"));
        revisar("Editar actualiza el monto y el balance",
            texto("balance").includes("620.00") && texto("gastos").includes("380.00"),
            texto("balance") + " / " + texto("gastos"));
        revisar("Editar no duplica movimientos", filas() === 5 && grupos() === 2,
            filas() + " filas, " + grupos() + " grupos");

        // ---------- Borrar y deshacer ----------
        filaCon("Panadería").querySelector('[data-accion="borrar"]').click();
        revisar("Borrar quita el movimiento", filas() === 4 && texto("balance").includes("700.00"),
            filas() + " filas / " + texto("balance"));

        const deshacer = doc.querySelector(".toast__accion");
        revisar("El aviso de borrado ofrece Deshacer", Boolean(deshacer));
        deshacer.click();
        revisar("Deshacer restaura el movimiento",
            filas() === 5 && texto("balance").includes("620.00"),
            filas() + " filas / " + texto("balance"));

        // ---------- Filtros ----------
        doc.querySelector('[data-filtro="ingreso"]').click();
        revisar("Filtro Ingresos deja solo ingresos", filas() === 1, String(filas()));

        doc.querySelector('[data-filtro="gasto"]').click();
        revisar("Filtro Gastos deja solo gastos", filas() === 2, String(filas()));

        doc.querySelector('[data-filtro="ahorro"]').click();
        revisar("Filtro Ahorros incluye aportes y retiros", filas() === 2, String(filas()));

        doc.querySelector('[data-filtro="todos"]').click();
        revisar("Filtro Todos vuelve a mostrar todo", filas() === 5, String(filas()));

        // ---------- Búsqueda ----------
        buscar("SUELDO");
        revisar("La búsqueda ignora mayúsculas", filas() === 1, String(filas()));

        buscar("cafe");
        revisar("La búsqueda sin resultados vacía la lista", filas() === 0, String(filas()));
        revisar("Se avisa de que no hay coincidencias", !$("sinMovimientos").hidden);
        revisar("Aparece el botón Limpiar filtros", !$("limpiarFiltros").hidden);

        $("limpiarFiltros").click();
        revisar("Limpiar filtros restaura la lista", filas() === 5 && $("buscar").value === "",
            filas() + " filas");

        // ---------- Persistencia ----------
        const guardado = JSON.parse(localStorage.getItem("finance-app-estado") || "{}");
        const movs = Array.isArray(guardado.movimientos) ? guardado.movimientos : [];
        revisar("Estado v2 guardado con 5 movimientos",
            guardado.version === 2 && movs.length === 5,
            "version=" + guardado.version + " movs=" + movs.length);

        const suma = movs.reduce(function (acc, m) {
            if (m.tipo === "ingreso") acc.ingresos += m.monto;
            if (m.tipo === "gasto") acc.gastos += m.monto;
            if (m.tipo === "ahorro") acc.ahorros += m.monto;
            if (m.tipo === "retiro") acc.ahorros -= m.monto;
            return acc;
        }, { ingresos: 0, gastos: 0, ahorros: 0 });

        revisar("Los totales guardados cuadran",
            suma.ingresos === 1000 && suma.gastos === 380 && suma.ahorros === 0,
            JSON.stringify(suma));

        // ---------- Migración ----------
        const migrado = window.migrarDesdeV1({
            balance: 500,
            ingresos: 1000,
            gastos: 300,
            ahorros: 200,
            movimientos: [{ descripcion: "Viejo", monto: 300, tipo: "gasto" }]
        });
        const t = window.calcularTotales(migrado.movimientos);
        revisar("Migración v1 conserva los totales",
            t.balance === 500 && t.ingresos === 1000 && t.gastos === 300 && t.ahorros === 200,
            JSON.stringify(t));

        // ---------- Datos corruptos ----------
        revisar("Movimiento con monto inválido se descarta",
            window.normalizarMovimiento({ tipo: "gasto", monto: "abc" }) === null);
        revisar("Movimiento con tipo inválido se descarta",
            window.normalizarMovimiento({ tipo: "regalo", monto: 10 }) === null);

        // ---------- Gráfica ----------
        const barrasSemanales = doc.querySelectorAll("#grafica rect.barra").length;
        revisar("La gráfica dibuja barras", barrasSemanales > 0, String(barrasSemanales));
        revisar("La gráfica muestra el rango semanal",
            $("rangoGrafica").textContent.indexOf("8 semanas") === 0,
            $("rangoGrafica").textContent);
        revisar("La gráfica tiene título y descripción para lectores de pantalla",
            Boolean(doc.querySelector("#grafica title")) && Boolean(doc.querySelector("#grafica desc")));

        $("btnMes").click();
        revisar("Cambiar a mensual actualiza el rango",
            $("rangoGrafica").textContent.indexOf("6 meses") === 0,
            $("rangoGrafica").textContent);
        revisar("El botón Mensual queda activo",
            $("btnMes").getAttribute("aria-pressed") === "true" &&
            $("btnSemana").getAttribute("aria-pressed") === "false");
        revisar("La gráfica mensual también dibuja barras",
            doc.querySelectorAll("#grafica rect.barra").length > 0);

        $("btnSemana").click();
        revisar("Volver a semanal mantiene las barras",
            doc.querySelectorAll("#grafica rect.barra").length === barrasSemanales);

        // ---------- Meta de ahorro ----------
        $("montoMeta").value = "1000";
        enviar($("formMeta"));
        revisar("La meta de ahorro se guarda",
            JSON.parse(localStorage.getItem("finance-app-estado")).metaAhorro === 1000);
        revisar("La meta muestra su progreso",
            $("progresoMeta").hidden === false && $("metaPorcentaje").textContent === "0%",
            $("metaPorcentaje").textContent);

        $("montoAhorro").value = "200";
        enviar($("formAhorro"));
        revisar("El progreso de la meta se actualiza",
            $("metaPorcentaje").textContent === "20%", $("metaPorcentaje").textContent);

        $("montoMeta").value = "100";
        enviar($("formMeta"));
        revisar("Al llegar a la meta se avisa",
            $("metaPie").textContent.indexOf("Meta alcanzada") !== -1, $("metaPie").textContent);

        $("montoMeta").value = "";
        enviar($("formMeta"));
        revisar("Dejar la meta vacía la elimina",
            $("progresoMeta").hidden === true && $("metaVacia").hidden === false);

        // ---------- Presupuesto ----------
        $("categoriaPresupuesto").value = "comida";
        $("limitePresupuesto").value = "1000";
        enviar($("formPresupuesto"));
        revisar("El límite aparece en la lista",
            doc.querySelectorAll("#listaPresupuesto .presupuesto__fila").length === 1,
            String(doc.querySelectorAll("#listaPresupuesto .presupuesto__fila").length));
        const mesActual = window.fechaLocalISO().slice(0, 7);
        const gastoDelMes = movs
            .filter(function (m) { return m.tipo === "gasto" && m.fecha.indexOf(mesActual) === 0; })
            .reduce(function (total, m) { return total + m.monto; }, 0);
        const numero = new Intl.NumberFormat("es-DO", {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });

        revisar("El presupuesto calcula el gasto del mes",
            $("listaPresupuesto").textContent.indexOf(
                numero.format(gastoDelMes) + " de RD$\u00A01,000.00") !== -1,
            $("listaPresupuesto").textContent.trim().slice(0, 80));
        revisar("Por debajo del 70% la barra está en verde",
            doc.querySelector("#listaPresupuesto .progreso__relleno")
                .classList.contains("progreso__relleno--bien"));

        $("limitePresupuesto").value = "400";
        enviar($("formPresupuesto"));
        revisar("Al pasar del 70% la barra pasa a ámbar",
            doc.querySelector("#listaPresupuesto .progreso__relleno")
                .classList.contains("progreso__relleno--medio"));

        $("limitePresupuesto").value = "250";
        enviar($("formPresupuesto"));
        revisar("Al pasarse, la barra está en rojo y avisa",
            doc.querySelector("#listaPresupuesto .progreso__relleno")
                .classList.contains("progreso__relleno--alto") &&
            $("listaPresupuesto").textContent.indexOf("te pasaste") !== -1,
            $("listaPresupuesto").textContent.trim().slice(0, 90));

        doc.querySelector('#listaPresupuesto [data-accion="borrar"]').click();
        revisar("Quitar el límite deja la lista vacía",
            doc.querySelectorAll("#listaPresupuesto .presupuesto__fila").length === 0 &&
            $("presupuestoVacio").hidden === false);

        // ---------- Accesibilidad ----------
        revisar("El resumen anuncia los cambios a lectores de pantalla",
            ["balance", "ingresos", "gastos", "ahorros"].every(function (id) {
                return $(id).getAttribute("aria-live") === "polite";
            }));

        let reglaFoco = null;
        let cssLegible = true;

        try {
            reglaFoco = Array.prototype.slice.call(doc.styleSheets)
                .reduce(function (encontradas, hoja) {
                    return encontradas.concat(Array.prototype.slice.call(hoja.cssRules || []));
                }, [])
                .filter(function (regla) {
                    return regla.selectorText && regla.selectorText.indexOf(":focus-visible") !== -1;
                })[0];
        } catch (error) {
            // En file:// Firefox no deja leer cssRules; se comprueban los tokens.
            cssLegible = false;
        }

        const raiz = getComputedStyle(doc.documentElement);
        const anchoFoco = raiz.getPropertyValue("--foco-ancho").trim();
        const estiloFoco = raiz.getPropertyValue("--foco-estilo").trim();
        const salidaFoco = reglaFoco ? (reglaFoco.style.outline || "") : "";

        revisar("El foco del teclado se ve",
            cssLegible
                ? Boolean(reglaFoco) && salidaFoco.indexOf("--foco-ancho") !== -1 &&
                    salidaFoco.indexOf("--foco-estilo") !== -1
                : anchoFoco === "2px" && estiloFoco === "solid",
            cssLegible
                ? (salidaFoco || "sin regla :focus-visible")
                : "tokens: " + anchoFoco + " " + estiloFoco);

        const enfocables = Array.prototype.slice.call(doc.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])'
        ));
        revisar("No hay controles con orden de tabulación alterado",
            enfocables.every(function (nodo) { return !(Number(nodo.getAttribute("tabindex")) > 0); }));


    } catch (error) {
        revisar("La batería terminó sin errores", false, error.message);
    } finally {
        restaurarRespaldo();
        revisar("Datos reales restaurados", true);

        const pre = doc.createElement("pre");
        pre.style.cssText = "position:fixed;inset:0;z-index:99999;margin:0;padding:24px;" +
            "background:#0b1220;color:#e6edf6;font:14px/1.6 monospace;overflow:auto;white-space:pre-wrap";
        pre.textContent = resultados.join("\n");
        doc.body.appendChild(pre);
    }
});
