// =====================================================
//  FINOVA — Lógica
//
//  Flujo de cada acción:
//  1. Leer los datos del formulario
//  2. Validarlos
//  3. Cambiar los movimientos
//  4. Guardar en el navegador
//  5. Volver a pintar la pantalla
// =====================================================

// ---------- 1. Constantes ----------
const CLAVE_ESTADO = "finance-app-estado";
const CLAVE_RESPALDO = "finance-app-estado-v1-backup";
const CLAVE_TEMA = "finance-app-tema";
const CLAVE_ANTES_IMPORTAR = "finance-app-estado-antes-importar";

const VERSION_ESTADO = 2;
const SALDO_INICIAL = 0;
const LIMITE_DESCRIPCION = 60;
const MAXIMO_MONTO = 999999999.99;

const TIPOS = ["gasto", "ingreso", "ahorro", "retiro"];

const CATEGORIAS = {
    gasto: {
        comida: "Comida",
        transporte: "Transporte",
        vivienda: "Vivienda",
        servicios: "Servicios",
        salud: "Salud",
        ocio: "Ocio",
        compras: "Compras",
        otros: "Otros"
    },
    ingreso: {
        salario: "Salario",
        extra: "Extra",
        otros: "Otros"
    }
};

const ICONO_POR_CATEGORIA = {
    comida: "comida",
    transporte: "transporte",
    vivienda: "vivienda",
    servicios: "servicios",
    salud: "salud",
    ocio: "ocio",
    compras: "compras",
    otros: "otros"
};

// ---------- 2. Utilidades ----------
const formatoNumero = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const formatoDiaLargo = new Intl.DateTimeFormat("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long"
});

const formatoDiaConAnio = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric"
});

function formatearMoneda(monto) {
    // Espacio duro: evita que "RD$" quede en una línea y la cifra en otra
    return "RD$\u00A0" + formatoNumero.format(monto);
}

function redondear(monto) {
    return Math.round(monto * 100) / 100;
}

function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// Fecha en formato YYYY-MM-DD usando la hora local (no UTC)
function fechaLocalISO(fecha) {
    const base = fecha || new Date();
    const desfase = base.getTimezoneOffset() * 60000;
    return new Date(base.getTime() - desfase).toISOString().slice(0, 10);
}

function fechaHoyISO() {
    return fechaLocalISO();
}

function esFechaISO(texto) {
    if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return false;
    }
    const [anio, mes, dia] = texto.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    return fecha.getFullYear() === anio &&
           fecha.getMonth() === mes - 1 &&
           fecha.getDate() === dia;
}

// "Hoy", "Ayer" o el nombre del día
function etiquetaDia(texto) {
    if (texto === fechaHoyISO()) {
        return "Hoy";
    }

    const ayer = fechaLocalISO(new Date(Date.now() - 86400000));
    if (texto === ayer) {
        return "Ayer";
    }

    const [anio, mes, dia] = texto.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const esteAnio = fecha.getFullYear() === new Date().getFullYear();

    return esteAnio
        ? formatoDiaLargo.format(fecha)
        : formatoDiaConAnio.format(fecha);
}

// Quita acentos y mayúsculas para comparar textos
function normalizarTexto(texto) {
    return String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function nombreCategoria(categoria) {
    if (!categoria) {
        return "Sin categoría";
    }
    for (const grupo of Object.values(CATEGORIAS)) {
        if (grupo[categoria]) {
            return grupo[categoria];
        }
    }
    return "Otros";
}

function etiquetaMovimiento(movimiento) {
    if (movimiento.tipo === "ahorro") {
        return "Ahorro";
    }
    if (movimiento.tipo === "retiro") {
        return "Retiro de ahorros";
    }
    return nombreCategoria(movimiento.categoria);
}

function iconoDeMovimiento(movimiento) {
    if (movimiento.tipo === "ahorro" || movimiento.tipo === "retiro") {
        return "ahorro";
    }
    if (movimiento.tipo === "ingreso") {
        return "ingreso";
    }
    return ICONO_POR_CATEGORIA[movimiento.categoria] || "otros";
}

function pasaFiltro(movimiento) {
    if (filtroActual === "todos") {
        return true;
    }
    if (filtroActual === "ahorro") {
        return movimiento.tipo === "ahorro" || movimiento.tipo === "retiro";
    }
    return movimiento.tipo === filtroActual;
}

function pasaBusqueda(movimiento) {
    if (!textoBusqueda) {
        return true;
    }

    const texto = normalizarTexto([
        movimiento.descripcion,
        etiquetaMovimiento(movimiento),
        movimiento.tipo
    ].join(" "));

    return texto.includes(textoBusqueda);
}

function crearIcono(nombre, clase) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", clase || "icono");
    svg.setAttribute("aria-hidden", "true");

    const uso = document.createElementNS("http://www.w3.org/2000/svg", "use");
    uso.setAttribute("href", "#icono-" + nombre);

    svg.appendChild(uso);
    return svg;
}

// ---------- 3. Estado y almacenamiento ----------
const hayAlmacenamiento = (function probarAlmacenamiento() {
    try {
        const prueba = "__prueba__";
        window.localStorage.setItem(prueba, "1");
        window.localStorage.removeItem(prueba);
        return true;
    } catch (error) {
        return false;
    }
})();

function estadoInicial() {
    return {
        version: VERSION_ESTADO,
        movimientos: [],
        metaAhorro: 0,
        presupuestos: {}
    };
}

function normalizarMovimiento(datos) {
    if (!datos || typeof datos !== "object") {
        return null;
    }

    const tipo = TIPOS.includes(datos.tipo) ? datos.tipo : null;
    const monto = Number(datos.monto);

    if (!tipo || !Number.isFinite(monto) || monto <= 0 || monto > MAXIMO_MONTO) {
        return null;
    }

    const llevaCategoria = tipo === "gasto" || tipo === "ingreso";
    const categoria = llevaCategoria && CATEGORIAS[tipo][datos.categoria]
        ? datos.categoria
        : (llevaCategoria ? "otros" : null);

    return {
        id: typeof datos.id === "string" && datos.id ? datos.id : uid(),
        fecha: esFechaISO(datos.fecha) ? datos.fecha : fechaHoyISO(),
        creado: Number.isFinite(datos.creado) ? datos.creado : Date.now(),
        descripcion: String(datos.descripcion ?? "").trim().slice(0, LIMITE_DESCRIPCION) || "Sin descripción",
        monto: redondear(monto),
        tipo: tipo,
        categoria: categoria
    };
}

