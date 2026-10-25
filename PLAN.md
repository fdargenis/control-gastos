# Plan de rediseño — Control de gastos

> **Nota de trabajo.** Este archivo es la memoria del proyecto. Si se acaban los tokens
> o se corta la sesión, abre este archivo, busca el primer `[ ]` sin marcar y pide:
> *"continúa el PLAN.md desde la tarea X"*.

- **Carpeta:** `/home/fdargenis/Documentos/Control de gastos web  app` (ojo: doble espacio)
- **Copia de la versión original:** `backup-v1/` (HTML, CSS y JS de antes del rediseño)
- **Fecha de inicio:** 2026-10-25
- **Estado general:** Entrega C completada (fases 1-7). App lista para usar.

---

## 1. Objetivo

Convertir la app actual (una columna con formularios apilados) en un **dashboard de
tarjetas separadas**, moderno, claro y usable en móvil, con modo oscuro y gráfica
semanal/mensual. Sin dependencias externas, sin build y sin nada de pago.

### Decisiones ya tomadas con el usuario

| Tema | Decisión |
|---|---|
| Estilo | Tarjetas separadas, esmeralda + neutros fríos, tipografía del sistema |
| Modo oscuro | Sí: sigue al sistema y se puede alternar; la elección se recuerda |
| Gráfica | SVG dibujada a mano (sin Chart.js), ingresos / gastos / ahorro, semanal y mensual |
| Funciones nuevas | Fechas, borrar/editar, filtros + búsqueda, categorías con iconos, gráfica, presupuesto mensual, meta de ahorro |
| Dependencias | **Ninguna.** Nada de npm, CDN ni librerías |
| Herramientas | `python3` (servidor local) y `git`, ambas ya instaladas y gratis |
| JS | Un solo `script.js` (no módulos ES) para que siga abriéndose con doble clic |

### Fuera de alcance (por ahora)

- Exportar/importar JSON o CSV (el usuario no lo pidió en esta tanda).
- Cuentas de usuario, backend, sincronización en la nube.
- Multi-moneda: se asume RD$ con `Intl.NumberFormat("es-DO")`.
- Tests automatizados: no hay Node instalado. Verificación manual con checklist.

---

## 2. Entregas (cómo se divide el trabajo)

Cada entrega deja la app **funcionando**, para poder probar antes de seguir.

| Entrega | Fases | Qué incluye | Estado |
|---|---|---|---|
| **A** | 1, 2, 3 | Rediseño visual completo, modo oscuro, modelo de datos v2, formulario con fecha y categoría, ahorros, lista simple | **Completa** |
| **B** | 4, 5 | Agrupar por día, filtros, búsqueda, editar, borrar con deshacer, iconos por categoría | **Completa** |
| **C** | 6, 7 | Gráfica SVG, meta de ahorro, presupuesto mensual, accesibilidad final, README | **Completa** |

---

## 3. Modelo de datos (v2)

Clave en `localStorage`: `finance-app-estado`

```js
{
  version: 2,
  movimientos: [
    {
      id: "uuid",
      fecha: "2026-10-25",        // YYYY-MM-DD en hora local (sin zona horaria)
      creado: 1761408000000,      // timestamp para ordenar dentro del mismo día
      descripcion: "Supermercado",
      monto: 1500.00,
      tipo: "gasto",              // gasto | ingreso | ahorro | retiro
      categoria: "comida"         // solo gastos e ingresos; null en ahorro/retiro
    }
  ],
  metaAhorro: 0,                  // meta de la tarjeta "Meta de ahorro"
  presupuestos: {}                // { comida: 8000, ... } límites mensuales
}
```

Clave de tema: `finance-app-tema` → `"auto" | "claro" | "oscuro"`
Copia del formato viejo: `finance-app-estado-v1-backup`

### Reglas de cálculo (todo derivado, nunca guardado)

```
ingresos = Σ monto de tipo ingreso
gastos   = Σ monto de tipo gasto
ahorros  = Σ monto de tipo ahorro − Σ monto de tipo retiro
balance  = SALDO_INICIAL + ingresos − gastos − ahorros
```

