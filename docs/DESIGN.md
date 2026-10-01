# Design System: TrazApp

Documento de referencia del sistema de diseño de TrazApp, con la estructura de `DESIGN.md` que usa Google Stitch para generar pantallas coherentes. Describe lo que **ya está implementado** en `frontend/src` y las reglas para lo que se agregue después.

> **Adaptación.** El skill de origen (`stitch-skill`) está pensado para sitios de marketing. TrazApp es una herramienta de trabajo para pequeños productores de alimentos, que registran datos de seguridad alimentaria desde el celular o el computador. Se conservan sus reglas de color, tipografía, componentes y anti-patrones. Se descartan las de hero asimétrico, imágenes dentro del titular y micro-animaciones permanentes, porque restan claridad a una tarea de registro.

## 1. Visual Theme & Atmosphere

Una interfaz serena y legible, de densidad equilibrada ("Daily App Balanced", 5/10). Superficies claras con un único acento verde bosque, esquinas generosas y sombras suaves tintadas del mismo verde. La jerarquía se construye con peso tipográfico, color de texto y espacio en blanco, no con bordes en todo.

- **Densidad:** 5. Aire suficiente para leer en el celular; sin celdas apretadas.
- **Variación:** 3. Estructura predecible y simétrica. Un usuario que registra un lote no debe buscar dónde está cada cosa.
- **Movimiento:** 3. Transiciones breves de 150–320 ms y una aparición escalonada en cuadrículas. Nada se anima en bucle. Todo se desactiva con `prefers-reduced-motion`.
- **Tono:** claro, directo, en español de Chile. Sin voseo, sin frases de marketing.

## 2. Color Palette & Roles

Un solo acento (verde), saturación por debajo del 80 %. Sin morados ni neones. Sin negro puro.

| Rol | Nombre | Valor | Token |
|---|---|---|---|
| Fondo de página | Lienzo Niebla | `#f7f8f7` | `surface` |
| Tarjetas y campos | Superficie Pura | `#ffffff` | `card` |
| Texto principal | Tinta Carbón | `#1f2933` | `text-primary` |
| Texto secundario | Pizarra | `#475467` | `text-secondary` |
| Texto auxiliar | Pizarra Suave | `#667085` | `text-muted` |
| Línea estructural | Borde Susurro | `#e5e7e5` | `border` |
| Borde de campos | Borde Firme | `#838d88` | `border-strong` |
| **Acento** | Verde Bosque | `#2f6b57` | `brand-600` |
| Acento, hover / activo | Verde Profundo | `#255747` / `#1c4336` | `brand-700` / `brand-800` |
| Acento, fondo suave | Verde Bruma | `#f0f7f4` / `#d9ede6` | `brand-50` / `brand-100` |
| Éxito | — | `#027a48` sobre `#ecfdf3` | `success` |
| Error | — | `#b42318` sobre `#fef3f2` | `error` |
| Advertencia (alérgenos obligatorios, pendientes) | — | `#93370d` sobre `#fffaeb` | `warning` |
| Información | — | `#175cd3` sobre `#eff8ff` | `info` |

**Contraste mínimo, protegido por pruebas:** texto 4.5:1 sobre su fondo y 3:1 para el borde de los campos. Ver `src/ui/mejoraUiUx.test.tsx`. Cualquier color nuevo debe pasar esa misma prueba.

**Sombras tintadas** (nunca grises ni negras): `shadow-soft` para tarjetas en reposo, `shadow-lift` para elementos flotantes (barra de acciones) y al pasar el cursor sobre tarjetas.

## 3. Typography Rules

- **Interfaz:** **Geist** (300–700). Cabecera con peso 600 y espaciado ajustado; la jerarquía viene del peso y del color, no de tamaños enormes.
- **Mono:** **Geist Mono**, reservada para códigos o identificadores largos si se necesitan.
- **Cifras:** `tabular-nums` en precios, costos, porcentajes, contenidos y contadores, para que alineen en columna.
- **Cuerpo:** 14–16 px con interlineado relajado. Datos clave (código, categoría, ayuda de campo) no bajan de **13 px**; 12 px solo en etiquetas (`Badge`).
- **Prohibido:** Inter, fuentes serif de cualquier tipo (es una herramienta de software), texto de cuerpo bajo 13 px.

## 4. Component Stylings

Todos viven en `frontend/src/components/ui`.