function normalizarEstado(datos) {
    const lista = Array.isArray(datos.movimientos) ? datos.movimientos : [];
    const movimientos = [];

    for (const item of lista) {
        const movimiento = normalizarMovimiento(item);
        if (movimiento) {
            movimientos.push(movimiento);
        }
    }

    return {
        version: VERSION_ESTADO,
        movimientos: movimientos,
        metaAhorro: Math.max(0, Number(datos.metaAhorro) || 0),
        presupuestos: datos.presupuestos && typeof datos.presupuestos === "object"
            ? datos.presupuestos
            : {}
    };
}

// Convierte el formato antiguo (contadores sueltos) al modelo v2
function migrarDesdeV1(datos) {
    const movimientos = [];
    const hoy = fechaHoyISO();
    let momento = Date.now();

    if (Array.isArray(datos.movimientos)) {
        for (const viejo of datos.movimientos) {
            const movimiento = normalizarMovimiento({
                ...viejo,
                fecha: hoy,
                creado: momento++
            });
            if (movimiento) {
                movimientos.push(movimiento);
            }
        }
    }

    const suma = function (tipo) {
        return redondear(movimientos
            .filter(function (movimiento) { return movimiento.tipo === tipo; })
            .reduce(function (total, movimiento) { return total + movimiento.monto; }, 0));
    };

    function agregarSintetico(descripcion, monto, tipo) {
        if (!(monto > 0)) {
            return;
        }
        movimientos.push({
            id: uid(),
            fecha: hoy,
            creado: momento++,
            descripcion: descripcion,
            monto: redondear(monto),
            tipo: tipo,
            categoria: tipo === "ahorro" ? null : "otros"
        });
    }

    agregarSintetico("Ingresos migrados", (Number(datos.ingresos) || 0) - suma("ingreso"), "ingreso");
    agregarSintetico("Gastos migrados", (Number(datos.gastos) || 0) - suma("gasto"), "gasto");
    agregarSintetico("Ahorros migrados", Number(datos.ahorros) || 0, "ahorro");

    return {
        version: VERSION_ESTADO,
        movimientos: movimientos,
        metaAhorro: 0,
        presupuestos: {}
    };
}

function leerJSON(clave) {
    if (!hayAlmacenamiento) {
        return null;
    }
    try {
        const crudo = window.localStorage.getItem(clave);
        return crudo ? JSON.parse(crudo) : null;
    } catch (error) {
        console.warn("No se pudo leer " + clave + ":", error);
        return null;
    }
}

function cargarEstado() {
    const datos = leerJSON(CLAVE_ESTADO);

    if (!datos || typeof datos !== "object") {
        return estadoInicial();
    }

    if (datos.version === VERSION_ESTADO) {
        return normalizarEstado(datos);
    }

    // Formato viejo: guardar copia y migrar de una vez
    const nuevo = migrarDesdeV1(datos);

    if (hayAlmacenamiento) {
        try {
            const crudo = window.localStorage.getItem(CLAVE_ESTADO);
            if (crudo && !window.localStorage.getItem(CLAVE_RESPALDO)) {
                window.localStorage.setItem(CLAVE_RESPALDO, crudo);
            }
            window.localStorage.setItem(CLAVE_ESTADO, JSON.stringify(nuevo));
        } catch (error) {
            console.warn("No se pudo guardar la migración:", error);
        }
    }

    return nuevo;
}

function guardarEstado() {
    if (!hayAlmacenamiento) {
        return;
    }
    try {
        window.localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
    } catch (error) {
        console.warn("No se pudo guardar el estado:", error);
    }
}

function calcularTotales(movimientos) {
    let ingresos = 0;
    let gastos = 0;
    let ahorros = 0;

    for (const movimiento of movimientos) {
        if (movimiento.tipo === "ingreso") {
            ingresos += movimiento.monto;
        } else if (movimiento.tipo === "gasto") {
            gastos += movimiento.monto;
        } else if (movimiento.tipo === "ahorro") {
            ahorros += movimiento.monto;
        } else if (movimiento.tipo === "retiro") {
            ahorros -= movimiento.monto;
        }
    }

    return {
        ingresos: redondear(ingresos),
        gastos: redondear(gastos),
        ahorros: redondear(ahorros),
        balance: redondear(SALDO_INICIAL + ingresos - gastos - ahorros)
    };
}

let estado = estadoInicial();
let filtroActual = "todos";
let textoBusqueda = "";
let idEnEdicion = null;
let periodoGrafica = "semana";

// ---------- 4. Referencias al DOM ----------
const elBalance = document.getElementById("balance");
const elIngresos = document.getElementById("ingresos");
const elGastos = document.getElementById("gastos");
const elAhorros = document.getElementById("ahorros");

const elFormMovimiento = document.getElementById("formMovimiento");
const elDescripcion = document.getElementById("descripcion");
const elMonto = document.getElementById("monto");
const elCategoria = document.getElementById("categoria");
const elFecha = document.getElementById("fecha");
const elBotonRegistrar = document.getElementById("btnRegistrar");
const elBotonCancelar = document.getElementById("btnCancelarEdicion");
const elNotaFormulario = document.getElementById("notaFormulario");
const elSeccionFormulario = document.getElementById("seccionFormulario");

const elFormAhorro = document.getElementById("formAhorro");
const elMontoAhorro = document.getElementById("montoAhorro");
const elFormRetiro = document.getElementById("formRetiro");
const elMontoRetiro = document.getElementById("montoRetiro");

const elLista = document.getElementById("listaMovimientos");
const elSinMovimientos = document.getElementById("sinMovimientos");
const elContador = document.getElementById("contadorMovimientos");
const elChips = document.getElementById("chipsFiltro");
const elBuscar = document.getElementById("buscar");
const elLimpiarFiltros = document.getElementById("limpiarFiltros");

const elGrafica = document.getElementById("grafica");
const elGraficaVacia = document.getElementById("graficaVacia");
const elRangoGrafica = document.getElementById("rangoGrafica");
const elBtnSemana = document.getElementById("btnSemana");
const elBtnMes = document.getElementById("btnMes");

const elFormMeta = document.getElementById("formMeta");
const elMontoMeta = document.getElementById("montoMeta");
const elMetaVacia = document.getElementById("metaVacia");
const elProgresoMeta = document.getElementById("progresoMeta");
const elMetaTexto = document.getElementById("metaTexto");
const elMetaPorcentaje = document.getElementById("metaPorcentaje");
const elMetaRelleno = document.getElementById("metaRelleno");
const elBarraMeta = document.getElementById("barraMeta");
const elMetaPie = document.getElementById("metaPie");

const elFormPresupuesto = document.getElementById("formPresupuesto");
const elCategoriaPresupuesto = document.getElementById("categoriaPresupuesto");
const elLimitePresupuesto = document.getElementById("limitePresupuesto");
const elListaPresupuesto = document.getElementById("listaPresupuesto");
const elPresupuestoVacio = document.getElementById("presupuestoVacio");