`SALDO_INICIAL = 0` (constante). Con esto es imposible que las tarjetas se
desincronicen, y los traspasos a ahorros quedan en el historial.

### Migración desde v1

1. Leer `finance-app-estado`.
2. Si `version === 2`, normalizar y usar.
3. Si es formato viejo:
   - copiar el JSON original a `finance-app-estado-v1-backup`;
   - convertir cada movimiento a `{ fecha: hoy, categoria: "otros", creado: incremental }`;
   - añadir movimientos sintéticos ("Ingresos migrados", "Gastos migrados",
     "Ahorros migrados") para que los totales derivados coincidan con los viejos;
   - guardar inmediatamente en v2 para no migrar dos veces (evita duplicados).
4. Si algo falla, arrancar limpio **avisando en pantalla** (no solo `console.warn`).

### Normalización al cargar

Cada movimiento se valida: `tipo` dentro de la lista, `monto` finito y > 0,
`fecha` con formato válido, `descripcion` string recortada a 60 caracteres,
`categoria` conocida o `"otros"`. Los inválidos se descartan (hoy se pinta `RD$ NaN`).

---

## 4. Diseño visual

### Tokens CSS (`:root`)

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#F4F6FA` | `#0B1220` |
| `--superficie` | `#FFFFFF` | `#131D2E` |
| `--superficie-2` | `#F1F5F9` | `#1C2839` |
| `--borde` | `#E2E8F0` | `#26344A` |
| `--texto` | `#0F172A` | `#E6EDF6` |
| `--texto-suave` | `#5F6E85` | `#94A3B8` |
| `--marca` | `#0F766E` | `#2DD4BF` |
| `--marca-fuerte` | `#115E59` | `#14B8A6` |
| `--marca-texto` | `#FFFFFF` | `#062A27` |
| `--ingreso` | `#15803D` | `#4ADE80` |
| `--gasto` | `#B91C1C` | `#F87171` |
| `--ahorro` | `#B45309` | `#FBBF24` |

- Radios: `--radio-sm 10px`, `--radio-md 16px`, `--radio-full 999px`.
- Espaciado: `--e1 4px` … `--e6 32px`.
- Sombra suave de una sola capa, sin exagerar.
- Tipografía: stack del sistema (`-apple-system, Segoe UI, Roboto, …`).
- `color-scheme` en `light dark` para que date/number/select se vean bien.
- Todo el tema oscuro va por `[data-theme="oscuro"]` y por
  `@media (prefers-color-scheme: dark)` cuando el tema es `auto`.

### Rejilla

- Contenedor: `min(1120px, 100% - 2rem)`, `gap: 16px`.
- `.tablero`: dos columnas `5fr 7fr` con áreas
  `"resumen resumen" / "izquierda lista"`. La columna izquierda es
  `.columna` (formulario + ahorros) y la derecha `.movimientos`.
  Así la lista puede crecer sin dejar huecos bajo las otras tarjetas.
- Resumen (4 tarjetas): `auto-fit minmax(200px, 1fr)` → 4 en escritorio, 2×2 en móvil.
- `<= 960px`: todo a una columna (`resumen`, `izquierda`, `lista`).
- `<= 560px`: el resumen pasa a 2 columnas con balance y ahorros a ancho completo;
  a partir de ahí `.cifra` baja de 22 px usando `clamp`.
- `<= 360px`: el resumen pasa a una sola columna.
- Cabecera fija con desenfoque (`backdrop-filter`).
- Regla global `[hidden] { display: none !important; }` (sin ella, `display`
  de `.boton` anula el atributo y aparecen botones que deberían estar ocultos).

---

## 5. Estructura del HTML (IDs definitivos)

