# Finova

**Gastos, ingresos y ahorros del día a día, sin cuentas ni nube.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Licencia](https://img.shields.io/badge/licencia-MIT-0F766E)
![Dependencias](https://img.shields.io/badge/dependencias-0-0F766E)

![Vista de escritorio](capturas/escritorio.png)

También: [modo oscuro](capturas/escritorio-oscuro.png) · [móvil](capturas/movil.png).

## ¿Por qué Finova?

Apuntar los gastos suele terminar en apps que piden cuenta, conexión y
permisos, o en hojas de cálculo que nadie actualiza. Finova es lo contrario:
se abre y funciona. Todo lo que escribes **se queda en tu navegador**; no hay
servidores, registro ni telemetría de ningún tipo.

Está pensada para cualquier persona que solo quiera responder tres preguntas
cada día: *cuánto entra, cuánto gasto y cuánto me queda*. Suficientemente
sencilla para usar con prisa, y suficientemente completa para presupuestos por
categoría, meta de ahorro y gráfica de evolución.

## La app, publicada

El código está publicado en
[github.com/fdargenis/control-gastos](https://github.com/fdargenis/control-gastos).
Para probarla sin instalar nada más, clona el repositorio y abre `index.html`
(el navegador la ejecuta directamente).

## Empezar

```bash
git clone https://github.com/fdargenis/control-gastos.git
cd control-gastos
python3 -m http.server 8000
```

Y entra en <http://localhost:8000>. El servidor local solo está de apoyo:
también puedes abrir `index.html` con doble clic. En ese caso algunos
navegadores bloquean el almacenamiento y avisarán; los datos no se conservarán
al cerrar.

## Qué hace

- **Resumen**: balance disponible, ingresos, gastos y ahorros, siempre calculados
  a partir de los movimientos.
- **Movimientos**: alta con fecha y categoría, agrupados por día ("Hoy", "Ayer",
  fecha), con iconos, edición y borrado con **Deshacer**.
- **Filtros y búsqueda**: Todos / Ingresos / Gastos / Ahorros, y buscador que
  ignora mayúsculas y acentos.
- **Ahorros**: aportar y retirar; cada operación queda en el historial.
- **Gráfica**: ingresos, gastos y ahorro neto de las últimas 8 semanas o los
  últimos 6 meses, dibujada en SVG propio.
- **Meta de ahorro**: cuánto quieres reunir, con barra y porcentaje.
- **Presupuesto del mes**: límites por categoría con semáforo (verde <70 %,
  ámbar 70-99 %, rojo ≥100 %).
- **Modo oscuro**: botón en la cabecera; al arrancar sigue el tema del sistema.

## Uso rápido

1. Elige **Gasto** o **Ingreso**, escribe la descripción, el monto y la
   categoría. La fecha viene con hoy; puedes cambiarla.
2. Pulsa **Registrar movimiento**. Para corregir algo, usa el lápiz de la fila;
   para eliminarlo, la papelera (el aviso permite **Deshacer**).
3. **Ahorros**: escribe un monto y pulsa **Aportar** o **Retirar**. No se puede
   ahorrar más que el balance ni retirar más que lo ahorrado.
4. **Evolución**: alterna **Semanal / Mensual**. Pasa el ratón por una barra
   para ver la cifra exacta.
5. **Meta de ahorro**: escribe cuánto quieres reunir; déjalo vacío para quitarla.
6. **Presupuesto**: elige categoría y límite; la papelera de cada fila lo
   elimina.
7. **Tema**: el botón de luna/sol alterna claro y oscuro y recuerda la elección.

## Tecnologías

| Tecnología | Papel en el proyecto |
|---|---|
| **HTML5** | Estructura de la app y sprite de iconos SVG, semántica accesible |
| **CSS3** | Tokens de color, modo oscuro, rejilla responsive (320 px → escritorio) |
| **JavaScript** | Lógica, estado, gráfica y batería de pruebas; vanilla, sin módulos ni framework |

No hay librerías externas, ni paso de build, ni servicios de pago: la gráfica y
los iconos son SVG escritos a mano.

## Estructura del proyecto

```
index.html            estructura, formularios y sprite de iconos SVG
style.css             tokens, temas, rejilla y componentes
script.js             estado, cálculos, render, gráfica y eventos
pruebas.html          copia de index.html que carga las pruebas
pruebas.js            63 comprobaciones automáticas en el navegador
docs/TECNICA.md       documentación técnica avanzada
PLAN.md               memoria del diseño por fases
capturas/             imágenes usadas en este README
LICENSE               licencia MIT
backup-v1/            copia local de la versión original (no versionada)
```

## Hoja de ruta

**Terminado (v1)**

- [x] Dashboard de tarjetas con balance, ingresos, gastos y ahorros.
- [x] Alta, edición y borrado con deshacer; agrupación por día.
- [x] Filtros, búsqueda y contador de resultados.
- [x] Aportes y retiros de ahorros con validación.
- [x] Gráfica SVG semanal (8 semanas) y mensual (6 meses).
- [x] Meta de ahorro con progreso.
- [x] Presupuesto mensual por categoría con semáforo.
- [x] Modo oscuro, responsive y accesibilidad AA revisada.
- [x] Batería automática de 63 comprobaciones.

**Pendiente (ideas para la v2)**

- [ ] Copia de seguridad: exportar/importar movimientos a JSON.
- [ ] Saldo inicial configurable.
- [ ] Exportar los movimientos a CSV (Excel/Sheets).
- [ ] Movimientos recurrentes (alquiler, sueldo…).
- [ ] Instalable en móvil (PWA) y demo persistente en GitHub Pages.

## Datos y privacidad

Todo funciona y se guarda en el navegador (`localStorage`): nada viaja a
ningún servidor. El esquema completo de datos, las reglas de cálculo y los
detalles de la gráfica están en la
[documentación técnica](docs/TECNICA.md).

## Licencia

Distribuido bajo la
[licencia MIT](LICENSE): puedes usar, copiar y modificar el código
indicando la autoría original.