const elAviso = document.getElementById("avisoAlmacenamiento");
const elToasts = document.getElementById("toasts");

const elBotonTema = document.getElementById("btnTema");
const elIconoTema = document.getElementById("iconoTema");
const elBotonReiniciar = document.getElementById("reiniciar");
const elMenu = document.getElementById("menuOpciones");
const elArchivoCopia = document.getElementById("archivoCopia");

// ---------- 5. Tema ----------
const consultaOscuro = window.matchMedia("(prefers-color-scheme: dark)");

function temaGuardado() {
    if (!hayAlmacenamiento) {
        return "auto";
    }
    try {
        const tema = window.localStorage.getItem(CLAVE_TEMA);
        return tema === "claro" || tema === "oscuro" ? tema : "auto";
    } catch (error) {
        return "auto";
    }
}

function temaEfectivo() {
    const actual = document.documentElement.dataset.theme || "auto";
    const esOscuro = actual === "oscuro" || (actual === "auto" && consultaOscuro.matches);
    return esOscuro ? "oscuro" : "claro";
}

function aplicarTema(tema) {
    document.documentElement.dataset.theme = tema;

    const oscuro = temaEfectivo() === "oscuro";
    const etiqueta = oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

    elIconoTema.setAttribute("href", oscuro ? "#icono-sol" : "#icono-luna");
    elBotonTema.setAttribute("aria-pressed", String(oscuro));
    elBotonTema.setAttribute("aria-label", etiqueta);
    elBotonTema.title = etiqueta;
}

function alternarTema() {
    const nuevo = temaEfectivo() === "oscuro" ? "claro" : "oscuro";
    aplicarTema(nuevo);

    if (hayAlmacenamiento) {
        try {
            window.localStorage.setItem(CLAVE_TEMA, nuevo);
        } catch (error) {
            console.warn("No se pudo guardar el tema:", error);
        }
    }
}

// ---------- 6. Avisos flotantes ----------
function toast(texto, tipo, accion) {
    const elemento = document.createElement("div");
    elemento.className = "toast toast--" + (tipo || "exito");

    const mensaje = document.createElement("p");
    mensaje.className = "toast__texto";
    mensaje.textContent = texto;
    elemento.appendChild(mensaje);

    let temporizador = null;

    function cerrar() {
        window.clearTimeout(temporizador);
        elemento.remove();
    }

    if (accion) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "toast__accion";
        boton.textContent = accion.etiqueta;
        boton.addEventListener("click", function () {
            accion.alPulsar();
            cerrar();
        });
        elemento.appendChild(boton);
    }

    elToasts.appendChild(elemento);

    const duracion = accion ? 7000 : (tipo === "error" ? 5000 : 3500);
    temporizador = window.setTimeout(cerrar, duracion);
}

// ---------- 7. Pintar la pantalla ----------
function renderizarTotales() {
    const totales = calcularTotales(estado.movimientos);

    elBalance.textContent = formatearMoneda(totales.balance);
    elIngresos.textContent = formatearMoneda(totales.ingresos);
    elGastos.textContent = formatearMoneda(totales.gastos);
    elAhorros.textContent = formatearMoneda(totales.ahorros);
}

function crearGrupoDia(fecha) {
    const contenedor = document.createElement("li");
    contenedor.className = "dia";

    const titulo = document.createElement("h3");
    titulo.className = "dia__titulo";
    titulo.textContent = etiquetaDia(fecha);

    const lista = document.createElement("ul");
    lista.className = "dia__lista";

    contenedor.appendChild(titulo);
    contenedor.appendChild(lista);

    return { contenedor: contenedor, lista: lista };
}

function crearBotonAccion(nombre, etiqueta, icono, alPulsar) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "accion" + (nombre === "borrar" ? " accion--peligro" : "");
    boton.dataset.accion = nombre;
    boton.setAttribute("aria-label", etiqueta);
    boton.title = etiqueta;
    boton.appendChild(crearIcono(icono));
    boton.addEventListener("click", alPulsar);
    return boton;
}

function crearFila(movimiento) {
    const fila = document.createElement("li");
    fila.className = "movimiento movimiento--" + movimiento.tipo;

    const icono = document.createElement("span");
    icono.className = "movimiento__icono";
    icono.appendChild(crearIcono(iconoDeMovimiento(movimiento)));

    const texto = document.createElement("div");
    texto.className = "movimiento__texto";

    const descripcion = document.createElement("span");
    descripcion.className = "movimiento__desc";
    descripcion.textContent = movimiento.descripcion;

    const meta = document.createElement("span");
    meta.className = "movimiento__meta";
    meta.textContent = etiquetaMovimiento(movimiento);

    texto.appendChild(descripcion);
    texto.appendChild(meta);

    const derecha = document.createElement("div");
    derecha.className = "movimiento__derecha";

    const monto = document.createElement("span");
    const positivo = movimiento.tipo === "ingreso" || movimiento.tipo === "retiro";
    monto.className = "movimiento__monto";
    monto.textContent = (positivo ? "+" : "−") + formatearMoneda(movimiento.monto);

    const acciones = document.createElement("div");
    acciones.className = "movimiento__acciones";

    acciones.appendChild(crearBotonAccion(
        "editar",
        "Editar " + movimiento.descripcion,
        "editar",
        function () { iniciarEdicion(movimiento.id); }
    ));

    acciones.appendChild(crearBotonAccion(
        "borrar",
        "Borrar " + movimiento.descripcion,
        "borrar",
        function () { borrarMovimiento(movimiento.id); }
    ));

    derecha.appendChild(monto);
    derecha.appendChild(acciones);

    fila.appendChild(icono);
    fila.appendChild(texto);
    fila.appendChild(derecha);

    return fila;
}

function renderizarLista() {
    const total = estado.movimientos.length;

    const visibles = estado.movimientos
        .filter(pasaFiltro)
        .filter(pasaBusqueda)
        .sort(function (a, b) {
            // Primero por día (más reciente arriba), luego por hora de creación
            if (a.fecha !== b.fecha) {
                return a.fecha < b.fecha ? 1 : -1;
            }
            return b.creado - a.creado;
        });

    elLista.textContent = "";
    elContador.textContent = visibles.length === total
        ? String(total)
        : visibles.length + "/" + total;

    const hayFiltro = filtroActual !== "todos" || textoBusqueda !== "";

    elSinMovimientos.hidden = visibles.length > 0;
    elSinMovimientos.textContent = total === 0
        ? "Todavía no hay movimientos. Registra el primero con el formulario."
        : "No hay movimientos que coincidan con el filtro.";
    elLimpiarFiltros.hidden = !(hayFiltro && visibles.length === 0);

    let grupo = null;

    for (const movimiento of visibles) {
        if (!grupo || grupo.fecha !== movimiento.fecha) {
            grupo = { fecha: movimiento.fecha, lista: null };
            const nuevo = crearGrupoDia(movimiento.fecha);
            grupo.lista = nuevo.lista;
            elLista.appendChild(nuevo.contenedor);
        }
        grupo.lista.appendChild(crearFila(movimiento));
    }
}

