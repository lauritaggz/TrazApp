# Design System: TrazApp

Documento de referencia del sistema de diseño de TrazApp, con la estructura de `DESIGN.md` que usa Google Stitch para generar pantallas coherentes. Describe lo que **ya está implementado** en `frontend/src` y las reglas para lo que se agregue después.

> **Adaptación.** El skill de origen (`stitch-skill`) está pensado para sitios de marketing. TrazApp es una herramienta de trabajo para pequeños productores de alimentos, que registran datos de seguridad alimentaria desde el celular o el computador. Se conservan sus reglas de color, tipografía, componentes y anti-patrones. Se descartan las de hero asimétrico, imágenes dentro del titular y micro-animaciones permanentes, porque restan claridad a una tarea de registro.

## 1. Visual Theme & Atmosphere

Dirección **«Cuaderno de campo»** (HT08): una libreta de trabajo de quien produce. Fondo crema, paneles color trigo y un único acento verde albahaca; el ámbar queda reservado para alertas. Cercana y cálida, no de punto de venta. La jerarquía se construye con tipografía, color de texto y espacio en blanco, no con bordes en todo.

- **Densidad:** 5. Aire suficiente para leer en el celular; sin celdas apretadas.
- **Variación:** 3. Estructura predecible. Un usuario que registra un lote no debe buscar dónde está cada cosa.
- **Movimiento:** 3. Transiciones breves de 150–320 ms y una aparición escalonada en cuadrículas. Nada se anima en bucle. Todo se desactiva con `prefers-reduced-motion`.
- **Tono:** claro, directo, en español de Chile. Sin voseo, sin frases de marketing.

## 2. Color Palette & Roles

Un solo acento (verde), saturación por debajo del 80 %. Grises siempre cálidos (familia tierra), nunca fríos. Sin morados ni neones. Sin negro puro.

| Rol | Nombre | Valor | Token |
|---|---|---|---|
| Fondo de página | Crema | `#faf7f2` | `surface` |
| Tarjetas y campos | Papel | `#ffffff` | `card` |
| Panel suave (bloques secundarios) | Lino | `#f2ece0` | `panel` |
| Panel de énfasis | Trigo | `#ede4d0` / `#dcd0b5` | `wheat` / `wheat-deep` |
| Panel profundo (lateral de acceso, destacados) | Bosque | `#1f3f2a` | `deep` |
| Texto principal | Tinta | `#22201c` | `text-primary` |
| Texto secundario | Tierra | `#5b554b` | `text-secondary` |
| Texto auxiliar | Tierra Suave | `#6b6457` | `text-muted` |
| Línea estructural | Borde | `#e7e0d3` / `#f0eadf` | `border` / `border-soft` |
| Borde de campos | Borde Firme | `#8c8474` | `border-strong` |
| **Acento** | Verde Albahaca | `#2e5e3e` | `brand-600`, `accent` |
| Acento, hover / activo | Albahaca Profunda | `#244b31` / `#1f3f2a` | `brand-700` / `brand-800` |
| Acento, fondo suave | Brote | `#eef3ee` / `#e3ece4` | `brand-50` / `brand-100` |
| Texto sobre relleno de marca | Crema | `#faf7f2` (y `#a8d8b4` para la z del logo) | `on-brand` / `on-brand-accent` |
| Éxito | — | `#256b3a` sobre `#e8f1e8` | `success` |
| Error | — | `#b42318` sobre `#fdf1ee` | `error` |
| Advertencia (alérgenos obligatorios, pendientes) | Ámbar | `#7a3e06` sobre `#fcf1dc` | `warning` |
| Información | — | `#2f5a7a` sobre `#eaf1f5` | `info` |

**Contraste mínimo, protegido por pruebas:** texto 4.5:1 sobre su fondo y 3:1 para el borde de los campos. Ver `src/ui/mejoraUiUx.test.tsx`. Cualquier color nuevo debe pasar esa misma prueba.

**Sombras tintadas** del tono tierra (nunca grises ni negras en modo claro): `shadow-soft` para tarjetas en reposo, `shadow-lift` para elementos flotantes y al pasar el cursor sobre tarjetas.

### Modo oscuro

El selector (luna / sol) está junto al logo, en el menú lateral y en las pantallas de acceso. Se aplica con `data-theme` en `<html>` y se recuerda en el navegador (`trazapp_tema`); sin elección guardada, sigue la preferencia del sistema. Un script en `index.html` fija el modo antes de pintar para evitar el parpadeo.

- **Solo cambian los tokens** (`:root[data-theme="dark"]` en `index.css`); los componentes no tienen variantes propias.
- **Rellenos de marca** (`brand-600/700/800`) se aclaran un poco (`#3d7a52`) y siguen llevando texto claro (5:1 o más). Para texto, enlaces, anillos de foco y bordes de acento se usan `accent` y `accent-strong`, que en oscuro pasan a un verde claro (`#8cc49b` / `#a9d6b5`).
- Superficies: fondo `#15140f`, tarjeta `#1c1a15`, trigo `#2a2619`. Texto `#eee9df` / `#bdb5a6` / `#a39b8c`. Ámbar `#f2b866`.
- Los mismos contrastes (4.5:1 texto, 3:1 bordes y anillos) están protegidos por pruebas en `src/ui/modoOscuro.test.tsx`.
- **Regla:** nunca usar `text-brand-600/700` ni `ring-brand-600` en componentes nuevos; usar `text-accent`, `text-accent-strong` y `ring-accent`. Sobre rellenos de marca, `text-on-brand`.