```
header.cabecera
  .marca (logo SVG + h1 + lema)
  #btnTema                    botón de tema (aria-pressed)
  details.menu > #reiniciar   "Borrar todos los datos"

main#contenido.contenido
  #avisoAlmacenamiento        banner si localStorage falla (hidden)
  div.tablero
    section.resumen
      #balance #ingresos #gastos #ahorros
    div.columna
      section.formulario#seccionFormulario
        #notaFormulario
        form#formMovimiento
          fieldset.segmentado (radios name="tipo" value=gasto|ingreso)
          #descripcion #monto #categoria #fecha
          #btnRegistrar
          #btnCancelarEdicion        (hidden salvo al editar)
      section.ahorros
        form#formAhorro > #montoAhorro
        form#formRetiro > #montoRetiro
    section.movimientos
      #contadorMovimientos
      .filtros
        #chipsFiltro > button[data-filtro=todos|ingreso|gasto|ahorro]
        .buscador > #buscar
      #sinMovimientos
      #limpiarFiltros            (hidden salvo filtro sin resultados)
      ul#listaMovimientos         > li.dia > h3.dia__titulo + ul.dia__lista

div#toasts (role=status aria-live=polite)
svg.sprite (símbolos de iconos)
```

### Entrega C añade

```
div.tablero
  div.columna
    section.ahorros
    section.grafica
      #btnPeriodoSemana #btnPeriodoMes
      #grafica (svg generado)  #graficaVacia
    section.meta
      #metaAhorro #formMeta #barraMeta
    section.presupuesto
      #listaPresupuesto #presupuestoVacio
      form#formPresupuesto > #categoriaPresupuesto #limitePresupuesto
```

La gráfica va en la columna izquierda, bajo ahorros: es el hueco que queda
libre cuando la lista de movimientos es larga. La rejilla no cambia de áreas.

---

## 6. Fases

### Fase 1 — Esqueleto y estilos base

- [x] Reescribir `index.html` con la estructura de tarjetas e IDs de arriba.
- [x] Sprite SVG con iconos: marca, luna, sol, puntos, ingreso, gasto, ahorro.
- [x] `style.css` con tokens, reset, tipografía, tarjetas y rejilla responsive.
- [x] Script inline mínimo en `<head>` para evitar el parpadeo de tema.

**Aceptación:** la página se ve como dashboard en escritorio y móvil. ✅

### Fase 2 — Modo oscuro

- [x] Botón `#btnTema` que alterna claro/oscuro y recuerda la elección.
- [x] Tema `auto` por defecto, siguiendo `prefers-color-scheme`.
- [x] `aria-pressed` y `aria-label` actualizados; icono sol/luna intercambiado.
- [x] Ambos temas con contraste AA (revisar `--gasto`, `--texto-suave`).

**Aceptación:** al recargar se mantiene el tema; no hay flash blanco/negro. ✅

### Fase 3 — Modelo v2 y funciones actuales

- [x] Estado v2 + `calcularTotales()` + normalización + migración v1 con copia.
- [x] Aviso visible si `localStorage` no está disponible.
- [x] Sincronización entre pestañas con el evento `storage`.
- [x] Formulario: tipo segmentado, descripción, monto, categoría, fecha.
- [x] Validación con mensajes claros (toasts), no párrafos permanentes.
- [x] Registrar gasto/ingreso; bloquear si el gasto supera el balance.
- [x] Aportar/retirar de ahorros con validación.
- [x] Lista simple: descripción, fecha, categoría, monto con signo y color.
- [x] Reiniciar todo con confirmación.

**Aceptación:** todas las funciones que ya existían siguen funcionando con el nuevo diseño. ✅

### Fase 4 — Movimientos: fechas, editar y borrar

- [x] Agrupar la lista por día: "Hoy", "Ayer", "12 de octubre".
- [x] Botón borrar por fila → toast con **Deshacer** (sin diálogo de confirmación).
- [x] Botón editar por fila → rellena el formulario, botón pasa a "Guardar cambios"
      y aparece "Cancelar". Mantiene `id`, `fecha` y `creado`.
- [x] Si se edita un gasto, revalidar fondos.
- [x] Iconos por categoría en cada fila (sprite SVG).

**Aceptación:** se puede corregir o eliminar un movimiento sin borrar todo. ✅