function renderizarPantalla() {
    renderizarTotales();
    renderizarLista();
    renderizarGrafica();
    renderizarMeta();
    renderizarPresupuesto();
}

function actualizar() {
    renderizarPantalla();
    guardarEstado();
}

// ---------- 8. Formulario de movimientos ----------
function tipoSeleccionado() {
    const marcado = elFormMovimiento.querySelector('input[name="tipo"]:checked');
    return marcado ? marcado.value : "gasto";
}

function poblarCategorias() {
    const grupo = CATEGORIAS[tipoSeleccionado()] || CATEGORIAS.gasto;
    elCategoria.textContent = "";

    for (const [clave, nombre] of Object.entries(grupo)) {
        const opcion = document.createElement("option");
        opcion.value = clave;
        opcion.textContent = nombre;
        elCategoria.appendChild(opcion);
    }
}

function leerMonto(input) {
    const texto = input.value.trim();

    if (texto === "") {
        return null;
    }

    const numero = Number(texto);

    if (!Number.isFinite(numero) || numero <= 0 || numero > MAXIMO_MONTO) {
        return null;
    }

    return redondear(numero);
}

function registrarMovimiento(evento) {
    evento.preventDefault();

    const tipo = tipoSeleccionado();
    const descripcion = elDescripcion.value.trim();
    const monto = leerMonto(elMonto);
    const categoria = elCategoria.value;
    const fecha = elFecha.value;

    if (descripcion.length === 0) {
        elDescripcion.focus();
        return toast("Escribe una descripción.", "error");
    }

    if (descripcion.length > LIMITE_DESCRIPCION) {
        return toast("La descripción no puede pasar de " + LIMITE_DESCRIPCION + " caracteres.", "error");
    }

    if (monto === null) {
        elMonto.focus();
        return toast("Introduce un monto mayor que cero.", "error");
    }

    if (!esFechaISO(fecha)) {
        return toast("Elige una fecha válida.", "error");
    }

    if (fecha > fechaHoyISO()) {
        return toast("La fecha no puede ser futura.", "error");
    }

    if (!CATEGORIAS[tipo] || !CATEGORIAS[tipo][categoria]) {
        return toast("Elige una categoría válida.", "error");
    }

    // Al editar, el propio movimiento no cuenta para el saldo disponible
    const otros = idEnEdicion
        ? estado.movimientos.filter(function (m) { return m.id !== idEnEdicion; })
        : estado.movimientos;
    const totales = calcularTotales(otros);

    if (tipo === "gasto" && monto > totales.balance) {
        return toast("Fondos insuficientes. Te quedan " + formatearMoneda(totales.balance) + ".", "error");
    }

    if (idEnEdicion) {
        const indice = estado.movimientos.findIndex(function (m) {
            return m.id === idEnEdicion;
        });

        estado.movimientos[indice] = {
            ...estado.movimientos[indice],
            descripcion: descripcion,
            monto: monto,
            tipo: tipo,
            categoria: categoria,
            fecha: fecha
        };

        cancelarEdicion();
        actualizar();
        toast("Movimiento actualizado.", "exito");
        return;
    }

    estado.movimientos.push({
        id: uid(),
        fecha: fecha,
        creado: Date.now(),
        descripcion: descripcion,
        monto: monto,
        tipo: tipo,
        categoria: categoria
    });

    limpiarFormulario();
    actualizar();
    toast((tipo === "gasto" ? "Gasto" : "Ingreso") + " de " + formatearMoneda(monto) + " registrado.", "exito");
}

function limpiarFormulario() {
    elDescripcion.value = "";
    elMonto.value = "";
    elFecha.value = fechaHoyISO();
}

function iniciarEdicion(id) {
    const movimiento = estado.movimientos.find(function (m) {
        return m.id === id;
    });

    if (!movimiento) {
        return;
    }

    if (movimiento.tipo === "ahorro" || movimiento.tipo === "retiro") {
        toast("Los movimientos de ahorro no se editan. Bórralos y crea otro si lo necesitas.", "info");
        return;
    }

    idEnEdicion = id;

    const radio = elFormMovimiento.querySelector('input[name="tipo"][value="' + movimiento.tipo + '"]');
    radio.checked = true;
    poblarCategorias();

    elCategoria.value = movimiento.categoria;
    elDescripcion.value = movimiento.descripcion;
    elMonto.value = String(movimiento.monto);
    elFecha.value = movimiento.fecha;

    elBotonRegistrar.textContent = "Guardar cambios";
    elBotonCancelar.hidden = false;
    elNotaFormulario.textContent = "Editando un movimiento. Cancela si quieres dejarlo como estaba.";
    elSeccionFormulario.classList.add("formulario--editando");

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    elSeccionFormulario.scrollIntoView({
        behavior: reducido ? "auto" : "smooth",
        block: "center"
    });

    elDescripcion.focus();
}

function cancelarEdicion() {
    idEnEdicion = null;

    elBotonRegistrar.textContent = "Registrar movimiento";
    elBotonCancelar.hidden = true;
    elNotaFormulario.textContent = "Lo esencial son tres datos; el resto ya viene puesto.";
    elSeccionFormulario.classList.remove("formulario--editando");

    limpiarFormulario();
}

function borrarMovimiento(id) {
    const indice = estado.movimientos.findIndex(function (m) {
        return m.id === id;
    });

    if (indice === -1) {
        return;
    }

    const movimiento = estado.movimientos[indice];
    estado.movimientos.splice(indice, 1);

    if (idEnEdicion === id) {
        cancelarEdicion();
    }

    actualizar();

    toast("Movimiento borrado.", "exito", {
        etiqueta: "Deshacer",
        alPulsar: function () {
            const posicion = Math.min(indice, estado.movimientos.length);
            estado.movimientos.splice(posicion, 0, movimiento);
            actualizar();
            toast("Movimiento restaurado.", "exito");
        }
    });
}

