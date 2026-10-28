# Documentación técnica — Finova

Guía para quien quiera auditar, modificar o ampliar el código. El README es la
presentación; aquí están los detalles: formato de datos, reglas de cálculo,
comportamiento interno, pruebas y accesibilidad.

## Modelo de datos

Clave en `localStorage`: `finance-app-estado`

```js
{
  version: 2,
  movimientos: [
    {
      id: "uuid",
      fecha: "2026-10-25",        // YYYY-MM-DD local, sin zona horaria
      creado: 1761408000000,      // orden dentro del mismo día
      descripcion: "Supermercado", // máx. 60 caracteres
      monto: 1500.00,             // > 0 y <= 999999999.99
      tipo: "gasto",              // gasto | ingreso | ahorro | retiro
      categoria: "comida"         // null en ahorro y retiro
    }
  ],
  metaAhorro: 0,                  // meta de la tarjeta "Meta de ahorro"
  presupuestos: {}                // { comida: 8000, ... } límites mensuales
}
```

Otras claves:

| Clave | Contenido |
|---|---|
| `finance-app-tema` | `auto` \| `claro` \| `oscuro` |
| `finance-app-estado-v1-backup` | copia sin alterar del formato viejo (solo si hubo migración) |
| `finance-app-estado-antes-importar` | estado serializado justo antes de una importación; alimenta el **Deshacer** |

Los totales nunca se guardan: **todo se deriva de los movimientos**.

```
ingresos = Σ montos de tipo "ingreso"
gastos   = Σ montos de tipo "gasto"
ahorros  = Σ "ahorro" − Σ "retiro"
balance  = ingresos − gastos − ahorros   (saldo inicial: 0)
```

Así es imposible que las tarjetas se desincronicen, y cada traspaso a ahorros
queda en el historial.

### Migración desde el formato v1

1. Si el estado guardado ya es `version: 2`, se normaliza y se usa.
2. Si es el formato viejo (`{balance, ingresos, gastos, ahorros, movimientos}`):
   - se copia el JSON original sin tocarlo a `finance-app-estado-v1-backup`;
   - cada movimiento viejo se convierte a `{fecha: hoy, categoria: "otros", creado: incremental}`;
   - se añaden movimientos sintéticos ("Ingresos migrados", "Gastos migrados",
     "Ahorros migrados") para que los totales derivados coincidan con los antiguos;
   - se guarda en v2 de inmediato para no migrar dos veces.
3. Si los datos no se pueden leer, la app arranca vacía **avisando en pantalla**.

### Normalización al cargar

Cada movimiento se valida: tipo en la lista, monto finito y positivo, fecha con
formato válido, descripción de texto recortada a 60 caracteres, categoría
conocida (o `otros`). Los registros inválidos se descartan.

### Volver a la versión anterior

`backup-v1/` conserva la app original. **Ojo:** la versión vieja usa la misma
clave `finance-app-estado` con otro formato: si la restauras tal cual, leerá
los datos nuevos como vacíos y los sobrescribirá al guardar. Antes, exporta una
copia desde la consola (con la app nueva abierta):

```js
copy(localStorage.getItem("finance-app-estado"));  // pégalo en un archivo
```

Después copia los tres archivos de `backup-v1/` a la raíz. Para regresar a
Finova, pega esa copia en `finance-app-estado` y recarga.

## Comportamiento interno

### Lista de movimientos

- Orden: `fecha` descendente y, dentro del mismo día, `creado` descendente.
- Agrupación: un `<li class="dia">` por fecha con el título "Hoy", "Ayer" o la
  fecha larga (con año si no es el actual).
- Cada fila: icono por categoría, descripción, categoría, monto con signo y dos
  acciones (editar, borrar) con `aria-label`.
- En escritorio las acciones quedan atenuadas y aparecen al pasar el ratón o al
  enfocar con teclado; en táctil son siempre visibles y de 40 px.

### Edición y borrado

- Solo se editan gastos e ingresos (ahorro y retiro se eliminan y se crean de nuevo).
- Al editar se conserva `id`, `fecha` y `creado`; la comprobación de fondos
  excluye el propio movimiento en edición.
- Borrar saca el movimiento del estado y enseña un toast de 7 s con **Deshacer**,
  que lo reinserta exactamente igual.

### Gráfica

- **Semanal**: últimas 8 semanas (empiezan en lunes). **Mensual**: últimos 6 meses.
- Tres series: ingresos, gastos y ahorro neto (retiros incluidos).
- Barras agrupadas en un `viewBox` de 440×230, escalable a cualquier ancho.
- Escala "bonita" (1/2/5×10ⁿ) que admite negativos (un mes con más retiros que
  aportes); etiquetas compactas (`1,5k`) y línea de cero más marcada.