### Fase 5 — Filtros y búsqueda

- [x] Chips: Todos / Ingresos / Gastos / Ahorros (`aria-pressed`).
- [x] Buscador que filtra por descripción y nombre de categoría, sin distinguir mayúsculas.
- [x] Contador de resultados.
- [x] Estado vacío distinto según haya filtro activo o no.

**Aceptación:** filtrar y buscar no altera los datos, solo la vista. ✅

### Fase 6 — Gráfica semanal/mensual

> Va en la columna izquierda, bajo ahorros (`section.grafica`), aprovechando
> el espacio que deja libre la lista de movimientos. Ancho útil ~460 px en
> escritorio y todo el ancho en móvil.

- [x] Agregación: últimas 8 semanas (lunes como inicio) y últimos 6 meses.
- [x] Tres series: ingresos, gastos, ahorro neto. Barras agrupadas.
- [x] SVG generado con `viewBox`, responsive, sin librerías.
- [x] Eje Y con 4 líneas guía y formato compacto (`1,5k`).
- [x] `<title>` por barra (tooltip nativo) y `role="img"` con `<desc>`.
- [x] Botones Semanal/Mensual con `aria-pressed`; estado vacío si todo es 0.

**Aceptación:** los totales de la gráfica coinciden con las tarjetas del periodo. ✅

### Fase 7 — Meta de ahorro, presupuesto y cierre

- [x] Meta de ahorro editable + barra de progreso y porcentaje.
- [x] Presupuesto mensual por categoría: límite editable, gasto del mes,
      barra con semáforo (verde <70%, ámbar 70-99%, rojo ≥100%).
- [x] Configurar y eliminar límites desde la misma tarjeta.
- [x] Estado vacío invitando a crear el primer límite.
- [x] Repaso de accesibilidad (ver sección 8).
- [x] `README.md` con uso, estructura y checklist.
- [ ] Opcional, no bloquea: `git init` + `.gitignore` + commits por fase.

**Aceptación:** el presupuesto cuadra con los movimientos del mes actual. ✅

---

## 7. Comportamiento detallado de las funciones

### Registro de movimiento

1. Leer tipo, descripción, monto, categoría y fecha.
2. Descripción obligatoria (1-60 caracteres), monto finito > 0, redondeado a 2 decimales.
3. Fecha obligatoria, formato `YYYY-MM-DD`, no futura.
4. Categoría válida según el tipo (listas separadas para gasto e ingreso).
5. Si es gasto y supera el balance → error "Fondos insuficientes".
6. Guardar, limpiar descripción y monto, dejar tipo y categoría, volver a hoy.
7. Toast de éxito con el monto.

### Ahorros

- Aportar: no puede superar el balance; crea movimiento `tipo: "ahorro"`.
- Retirar: no puede superar los ahorros; crea movimiento `tipo: "retiro"`.
- Ambos son movimientos, así que aparecen en el historial y en la gráfica.

### Lista de movimientos

- Orden: `fecha` descendente y, dentro del mismo día, `creado` descendente.
- Agrupación: un `<li class="dia">` por fecha con `<h3>` "Hoy", "Ayer",
  "sábado, 24 de octubre" (con año si no es el actual) y una `<ul>` interna.
- Cada fila: icono según categoría (`ICONO_POR_CATEGORIA`), descripción,
  categoría, monto con signo y dos acciones (editar, borrar) con `aria-label`.
- En escritorio las acciones se atenúan (opacidad 0.5) y se ven al pasar el ratón
  o al enfocar con teclado; en pantallas táctiles son siempre visibles y de 40 px.

### Editar

- Solo se editan `gasto` e `ingreso`; ahorro y retiro se borran y se vuelven a crear.
- Al pulsar editar: se marca `idEnEdicion`, se rellenan tipo, categoría, descripción,
  monto y fecha; el botón pasa a "Guardar cambios", aparece "Cancelar edición",
  la tarjeta se resalta y se hace `scrollIntoView` (sin animación si el usuario
  pidió movimiento reducido).