// ---------- 9. Ahorros ----------
function aportarAhorros(evento) {
    evento.preventDefault();

    const monto = leerMonto(elMontoAhorro);

    if (monto === null) {
        return toast("Introduce un monto mayor que cero.", "error");
    }

    const totales = calcularTotales(estado.movimientos);

    if (monto > totales.balance) {
        return toast("No tienes suficiente balance para ese ahorro.", "error");
    }

    estado.movimientos.push({
        id: uid(),
        fecha: fechaHoyISO(),
        creado: Date.now(),
        descripcion: "Aporte a ahorros",
        monto: monto,
        tipo: "ahorro",
        categoria: null
    });

    elMontoAhorro.value = "";
    actualizar();
    toast("Ahorraste " + formatearMoneda(monto) + ".", "exito");
}

function retirarAhorros(evento) {
    evento.preventDefault();

    const monto = leerMonto(elMontoRetiro);

    if (monto === null) {
        return toast("Introduce un monto mayor que cero.", "error");
    }

    const totales = calcularTotales(estado.movimientos);

    if (monto > totales.ahorros) {
        return toast("No tienes suficientes ahorros para ese retiro.", "error");
    }

    estado.movimientos.push({
        id: uid(),
        fecha: fechaHoyISO(),
        creado: Date.now(),
        descripcion: "Retiro de ahorros",
        monto: monto,
        tipo: "retiro",
        categoria: null
    });

    elMontoRetiro.value = "";
    actualizar();
    toast("Retiraste " + formatearMoneda(monto) + " de tus ahorros.", "exito");
}

// ---------- 10. Reinicio ----------
function reiniciarAplicacion() {
    elMenu.open = false;

    const confirmado = window.confirm(
        "¿Seguro que quieres borrar todos los movimientos y volver a empezar?"
    );

    if (!confirmado) {
        return;
    }

    estado = estadoInicial();
    cancelarEdicion();
    elMontoAhorro.value = "";
    elMontoRetiro.value = "";
    elMontoMeta.value = "";
    elLimitePresupuesto.value = "";
    elBuscar.value = "";
    textoBusqueda = "";
    aplicarFiltro("todos");
    aplicarPeriodo("semana");

    actualizar();
    toast("Datos borrados. Empezamos de cero.", "exito");
}

// ---------- 15. Copia de seguridad ----------
function descargarArchivo(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    window.setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

// Sobre de exportación: metadatos de la copia + el estado completo.
// El tema no se incluye: es un ajuste del dispositivo, no de los datos.
function crearCopia() {
    return {
        app: "finova",
        version: VERSION_ESTADO,
        exportado: new Date().toISOString(),
        estado: JSON.parse(JSON.stringify(estado))
    };
}

function exportarCopia() {
    elMenu.open = false;

    const nombre = "finova-copia-" + fechaHoyISO() + ".json";

    try {
        descargarArchivo(nombre, JSON.stringify(crearCopia(), null, 2), "application/json");
        toast("Copia exportada como " + nombre + ".", "exito");
    } catch (error) {
        console.warn("No se pudo exportar la copia:", error);
        toast("No se pudo generar la copia.", "error");
    }
}

function abrirImportador() {
    elMenu.open = false;
    elArchivoCopia.value = ""; // permite releer el mismo archivo
    elArchivoCopia.click();
}

// Lee el texto del archivo: acepta el sobre completo ({app, version, estado})
// o un estado v2 pelado. Devuelve {estado, leidos} o null si no sirve.
function leerCopia(texto) {
    let datos;

    try {
        datos = JSON.parse(texto);
    } catch (error) {
        return null;
    }

    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
        return null;
    }

    let cuerpo = datos;
    if (datos.app === "finova" && datos.estado && typeof datos.estado === "object") {
        cuerpo = datos.estado;
    }

    if (cuerpo.version !== VERSION_ESTADO) {
        return null;
    }

    return {
        estado: normalizarEstado(cuerpo),
        leidos: Array.isArray(cuerpo.movimientos) ? cuerpo.movimientos.length : 0
    };
}

// Valida la copia leída, pide confirmación con resumen y reemplaza el estado.
function revisarCopia(texto, nombre) {
    const leida = leerCopia(texto);

    if (!leida) {
        toast("«" + nombre + "» no es una copia de Finova (versión 2). No se cambió nada.", "error");
        return;
    }

    const nuevo = leida.estado;
    const descartados = leida.leidos - nuevo.movimientos.length;

    if (leida.leidos > 0 && nuevo.movimientos.length === 0) {
        toast("«" + nombre + "» no contiene movimientos válidos. No se cambió nada.", "error");
        return;
    }

    const numeroPresupuestos = Object.keys(nuevo.presupuestos).filter(function (categoria) {
        return Number(nuevo.presupuestos[categoria]) > 0;
    }).length;

    let resumen = nuevo.movimientos.length === 1
        ? "1 movimiento"
        : nuevo.movimientos.length + " movimientos";
    if (nuevo.metaAhorro > 0) {
        resumen += ", meta de ahorro";
    }
    if (numeroPresupuestos > 0) {
        resumen += numeroPresupuestos === 1
            ? " y 1 presupuesto"
            : " y " + numeroPresupuestos + " presupuestos";
    }

    let pregunta = "La copia «" + nombre + "» contiene " + resumen + ".";
    if (descartados > 0) {
        pregunta += " " + descartados + " registros inválidos se descartarán.";
    }
    pregunta += " Se reemplazarán tus datos actuales. ¿Continuar?";

    if (!window.confirm(pregunta)) {
        return;
    }

    const anterior = JSON.stringify(estado);

    if (hayAlmacenamiento) {
        try {
            window.localStorage.setItem(CLAVE_ANTES_IMPORTAR, anterior);
        } catch (error) {
            console.warn("No se pudo guardar el estado previo a importar:", error);
        }
    }

    estado = nuevo;
    cancelarEdicion();

    elMontoAhorro.value = "";
    elMontoRetiro.value = "";
    elMontoMeta.value = "";
    elLimitePresupuesto.value = "";
    elBuscar.value = "";
    textoBusqueda = "";
    aplicarFiltro("todos");
    aplicarPeriodo("semana");

    actualizar();

    toast("Copia importada: " + resumen + ".", "exito", {
        etiqueta: "Deshacer",
        alPulsar: function () {
            try {
                estado = normalizarEstado(JSON.parse(anterior));
            } catch (error) {
                estado = estadoInicial();
            }
            actualizar();
            toast("Importación deshecha: tus datos anteriores están de vuelta.", "exito");
        }
    });
}

function importarCopia(evento) {
    elMenu.open = false;

    const archivo = evento.target.files[0];

    if (archivo) {
        const lector = new FileReader();

        lector.addEventListener("load", function () {
            revisarCopia(String(lector.result), archivo.name);
        });
        lector.addEventListener("error", function () {
            toast("No se pudo leer «" + archivo.name + "».", "error");
        });

        lector.readAsText(archivo, "utf-8");
    }

    evento.target.value = "";
}