## 3. Typography Rules

- **Títulos:** **Bricolage Grotesque** (500–800, `font-display`). Se aplica sola a `h1` y `h2`, con espaciado `-0.02em` y `text-wrap: balance`. Es una grotesca con carácter, no una serif.
- **Interfaz:** **Geist** (300–700) para todo lo demás, incluidos `h3`, etiquetas, botones y tablas.
- **Mono:** **Geist Mono**, reservada para códigos o identificadores largos.
- **Cifras:** `tabular-nums` en precios, costos, porcentajes, contenidos y contadores, para que alineen en columna.
- **Cuerpo:** 14–16 px con interlineado relajado y `text-wrap: pretty`. Datos clave (código, categoría, ayuda de campo) no bajan de **13 px**; 12 px solo en etiquetas (`Badge`).
- **Prohibido:** Inter, fuentes serif de cualquier tipo, Bricolage en texto de cuerpo o en controles, texto de cuerpo bajo 13 px.

### Logotipo «la z que une»

- **Nombre:** «trazapp» en minúsculas, Bricolage 800, espaciado `-0.05em`. La z es un dibujo (no una letra): un recorrido que termina en un punto abierto, quien consume. Va en el color de acento; sobre verde, en `on-brand-accent`.
- **Símbolo:** la misma z sobre un cuadrado verde redondeado, con un punto lleno al inicio (el origen) y uno abierto al final. Es el favicon (`public/favicon.svg`) y `TrazSymbol` en `components/Logo.tsx`.
- El componente `Logo` expone «TrazApp» como texto accesible; el dibujo va con `aria-hidden`.
- No recolorear fuera de los tokens, no estirar y no reemplazar la z por la letra de la fuente.

## 4. Component Stylings

Todos viven en `frontend/src/components/ui`.

- **Button** (`Button`): esquinas de 12 px. Relleno verde para la acción principal (con un brillo interior de 1 px y una sombra corta del mismo verde), borde para la secundaria, texto verde para la discreta. Al presionar se hunde 1 px y se reduce a 98,5 %. Estado `loading` con indicador interno.
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
- **Listados:** barra de búsqueda y filtros, chips activos y luego tabla (escritorio) o tarjetas (móvil). Productos admite además una cuadrícula con imagen. Cada fila lleva una ficha con la inicial sobre trigo y una flecha que se desliza al pasar el cursor (`components/ui/ListaPiezas.tsx`); los «sin resultados» y errores van en un bloque lino punteado (`AvisoLista`). Insumos suma vistas rápidas con conteo (Activos, Por revisar en ámbar, Inactivos), sincronizadas con los filtros de la barra.
- **Navegación:** en escritorio (desde 1024 px), menú lateral de 248 px sobre el panel `panel`, fijo al alto de la ventana; el ítem activo lleva un relleno verde que se desliza al cambiar de sección. En el celular, barra de pestañas inferior (Inicio, Productos, Ingredientes, Insumos y «Más», que abre el menú completo) y encabezado con el logo. La barra reserva su alto en `--tabbar-h`: el contenido, los avisos y la barra de acciones de formularios se apoyan sobre ella. Menú de usuario en el encabezado.
- **Responsive:** móvil primero. Sin desplazamiento horizontal. Botones y elementos del menú de al menos 44 px de alto.
- **Prohibido:** elementos superpuestos o con posicionamiento absoluto apilado, `calc()` con porcentajes, `h-screen` (usar `min-h-[100dvh]`).

## 6. Motion & Interaction

- **Duraciones:** 150 ms en controles, 200 ms en paneles, 320 ms en la aparición de tarjetas.
- **Cambio de sección:** animación CSS al montar la página (`.app-page` en `index.css`, dirección en `layout/transicionPagina.ts`). El contenido entra en 300 ms desde 16 px en la dirección del menú (avanzar desde la derecha, retroceder desde la izquierda); la página anterior no se anima. El relleno del menú lateral y la píldora de las pestañas recuerdan dónde estaban y se deslizan en 320 ms hasta el ítem nuevo, por debajo del texto, que pasa a claro al mismo ritmo. La aparición escalonada `.reveal` solo corre en la primera carga. No se usa la View Transitions API: sus capturas se mezclaban sumando colores (un destello) y se dibujaban encima del texto del menú.
- **Aparición escalonada** (`.reveal` con `--i`): solo `opacity` y `transform`, con retardo de 45 ms por elemento y máximo 12.
- **Rendimiento:** no se animan `width`, `height`, `top` ni `left`. La barra de avance usa `width` solo por tratarse de un indicador pequeño y aislado.
- **Accesibilidad:** `prefers-reduced-motion` reduce todas las animaciones y transiciones a casi cero.
- **Foco:** anillo visible en todo elemento interactivo; "Saltar al contenido" disponible; el menú móvil atrapa el foco y se cierra con Esc.

## 7. Anti-Patterns (Banned)

- Sin emojis en la interfaz.
- Sin Inter ni fuentes serif. Bricolage solo en títulos y en el logo.
- Sin grises fríos (azulados) junto a la paleta tierra.
- Sin negro puro (`#000000`); usar Tinta.
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