- Al guardar se reemplaza el movimiento conservando `id`, `fecha` y `creado`.
- La comprobación de fondos excluye el propio movimiento que se está editando.
- "Cancelar edición" restaura textos y limpia el formulario.

### Borrar con deshacer

- Se elimina de `estado.movimientos` y se guarda.
- El toast guarda el movimiento y su índice; "Deshacer" lo reinserta y guarda.
- Duración del toast con acción: 7 s.
- Si el movimiento borrado estaba en edición, se cancela la edición.

### Filtros y búsqueda

- `filtroActual`: `todos | ingreso | gasto | ahorro`; el chip "Ahorros" incluye
  aportes y retiros. Los chips actualizan `aria-pressed` y la clase `chip--activo`.
- `textoBusqueda` se normaliza (minúsculas y sin acentos) y se compara contra
  descripción + categoría + tipo, así que "cafe" encuentra "Café".
- El contador muestra `visibles/total` cuando hay filtro y solo el total si no lo hay.
- Si no hay coincidencias: mensaje distinto y botón "Limpiar filtros", que
  restablece búsqueda y chip "Todos". Solo cambia la vista, nunca los datos.

### Presupuesto

- `presupuestos = { categoriaId: limite }`.
- Gasto del mes = movimientos `tipo: "gasto"` con `fecha` en el mes actual.
- Solo se listan categorías con límite; se ordenan por porcentaje descendente.

### Categorías

- Gastos: comida, transporte, vivienda, servicios, salud, ocio, compras, otros.
- Ingresos: salario, extra, otros.
- Los movimientos migrados sin categoría van a `otros`.

---

## 8. Accesibilidad (revisar en Fase 7)

- [x] Enlace "Saltar al contenido" y landmarks (`header`, `main`, `section`).
- [x] Un solo `h1`; cada tarjeta con `aria-labelledby`.
- [x] Todos los inputs con `<label>` (incluidos ahorro y retiro).
- [x] `aria-live="polite"` en toasts y en el resumen (las cuatro cifras).
- [x] `aria-pressed` en el botón de tema, en los filtros y en Semanal/Mensual.
- [x] Botones de solo icono con `aria-label` (tema, menú, editar, borrar, quitar límite).
- [x] Foco visible propio (`:focus-visible` con `outline: 2px solid var(--marca)`, offset 2px).
- [x] Contraste AA en ambos temas (medido; `--texto-suave` claro pasó de `#64748B` a `#5F6E85`).
- [x] Objetivos táctiles de al menos 40×40 px (chips, botones y acciones en táctil).
- [x] Respetar `prefers-reduced-motion`.
- [x] Gráfica con alternativa textual (`role="img"`, `<title>` y `<desc>` con los totales).

---

## 9. Checklist de pruebas manuales

Abrir con `python3 -m http.server 8000` y probar:

- [x] Registrar ingreso → balance e ingresos suben, lista muestra `+RD$`.
- [x] Registrar gasto → balance baja, gastos suben.
- [x] Gasto mayor que el balance → error y no se guarda.
- [x] Aportar a ahorros → balance baja, ahorros suben, movimiento en lista.
- [x] Retirar más de lo ahorrado → error.
- [x] Recargar la página → todo se conserva.
- [x] Editar un movimiento → los totales se recalculan.
- [x] Borrar y deshacer → vuelve exactamente igual.
- [x] Filtros y búsqueda → solo cambia la vista.
- [x] Movimientos de días anteriores se agrupan en "Hoy", "Ayer" y su fecha.
- [x] Gráfica semanal y mensual → coincide con los totales.
- [x] Presupuesto → cambia de color al pasar del 70% y del 100%.
- [x] Cambiar tema y recargar → se mantiene.
- [x] Abrir dos pestañas, registrar en una → la otra se actualiza.
- [x] Abrir el HTML con doble clic (`file://`) → avisa si no puede guardar.
- [x] Ventana a 375 px de ancho → nada se desborda.
- [x] Navegar solo con teclado → controles nativos, sin `tabindex` positivos y foco visible.
- [x] Consola sin errores.