// ---------- 12. Gráfica ----------
const formatoDiaMes = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short"
});

const formatoMes = new Intl.DateTimeFormat("es-DO", {
    month: "short"
});

function parsearFechaISO(texto) {
    const [anio, mes, dia] = texto.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
}

function inicioDeSemana(fecha) {
    const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const desplazamiento = (copia.getDay() + 6) % 7; // lunes = 0
    copia.setDate(copia.getDate() - desplazamiento);
    return copia;
}

function sumarDias(fecha, dias) {
    const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    copia.setDate(copia.getDate() + dias);
    return copia;
}

function textoCorto(fecha, formato) {
    return formato.format(fecha).replace(/\.$/, "");
}

function grupoVacio(clave, etiqueta, desde, hasta) {
    return {
        clave: clave,
        etiqueta: etiqueta,
        desde: desde,
        hasta: hasta,
        valores: { ingreso: 0, gasto: 0, ahorro: 0 }
    };
}

// Devuelve los periodos (8 semanas o 6 meses) con sus tres series
function agruparPeriodos(periodo) {
    const ahora = new Date();
    const grupos = [];

    if (periodo === "semana") {
        const lunes = inicioDeSemana(ahora);

        for (let i = 7; i >= 0; i--) {
            const inicio = sumarDias(lunes, -7 * i);
            const fin = sumarDias(inicio, 6);
            grupos.push(grupoVacio(
                fechaLocalISO(inicio),
                textoCorto(inicio, formatoDiaMes),
                inicio,
                fin
            ));
        }
    } else {
        for (let i = 5; i >= 0; i--) {
            const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
            grupos.push(grupoVacio(
                fechaLocalISO(inicio).slice(0, 7),
                textoCorto(inicio, formatoMes),
                inicio,
                fin
            ));
        }
    }

    const indice = new Map(grupos.map(function (grupo, i) { return [grupo.clave, i]; }));

    for (const movimiento of estado.movimientos) {
        const clave = periodo === "semana"
            ? fechaLocalISO(inicioDeSemana(parsearFechaISO(movimiento.fecha)))
            : movimiento.fecha.slice(0, 7);

        const posicion = indice.get(clave);

        if (posicion === undefined) {
            continue;
        }

        const valores = grupos[posicion].valores;

        if (movimiento.tipo === "ingreso") {
            valores.ingreso += movimiento.monto;
        } else if (movimiento.tipo === "gasto") {
            valores.gasto += movimiento.monto;
        } else if (movimiento.tipo === "ahorro") {
            valores.ahorro += movimiento.monto;
        } else if (movimiento.tipo === "retiro") {
            valores.ahorro -= movimiento.monto;
        }
    }

    for (const grupo of grupos) {
        grupo.valores.ingreso = redondear(grupo.valores.ingreso);
        grupo.valores.gasto = redondear(grupo.valores.gasto);
        grupo.valores.ahorro = redondear(grupo.valores.ahorro);
    }

    return grupos;
}

function formatearCompacto(valor) {
    const absoluto = Math.abs(valor);
    const signo = valor < 0 ? "−" : "";

    if (absoluto >= 1000000) {
        return signo + (absoluto / 1000000).toFixed(1).replace(".", ",").replace(",0", "") + "M";
    }
    if (absoluto >= 1000) {
        return signo + (absoluto / 1000).toFixed(1).replace(".", ",").replace(",0", "") + "k";
    }
    return signo + String(Math.round(absoluto));
}

// Escala "bonita": 1, 2, 5 o 10 por su potencia de diez
function pasoBonito(bruto) {
    if (!(bruto > 0)) {
        return 1;
    }
    const exponente = Math.floor(Math.log10(bruto));
    const base = Math.pow(10, exponente);
    const resto = bruto / base;
    const paso = resto <= 1 ? 1 : resto <= 2 ? 2 : resto <= 5 ? 5 : 10;
    return paso * base;
}

const ANCHO_GRAFICA = 440;
const ALTO_GRAFICA = 230;
const MARGEN = { izquierda: 44, derecha: 6, arriba: 12, abajo: 26 };

function construirGrafica(grupos) {
    const anchoUtil = ANCHO_GRAFICA - MARGEN.izquierda - MARGEN.derecha;
    const altoUtil = ALTO_GRAFICA - MARGEN.arriba - MARGEN.abajo;
    const series = ["ingreso", "gasto", "ahorro"];

    let maximo = 0;
    let minimo = 0;

    for (const grupo of grupos) {
        maximo = Math.max(maximo, grupo.valores.ingreso, grupo.valores.gasto, grupo.valores.ahorro);
        minimo = Math.min(minimo, grupo.valores.ahorro);
    }

    if (maximo === 0 && minimo === 0) {
        return null;
    }

    const paso = pasoBonito((maximo - minimo) / 4);
    const tope = Math.max(paso, Math.ceil(maximo / paso) * paso);
    const fondo = minimo < 0 ? Math.floor(minimo / paso) * paso : 0;

    function y(valor) {
        return MARGEN.arriba + ((tope - valor) / (tope - fondo)) * altoUtil;
    }

    const totales = { ingreso: 0, gasto: 0, ahorro: 0 };
    for (const grupo of grupos) {
        totales.ingreso += grupo.valores.ingreso;
        totales.gasto += grupo.valores.gasto;
        totales.ahorro += grupo.valores.ahorro;
    }

    const descripcion =
        "Gráfica de barras agrupadas. En " +
        (periodoGrafica === "semana" ? "las últimas 8 semanas" : "los últimos 6 meses") +
        ": ingresos " + formatearMoneda(totales.ingreso) +
        ", gastos " + formatearMoneda(totales.gasto) +
        " y ahorro neto " + formatearMoneda(totales.ahorro) + ".";

    const piezas = [];
    piezas.push('<title id="graficaTitulo">Ingresos, gastos y ahorro</title>');
    piezas.push('<desc id="graficaDesc">' + descripcion + "</desc>");

    for (let valor = fondo; valor <= tope + paso / 2; valor += paso) {
        const posicion = y(valor);
        const cero = Math.abs(valor) < 0.001;

        piezas.push(
            '<line class="guia' + (cero ? " guia--cero" : "") + '" x1="' + MARGEN.izquierda +
            '" x2="' + (ANCHO_GRAFICA - MARGEN.derecha) +
            '" y1="' + posicion.toFixed(1) + '" y2="' + posicion.toFixed(1) + '"></line>'
        );

        piezas.push(
            '<text class="etiqueta-eje" x="' + (MARGEN.izquierda - 6) +
            '" y="' + (posicion + 3).toFixed(1) +
            '" text-anchor="end">' + formatearCompacto(valor) + "</text>"
        );
    }

    const anchoGrupo = anchoUtil / grupos.length;
    const anchoBarra = Math.min(11, Math.max(3, (anchoGrupo - 12) / 3));
    const separacion = 1.5;
    const anchoSerie = anchoBarra * 3 + separacion * 2;
    const yCero = y(0);

    grupos.forEach(function (grupo, i) {
        const xInicial = MARGEN.izquierda + i * anchoGrupo + (anchoGrupo - anchoSerie) / 2;

        series.forEach(function (serie, j) {
            const valor = grupo.valores[serie];

            if (Math.abs(valor) < 0.005) {
                return;
            }

            const x = xInicial + j * (anchoBarra + separacion);
            const posicion = y(valor);
            const alto = Math.max(1.5, Math.abs(yCero - posicion));
            const arriba = Math.min(posicion, yCero);
            const nombre = serie === "ingreso" ? "Ingresos" : serie === "gasto" ? "Gastos" : "Ahorro neto";

            piezas.push(
                '<rect class="barra barra--' + serie +
                '" x="' + x.toFixed(1) +
                '" y="' + arriba.toFixed(1) +
                '" width="' + anchoBarra.toFixed(1) +
                '" height="' + alto.toFixed(1) +
                '" rx="1.5"><title>' + grupo.etiqueta + " · " + nombre + ": " +
                formatearMoneda(valor) + "</title></rect>"
            );
        });

        piezas.push(
            '<text class="etiqueta-periodo" x="' +
            (MARGEN.izquierda + i * anchoGrupo + anchoGrupo / 2).toFixed(1) +
            '" y="' + (ALTO_GRAFICA - 8) + '" text-anchor="middle">' +
            grupo.etiqueta + "</text>"
        );
    });

    return piezas.join("");
}