- **Button** (`Button`): relleno verde para la acción principal, borde para la secundaria, texto verde para la discreta. Hundimiento de 1 px al presionar (`active:translate-y-px`). Sin brillos ni sombras de color. Estado `loading` con indicador interno.
- **Campos** (`Input`, `Select`, `Textarea`, `fieldStyles`): etiqueta arriba, ayuda opcional, error debajo y enlazado con `aria-describedby`. Borde firme (3:1), foco con anillo verde. Sin etiquetas flotantes. Los campos de dinero llevan el prefijo `$`.
- **Tarjetas:** solo cuando la elevación comunica jerarquía (formulario principal, vista previa, tarjetas de producto). El resto usa divisores y espacio.
- **Badge** (`Badge`): variantes `neutral`, `brand`, `success`, `warning`, `info`, `error`. "Rotulación obligatoria" usa `warning`.
- **Chips de categoría:** casillas reales (`checkbox`) con aspecto de etiqueta; el estado marcado se ve por color y por una marca, no solo por color.
- **Filtros** (`ListToolbar`): búsqueda siempre visible; filtros y orden tras un botón "Filtros" en móvil; chips de filtros activos que se quitan de a uno.
- **Alternar vista** (`ViewToggle`): grupo de botones con `aria-pressed`; la elección se recuerda en el navegador.
- **Carga** (`Skeleton`, `ListSkeleton`): esqueletos con la forma real del contenido. Sin spinners circulares salvo dentro de un botón.
- **Estados vacíos** (`EmptyStateCard`): ilustración sencilla de nodos conectados, qué ocurre al crear el primer registro (2–3 pasos) y una única acción.
- **Avisos** (`Toast`): éxito como `status`, error como `alert`; se descartan a los 5 s, no se duplican y pueden llevar un enlace de acción.
- **Diálogos** (`ConfirmDialog`): foco atrapado, Esc para cancelar, acción destructiva en rojo.
- **Encabezado de página** (`PageHeader`): migas de pan, título, descripción y acciones principales a la derecha.
- **Barra de acciones de formulario** (`FormActions`): fija al borde inferior, con `shadow-lift`.

## 5. Layout Principles

- **Contenedor:** ancho máximo de 1440 px centrado; formularios hasta 64 rem (`max-w-5xl`).
- **Formularios de creación y edición:** dos columnas desde 1024 px. Izquierda: campos, con lo obligatorio primero y las secciones opcionales marcadas con la etiqueta "Opcional". Derecha, fija al desplazar: imagen y vista previa en vivo del producto con el avance de datos obligatorios, o los próximos pasos del ingrediente. Bajo 1024 px todo colapsa a una columna.
- **Listados:** barra de búsqueda y filtros, chips activos y luego tabla (escritorio) o tarjetas (móvil). Productos admite además una cuadrícula con imagen.
- **Navegación:** menú lateral de 240 px con enlaces reales y la sección Trazabilidad ya reservada ("Pronto"). Menú de usuario en el encabezado.
- **Responsive:** móvil primero. Sin desplazamiento horizontal. Botones y elementos del menú de al menos 44 px de alto.
- **Prohibido:** elementos superpuestos o con posicionamiento absoluto apilado, `calc()` con porcentajes, `h-screen` (usar `min-h-[100dvh]`).

## 6. Motion & Interaction

- **Duraciones:** 150 ms en controles, 200 ms en paneles, 320 ms en la aparición de tarjetas.
- **Aparición escalonada** (`.reveal` con `--i`): solo `opacity` y `transform`, con retardo de 45 ms por elemento y máximo 12.
- **Rendimiento:** no se animan `width`, `height`, `top` ni `left`. La barra de avance usa `width` solo por tratarse de un indicador pequeño y aislado.
- **Accesibilidad:** `prefers-reduced-motion` reduce todas las animaciones y transiciones a casi cero.
- **Foco:** anillo visible en todo elemento interactivo; "Saltar al contenido" disponible; el menú móvil atrapa el foco y se cierra con Esc.

## 7. Anti-Patterns (Banned)

- Sin emojis en la interfaz.
- Sin Inter ni fuentes serif.
- Sin negro puro (`#000000`); usar Tinta Carbón.
- Sin sombras con brillo de color ni degradados de texto en titulares.
- Sin acentos saturados, morados o neón. Un solo acento.
- Sin colores fijos en el código de componentes: todo sale de los tokens de `index.css`.
- Sin filas o tarjetas clicables sin enlace real: la navegación debe funcionar con teclado, clic derecho y apertura en pestaña nueva.
- Sin texto de relleno ("Scroll para explorar", flechas que rebotan).
- Sin clichés de redacción ("Eleva", "Sin fisuras", "Potencia", "De próxima generación").
- Sin nombres de relleno genéricos ("Juan Pérez", "Acme") ni cifras redondas inventadas en ejemplos y pruebas.
- Sin información importante comunicada solo por color.

## Cómo usar este documento con Stitch

Pega las secciones 1 a 7 como contexto del proyecto y describe la pantalla que necesitas, por ejemplo: *"Pantalla de detalle de lote con la cadena lote de producto, ingredientes y proveedores, siguiendo el sistema de diseño"*. Después, lleva el resultado al código reutilizando los componentes de `components/ui` en lugar de copiar estilos.