- Cada barra tiene `<title>` (tooltip nativo); el `role="img"` lleva `<title>`
  y `<desc>` con los totales del periodo.
- Si no hay datos en el rango, se muestra un estado vacío.

### Meta de ahorro y presupuesto

- `metaAhorro` > 0 muestra progreso y porcentaje; vacía la elimina.
- `presupuestos` guarda `{categoria: limite}`; el gasto del mes se mide con
  movimientos `tipo: "gasto"` cuya fecha comparte el mes actual.
- Semáforo: verde <70 %, ámbar 70-99 %, rojo ≥100 %; entradas ordenadas por
  porcentaje descendente.

### Copia de seguridad (exportar / importar)

**Sobre de exportación** (`finova-copia-<fecha-local>.json`, generado en el
menú `⋯` → *Exportar copia*; descarga con `Blob`, sin servidor):

```json
{
  "app": "finova",
  "version": 2,
  "exportado": "2026-10-28T14:30:00.000Z",
  "estado": { "version": 2, "movimientos": [...], "metaAhorro": 25000, "presupuestos": {} }
}
```

El tema no viaja en la copia: es un ajuste del dispositivo, no de los datos.

**Importación** (menú `⋯` → *Importar copia…*, selector `accept=".json"`):

1. Acepta el sobre completo o un estado v2 «pelado»; ignora metadatos exteriores.
2. Valida con `normalizarEstado`: los movimientos inválidos se descartan y el
   resumen lo anuncia. Si el archivo tiene registros pero **ninguno** es válido,
   se rechaza sin tocar nada.
3. Un JSON roto o una `version` distinta de 2 se rechazan con un aviso de error:
   la app no cambia nada.
4. Antes de reemplazar, `window.confirm` muestra el resumen (movimientos, meta,
   presupuestos) y advierte que se reemplazan los datos actuales.
5. Al confirmar: el estado anterior se guarda serializado en
   `finance-app-estado-antes-importar`, se limpian filtros, búsqueda, formularios
   y periodo de la gráfica, y se guarda y repinta de inmediato.
6. El aviso flotante ofrece **Deshacer** (7 s), que restaura el estado previo.
7. La lectura del archivo se hace con `FileReader` y se limpia el `input`
   (`value = ""`) para poder reimportar el mismo archivo dos veces.

## Pruebas

`pruebas.html` (copia de `index.html` que carga `pruebas.js`) ejecuta
**80 comprobaciones** sobre la app real —registro, validaciones, ahorros,
edición, borrado con deshacer, filtros, búsqueda, iconos, tipografía, gráfica,
meta, presupuesto, copias de seguridad (exportar, importar válido, JSON roto,
versión incorrecta, registros inválidos, deshacer y cancelación),
accesibilidad, persistencia, migración y datos corruptos— y muestra cada línea
con `OK` o `FALLO`.

La batería respalda y restaura `localStorage`, así que no toca tus datos, y
funciona con doble clic y con servidor local.

```bash
# Regenerar la copia de pruebas cuando cambie index.html
cp index.html pruebas.html
sed -i 's#</body>#<script src="pruebas.js"></script>\n</body>#' pruebas.html

# Comprobación sin interfaz (Firefox headless)
rm -rf /tmp/ffperfil && mkdir -p /tmp/ffperfil
firefox --headless -profile /tmp/ffperfil --window-size=1280,1750 \
  --screenshot=/tmp/pruebas.png "http://localhost:8000/pruebas.html"
```

La captura debe mostrar 80 líneas, todas con `OK`.

## Accesibilidad

- Un solo `h1`, zonas `header`/`main`/`section` y enlace "Saltar al contenido".
- Todos los controles con `<label>`; los botones de solo icono llevan `aria-label`.
- Foco visible vía `:focus-visible` (`--foco-ancho 2px`, `--foco-estilo solid`);
  sin `tabindex` positivos, así que el tabulado sigue el orden del DOM.
- `aria-live="polite"` en las cuatro cifras del resumen y en los avisos;
  `aria-pressed` en tema, filtros y periodo de la gráfica; las barras usan
  `role="progressbar"` con `aria-valuenow`.
- Contraste AA medido en ambos temas (los tonos suaves se ajustaron: `#5F6E85`).
- `prefers-reduced-motion` respeta las transiciones.
- Objetivos táctiles de al menos 40×40 px (chips y acciones en pantallas táctiles).

## Sin dependencias

No hay librerías, empaquetado ni servicios. La gráfica y los iconos son SVG
generados en `script.js` e `index.html`. Solo hace falta un navegador moderno
y, opcionalmente, `python3` para el servidor local (cualquier `http.server`
sirve).