function renderizarGrafica() {
    const grupos = agruparPeriodos(periodoGrafica);
    const dibujo = construirGrafica(grupos);

    elGrafica.innerHTML = dibujo || "";

    // `hidden` no existe como propiedad en SVG: se usa el atributo
    if (dibujo) {
        elGrafica.removeAttribute("hidden");
    } else {
        elGrafica.setAttribute("hidden", "");
    }

    elGraficaVacia.hidden = Boolean(dibujo);

    const primero = grupos[0];
    const ultimo = grupos[grupos.length - 1];
    const etiqueta = periodoGrafica === "semana" ? "8 semanas" : "6 meses";

    elRangoGrafica.textContent = etiqueta + " · " +
        textoCorto(primero.desde, formatoDiaMes) + " – " +
        textoCorto(ultimo.hasta, formatoDiaMes);
}

function aplicarPeriodo(periodo) {
    periodoGrafica = periodo;
    const semanal = periodo === "semana";

    elBtnSemana.classList.toggle("chip--activo", semanal);
    elBtnMes.classList.toggle("chip--activo", !semanal);
    elBtnSemana.setAttribute("aria-pressed", String(semanal));
    elBtnMes.setAttribute("aria-pressed", String(!semanal));

    renderizarGrafica();
}

// ---------- 13. Meta de ahorro ----------
function renderizarMeta() {
    const meta = redondear(Number(estado.metaAhorro) || 0);
    const ahorros = calcularTotales(estado.movimientos).ahorros;

    if (document.activeElement !== elMontoMeta) {
        elMontoMeta.value = meta > 0 ? String(meta) : "";
    }

    elMetaVacia.hidden = meta > 0;
    elProgresoMeta.hidden = meta <= 0;

    if (meta <= 0) {
        return;
    }

    const porcentaje = Math.min(100, Math.round((ahorros / meta) * 100));
    const alcanzada = ahorros >= meta;

    elMetaTexto.textContent = formatearMoneda(Math.max(0, ahorros)) + " de " + formatearMoneda(meta);
    elMetaPorcentaje.textContent = porcentaje + "%";
    elMetaRelleno.style.width = porcentaje + "%";
    elMetaRelleno.className = "progreso__relleno" + (alcanzada ? " progreso__relleno--bien" : "");
    elBarraMeta.setAttribute("aria-valuenow", String(porcentaje));
    elBarraMeta.setAttribute("aria-valuetext", porcentaje + "% de la meta de ahorro");
    elMetaPie.textContent = alcanzada
        ? "¡Meta alcanzada! Puedes subirla cuando quieras."
        : "Te faltan " + formatearMoneda(meta - ahorros) + " para llegar.";
}

function guardarMeta(evento) {
    evento.preventDefault();

    const texto = elMontoMeta.value.trim();

    if (texto === "") {
        estado.metaAhorro = 0;
        actualizar();
        toast("Meta de ahorro eliminada.", "info");
        return;
    }

    const meta = Number(texto);

    if (!Number.isFinite(meta) || meta <= 0 || meta > MAXIMO_MONTO) {
        elMontoMeta.focus();
        toast("Escribe una meta mayor que cero.", "error");
        return;
    }

    estado.metaAhorro = redondear(meta);
    actualizar();
    toast("Meta de ahorro guardada.", "exito");
}

// ---------- 14. Presupuesto mensual ----------
function gastoDelMes() {
    const mes = fechaHoyISO().slice(0, 7);
    const porCategoria = {};

    for (const movimiento of estado.movimientos) {
        if (movimiento.tipo !== "gasto" || !movimiento.fecha.startsWith(mes)) {
            continue;
        }
        porCategoria[movimiento.categoria] =
            (porCategoria[movimiento.categoria] || 0) + movimiento.monto;
    }

    return porCategoria;
}

function claseSemaforo(porcentaje) {
    if (porcentaje >= 100) {
        return "progreso__relleno progreso__relleno--alto";
    }
    if (porcentaje >= 70) {
        return "progreso__relleno progreso__relleno--medio";
    }
    return "progreso__relleno progreso__relleno--bien";
}