### Probar la migración

En la consola del navegador, con la app cerrada:

```js
localStorage.clear();
localStorage.setItem("finance-app-estado", JSON.stringify({
  balance: 500, ingresos: 1000, gastos: 300, ahorros: 200,
  movimientos: [{ descripcion: "Viejo", monto: 300, tipo: "gasto" }]
}));
location.reload();
```

Debe mostrar balance 500, ingresos 1000, gastos 300, ahorros 200 y la copia en
`finance-app-estado-v1-backup`.

### Pruebas automáticas en el navegador

`pruebas.html` ejecuta 63 comprobaciones sobre la app real (registro, validaciones,
ahorros, agrupación por día, edición, borrado con deshacer, filtros, búsqueda,
iconos, tipografía, gráfica, meta, presupuesto, accesibilidad, persistencia,
migración y datos corruptos) y muestra el resultado en pantalla. Respalda y
restaura `localStorage`, así que no borra los datos del usuario.

```bash
# Regenerar la copia de pruebas cuando cambie index.html
cp index.html pruebas.html
sed -i 's#</body>#<script src="pruebas.js"></script>\n</body>#' pruebas.html

# Ejecutar en un perfil limpio y guardar el resultado como captura
rm -rf /tmp/ffperfil && mkdir -p /tmp/ffperfil
firefox --headless -profile /tmp/ffperfil --window-size=1280,980 \
  --screenshot=/tmp/pruebas.png "http://localhost:8000/pruebas.html"
```

Todas las líneas deben empezar por `OK`. Si algo falla, la captura muestra el
valor real al lado de la comprobación.

Luego abrir `http://localhost:8000/pruebas.html`. Todo debe salir `OK`.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| La migración pierde datos | Copia en `finance-app-estado-v1-backup`, guardado inmediato y pruebas con el snippet de arriba |
| `file://` bloquea localStorage | Prueba de disponibilidad al arrancar y banner visible |
| Dos pestañas se pisan | Evento `storage` + recarga del estado |
| Rediseño y funciones a la vez | Entregas A/B/C con app funcional al final de cada una |
| Sin motor de JS ni tests | Checklist manual + `python3 -m http.server` |
| Categorías viejas sin asignar | Van a `otros` y no cuentan en presupuestos hasta editarlas |

---

## 11. Comandos útiles

```bash
cd "$HOME/Documentos/Control de gastos web  app"
python3 -m http.server 8000        # abrir http://localhost:8000
git init && git add . && git commit -m "Rediseño: entrega A"
```

Restaurar la versión anterior (ojo: usa la misma clave `finance-app-estado` con
otro formato; guarda antes una copia del JSON desde la consola, o la app vieja
lo sobrescribirá):

```bash
cp backup-v1/index.html backup-v1/style.css backup-v1/script.js .
```

---

## 12. Registro de progreso

| Fecha | Entrega | Notas |
|---|---|---|
| 2026-10-25 | — | Revisión inicial, plan aprobado, `backup-v1/` creado |
| 2026-10-25 | A | Hecho: dashboard de tarjetas, tokens CSS, modo oscuro, modelo v2 con migración, formulario con fecha y categoría, ahorros, lista, toasts, sincronización entre pestañas. 23 pruebas en verde |
| 2026-10-25 | B | Hecho: balance con el mismo tamaño que las demás cifras (fondo verde intacto), agrupación por día, editar, borrar con deshacer, filtros, búsqueda, iconos por categoría, objetivos táctiles de 40 px y rejilla con columna izquierda. 42 pruebas en verde, sin errores de JS |
| 2026-10-25 | C | Hecho: gráfica SVG (8 semanas / 6 meses, tres series, escalas con negativos, `<title>` por barra), meta de ahorro con progreso, presupuesto por categoría con semáforo, estados vacíos, `aria-live` en el resumen, contraste AA corregido (`#5F6E85`), fila móvil en dos líneas, `README.md`. 63 pruebas en verde (servidor y `file://`), sin errores de JS |