function crearFilaPresupuesto(entrada) {
    const fila = document.createElement("li");
    fila.className = "presupuesto__fila";

    const icono = document.createElement("span");
    icono.className = "movimiento__icono";
    icono.appendChild(crearIcono(ICONO_POR_CATEGORIA[entrada.categoria] || "otros"));

    const texto = document.createElement("div");
    texto.className = "presupuesto__texto";

    const linea = document.createElement("div");
    linea.className = "presupuesto__linea";

    const nombre = document.createElement("strong");
    nombre.textContent = CATEGORIAS.gasto[entrada.categoria];

    const porcentaje = document.createElement("span");
    porcentaje.textContent = entrada.porcentaje + "%";

    linea.appendChild(nombre);
    linea.appendChild(porcentaje);

    const barra = document.createElement("div");
    barra.className = "progreso__barra";
    barra.setAttribute("role", "progressbar");
    barra.setAttribute("aria-valuemin", "0");
    barra.setAttribute("aria-valuemax", "100");
    barra.setAttribute("aria-valuenow", String(Math.min(100, entrada.porcentaje)));
    barra.setAttribute("aria-label",
        CATEGORIAS.gasto[entrada.categoria] + ": " +
        Math.min(100, entrada.porcentaje) + "% del límite mensual");

    const relleno = document.createElement("div");
    relleno.className = claseSemaforo(entrada.porcentaje);
    relleno.style.width = Math.min(100, entrada.porcentaje) + "%";

    barra.appendChild(relleno);

    const cifras = document.createElement("div");
    cifras.className = "presupuesto__cifras";

    const usado = document.createElement("span");
    usado.textContent = formatearMoneda(entrada.usado) + " de " +
        formatearMoneda(entrada.limite);

    const resto = document.createElement("span");
    resto.className = "presupuesto__resto";
    const diferencia = entrada.limite - entrada.usado;
    resto.textContent = diferencia >= 0
        ? " · quedan " + formatearMoneda(diferencia)
        : " · te pasaste por " + formatearMoneda(-diferencia);

    cifras.appendChild(usado);
    cifras.appendChild(resto);

    texto.appendChild(linea);
    texto.appendChild(barra);
    texto.appendChild(cifras);

    const quitar = crearBotonAccion(
        "borrar",
        "Quitar límite de " + CATEGORIAS.gasto[entrada.categoria],
        "borrar",
        function () { quitarPresupuesto(entrada.categoria); }
    );

    fila.appendChild(icono);
    fila.appendChild(texto);
    fila.appendChild(quitar);

    return fila;
}

function renderizarPresupuesto() {
    const gastado = gastoDelMes();
    const entradas = Object.keys(estado.presupuestos)
        .filter(function (categoria) {
            return CATEGORIAS.gasto[categoria] && Number(estado.presupuestos[categoria]) > 0;
        })
        .map(function (categoria) {
            const limite = Number(estado.presupuestos[categoria]);
            const usado = redondear(gastado[categoria] || 0);
            return {
                categoria: categoria,
                limite: limite,
                usado: usado,
                porcentaje: Math.round((usado / limite) * 100)
            };
        })
        .sort(function (a, b) { return b.porcentaje - a.porcentaje; });

    elListaPresupuesto.textContent = "";
    elPresupuestoVacio.hidden = entradas.length > 0;

    for (const entrada of entradas) {
        elListaPresupuesto.appendChild(crearFilaPresupuesto(entrada));
    }
}

function poblarCategoriasPresupuesto() {
    elCategoriaPresupuesto.textContent = "";

    for (const [clave, nombre] of Object.entries(CATEGORIAS.gasto)) {
        const opcion = document.createElement("option");
        opcion.value = clave;
        opcion.textContent = nombre;
        elCategoriaPresupuesto.appendChild(opcion);
    }
}

function guardarPresupuesto(evento) {
    evento.preventDefault();

    const categoria = elCategoriaPresupuesto.value;
    const limite = leerMonto(elLimitePresupuesto);

    if (!CATEGORIAS.gasto[categoria]) {
        return toast("Elige una categoría válida.", "error");
    }

    if (limite === null) {
        elLimitePresupuesto.focus();
        return toast("Escribe un límite mayor que cero.", "error");
    }

    estado.presupuestos[categoria] = limite;
    elLimitePresupuesto.value = "";
    actualizar();
    toast("Límite de " + CATEGORIAS.gasto[categoria] + " guardado.", "exito");
}

function quitarPresupuesto(categoria) {
    delete estado.presupuestos[categoria];
    actualizar();
    toast("Límite de " + CATEGORIAS.gasto[categoria] + " eliminado.", "info");
}

// ---------- 11. Eventos y arranque ----------
elFormMovimiento.addEventListener("submit", registrarMovimiento);
elFormAhorro.addEventListener("submit", aportarAhorros);
elFormRetiro.addEventListener("submit", retirarAhorros);

for (const radio of elFormMovimiento.querySelectorAll('input[name="tipo"]')) {
    radio.addEventListener("change", poblarCategorias);
}

elBotonCancelar.addEventListener("click", cancelarEdicion);

elChips.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-filtro]");
    if (!boton) {
        return;
    }
    aplicarFiltro(boton.dataset.filtro);
});

elBuscar.addEventListener("input", function () {
    textoBusqueda = normalizarTexto(elBuscar.value.trim());
    renderizarLista();
});

elLimpiarFiltros.addEventListener("click", function () {
    elBuscar.value = "";
    textoBusqueda = "";
    aplicarFiltro("todos");
});

function aplicarFiltro(filtro) {
    filtroActual = filtro;

    for (const chip of elChips.querySelectorAll("button[data-filtro]")) {
        const activo = chip.dataset.filtro === filtro;
        chip.classList.toggle("chip--activo", activo);
        chip.setAttribute("aria-pressed", String(activo));
    }

    renderizarLista();
}

elBotonTema.addEventListener("click", alternarTema);
elBotonReiniciar.addEventListener("click", reiniciarAplicacion);
document.getElementById("exportarCopia").addEventListener("click", exportarCopia);
document.getElementById("importarCopia").addEventListener("click", abrirImportador);
elArchivoCopia.addEventListener("change", importarCopia);

elBtnSemana.addEventListener("click", function () { aplicarPeriodo("semana"); });
elBtnMes.addEventListener("click", function () { aplicarPeriodo("mes"); });

elFormMeta.addEventListener("submit", guardarMeta);
elFormPresupuesto.addEventListener("submit", guardarPresupuesto);

consultaOscuro.addEventListener("change", function () {
    if ((document.documentElement.dataset.theme || "auto") === "auto") {
        aplicarTema("auto");
    }
});

// Si otra pestaña cambia los datos, recargar aquí
window.addEventListener("storage", function (evento) {
    if (evento.key !== CLAVE_ESTADO) {
        return;
    }
    estado = cargarEstado();
    renderizarPantalla();
    toast("Datos actualizados desde otra pestaña.", "info");
});

function iniciar() {
    if (!hayAlmacenamiento) {
        elAviso.hidden = false;
        elAviso.textContent =
            "Este navegador no permite guardar datos, así que se perderán al cerrar la página. " +
            "Abre la app desde un servidor local (por ejemplo: python3 -m http.server).";
    }

    estado = cargarEstado();

    poblarCategorias();
    poblarCategoriasPresupuesto();
    elFecha.value = fechaHoyISO();
    elFecha.max = fechaHoyISO();

    aplicarTema(temaGuardado());
    renderizarPantalla();
}

iniciar();
