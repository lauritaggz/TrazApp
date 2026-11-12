# TrazApp — Contexto de la HT07 para el agente de código

**HT07 — Ajustes de usabilidad tras la validación del Sprint 2**

Este documento complementa a `TrazApp_Sprint2_contexto_agente.md`. Léelo completo antes de trabajar en la HT07. Si algo de este documento contradice un prompt de tarea, **el prompt de tarea manda**.

Se basa en la auditoría de UI/UX del 21-10-2026, hecha en local con capturas en escritorio (1280×800) y en celular (390×844).

---

## 1. Reglas de trabajo

1. **Se trabaja por bloques.** Cada bloque tiene su propio prompt. Al terminar un bloque, detente y entrega el reporte.
2. **No hagas commit, push ni merge.**
3. **No cambies la lógica de negocio ni los contratos de la API.** Esta historia es solo de interfaz. Si un cambio exige tocar el backend, detente y pregunta.
4. **Pruebas por bloque:**
   - corre los archivos de prueba afectados y los recorridos de `src/recorridos`, que no deben empeorar;
   - haz como máximo 3 o 4 mutaciones, las de mayor riesgo;
   - las suites completas las corre GitHub Actions en cada push.
5. **Actualiza las pruebas que busquen textos o posiciones que cambiaron.** Explica por qué en el reporte y nunca relajes una aserción.
6. **Calidad mínima en todo lo que toques:**
   - áreas táctiles de al menos 44 px;
   - foco visible;
   - nombres accesibles;
   - contraste suficiente;
   - texto de al menos 12 px;
   - respeto de `prefers-reduced-motion`.
7. **No agregues animaciones decorativas.** El movimiento solo se usa para mostrar un cambio que el usuario provocó o para llevarlo al lugar de un problema.
8. **Si para verificar necesitas datos, usa las cuentas de prueba de la auditoría.** Nunca uses la cuenta real de la desarrolladora.
9. **Nunca levantes Vite en el puerto 5175**, que es el de la desarrolladora. Usa otro puerto y detén tus servidores al terminar.

---

## 2. Usuario y prioridades

- **Usuario:** un productor pequeño de alimentos. Usa la app en el computador y en el celular, este último en la cocina y con el envase en la mano.
- **Tareas frecuentes (cada semana):**
  - registrar una elaboración;
  - registrar un insumo, escaneando su código de barras;
  - revisar alérgenos.
- **Tareas poco frecuentes:** crear productos, ingredientes y formulaciones.

**Principio:** la acción frecuente debe estar arriba, ser la más visible y estar a la menor cantidad de scroll posible.

---

## 3. Vocabulario de la interfaz (decisión tomada; aplícala en todo lo que toques)

| Concepto | Usar | No usar |
|---|---|---|
| Lo que el productor compra | **insumo** | "producto comercial", "productos comerciales que usas como insumos" |
| Crear un registro (producto, ingrediente, insumo) | Título "Nuevo X"; botón "**Crear X**" | "Guardar X" al crear, "Registrar X", "Registrar primer X" (usa "Crear tu primer X") |
| Guardar cambios en un registro existente | "**Guardar cambios**" | "Guardar producto" al editar |
| Iniciar una elaboración | Botón y diálogo "**Nueva elaboración**"; botón del diálogo "**Crear borrador**" | "Registrar elaboración" |
| Página de la elaboración | Título "Elaboración E-001" + insignia de estado; miga "Elaboración" | "Registro de elaboración" como título |
| Crear un insumo desde una línea | "**Crear insumo**" | "Registrar insumo nuevo", "Registrar insumo" |
| Lote ya cargado antes | "**Lote existente**" (radio) y "Elige el lote" (selector) | "Lote registrado" |
| Estado de revisión de alérgenos | "**Alérgenos sin revisar**" y "**Alérgenos revisados**"; si no tiene: "**Sin alérgenos (revisado)**" | otras variantes |
| Estado de una línea del registro | "Lista", "Falta el insumo", "Falta el lote", "**Falta revisar alérgenos**" | "Completo" mientras falten alérgenos por revisar |
| Mensajes de éxito | Breves, sin "correctamente": "Insumo creado.", "Cambios guardados.", "Borrador guardado." | "… correctamente." |
| Saludo | "**Hola, {nombre}**" (neutro) | "Bienvenida" o "Bienvenido" fijos |
| Etiquetas | Mayúscula inicial ("Código interno") | MAYÚSCULAS con espaciado, salvo el encabezado de grupo del menú |

Los mensajes de error dicen qué pasó y qué hacer. Por ejemplo: "No pudimos guardar el insumo. Revisa tu conexión e inténtalo de nuevo."

---

## 4. Bloques

### Bloque 0 — Correcciones de HU13 detectadas en la auditoría

Estos son defectos de HU13 que se encontraron después de su merge. Van en esta rama, en un commit propio con el prefijo `fix(HU13)`.

1. **Duplicado de otro ingrediente en el diálogo de la elaboración.**
   - Al buscar un código que ya pertenece a un insumo de **otro** ingrediente, hoy aparece "Ya tienes este insumo registrado" con el botón "Usar este insumo", y esa acción no asigna nada.
   - Debe explicar que ese insumo está asociado a «X» y no ofrecer "Usar este insumo", como especificó T13-05.
   - Revisa por qué la prueba de T13-05 no lo detectó y corrígela.
2. **Foco perdido.** En ese mismo diálogo, después de buscar un código el foco pasa a `BODY`. Debe quedar en el mensaje del resultado o en el primer campo precargado.

### Bloque 1 — La acción principal siempre al alcance (crítico)

1. **Barra de acciones que no flota.**
   - **Causa (verificada):** `FormActions` usa `sticky bottom-0`, pero su ancestro `main` tiene `overflow-y-auto`. Como `main` crece con el contenido y nunca hace scroll propio, el `sticky` no tiene efecto y la barra queda al final de la página.
   - **Corrección:** que la barra quede fija al borde inferior de la ventana mientras el final del formulario no se ve. Aplica a todos los formularios que usan `FormActions`.
   - **Revisa los efectos colaterales en el layout:** el scroll del menú, el encabezado y los diálogos.
2. **Barra del registro de elaboración.**
   - Contiene solo "Guardar borrador" (secundario) y "Finalizar elaboración" (principal), lado a lado también en el celular.
   - "Volver al producto" sale de la barra: quedan las migas y un enlace "Volver" en el encabezado, con la misma protección de cambios sin guardar.
   - "Eliminar borrador" va al final de la página, en una sección separada y con color de error. Mantiene la confirmación.
3. **Progreso del registro.**
   - Bajo "Ingredientes", el texto "Faltan 3 de 5 ingredientes" (o "Todos los ingredientes están listos"), con `aria-live`.
   - El estado de cada línea usa el vocabulario de la sección 3. Una línea con alérgenos sin revisar **no** dice "Lista".
4. **Ir al problema.**
   - Si la finalización falla, la vista se desplaza a la primera línea con problema y el foco queda en ella. El desplazamiento es suave, salvo con `prefers-reduced-motion`.
   - Al cerrar la confirmación de finalizar, el foco vuelve al botón que la abrió. Hoy cae en `BODY`.
5. **Radios de lote:** los 3 radios (Lote nuevo, Lote existente, Sin lote) van en línea cuando hay espacio, y apilados solo si no caben.

### Bloque 2 — Detalle del producto, Dashboard y menú

1. **Detalle del producto.**
   - En el encabezado, "Nueva elaboración" (principal) y "Editar producto".
   - "Volver a productos" deja de ir encima de la acción principal en el celular: quedan las migas.
   - Orden de las secciones: un bloque superior con la imagen y la información general, en dos columnas en escritorio. Si no hay imagen, una franja baja con "Sin imagen", no un recuadro de 280 px. Después vienen Formulación y Elaboraciones; luego Presentación, Categorías e Información comercial; y al final "Eliminar producto".
   - El costo y el precio se muestran con el formato de moneda, como en el formulario.
   - La tarjeta de eliminar dice una sola vez que la trazabilidad se conserva.
2. **Dashboard.**
   - **Acción principal:** "Nueva elaboración". **Secundarias:** "Nuevo insumo" y "Nuevo producto". "Nuevo ingrediente" sale del encabezado.
   - **Saludo:** "Hola, {nombre}". La fecha va en minúscula ("Miércoles, 21 de octubre").
   - **Texto de bienvenida:** "Registra tus elaboraciones, insumos y alérgenos, y mantén tu catálogo al día."
   - **Tarjetas de cifras:** son enlaces. "Ingredientes" se reemplaza por "Insumos con alérgenos sin revisar", que lleva al listado de insumos filtrado. Si la cifra es 0, la tarjeta lo dice en tono positivo.
   - **"Primeros pasos":** el paso 3 pasa a ser "Registra tu primera elaboración" y se marca hecho cuando existe una elaboración. El progreso se calcula con datos reales.
   - **"Continuar" y "Completar":** área táctil de 44 px (la fila completa es el enlace).
3. **Menú.**
   - Oculta "Elaboraciones" y "Elaboraciones relacionadas" ("Pronto") y su encabezado "Trazabilidad". Deja un comentario indicando que se reactivan con HU06 y HU08.
   - En el registro y en el detalle de una elaboración, ninguna sección queda marcada como activa.
4. **Listado de insumos:** filtro "Alérgenos sin revisar", que también usa el Dashboard. Filtra en el cliente con el campo `alergenos_revisados`.

### Bloque 3 — Registrar un insumo

1. **Nuevo insumo con el formulario vacío.**
   - "Escanear código de barras" es la acción principal: botón relleno y de todo el ancho en el celular.
   - Las ayudas dicen que también se puede escribir el número.
2. **Después de encontrar el producto.**
   - Se muestra un resumen junto al formulario, por ejemplo: "Encontrado: Lonco Leche · sugerimos Leche".
   - La vista se desplaza al inicio del formulario precargado.
3. **Alérgenos en el formulario y en el detalle.**
   - No se muestran dos mensajes "No hay alérgenos declarados como …" mientras la lista esté vacía. Basta una frase y "Agregar alérgeno".
   - La casilla "Este insumo no contiene alérgenos" tiene un área táctil de 44 px.
4. **Detalle del insumo.**
   - Se quita la sección "Estado", que solo repite la insignia.
   - Los botones de cada alérgeno ("Pasar a Puede contener" y "Quitar") tienen 44 px y no quedan pegados. Pueden agruparse en un menú de acciones.
   - "el productor los confirmó" pasa a "confirmaste estos datos al crear el insumo".
5. **Diálogo "Crear insumo" desde la elaboración.**
   - La descripción aclara que el insumo se crea al instante y que su asignación a la línea se guarda con el borrador.
   - El foco no se pierde al buscar un código.

### Bloque 4 — Textos, tamaños y consistencia

1. **Vocabulario:** aplica la sección 3 en todas las pantallas, diálogos, estados vacíos y mensajes, incluidos:
   - los pasos de los estados vacíos (por ejemplo, el de insumos menciona el escaneo, y el de productos ya no habla de "vincular ingredientes y lotes");
   - el texto del detalle del ingrediente, que hoy contradice dónde se declaran los alérgenos: los de la elaboración salen de los insumos, y los del ingrediente son de referencia.
2. **Etiquetas:** pasa las etiquetas en MAYÚSCULAS con espaciado a mayúscula inicial. Son 21 usos en 15 archivos. Se exceptúan los encabezados de grupo del menú. Nada de texto menor a 12 px; por ejemplo, las insignias "Activo" y "Rotulación obligatoria".
3. **Áreas táctiles:** los enlaces "Ver" de las listas (producto, ingrediente, insumo) ocupan la fila o la tarjeta completa. Lo mismo para las migas y los campos (`min-h-11`).
4. **Registro de cuenta:** "Te damos la bienvenida a TrazApp, {nombre}" (neutro). "Nombre del negocio" va igual en el registro y en el perfil.
5. **Foco inicial del diálogo "Nuevo ingrediente":** en el primer campo visible.

---

## 5. Fuera de alcance

- Listado global de elaboraciones (HU06).
- Elaboraciones relacionadas (HU08).
- Imprimir o compartir una elaboración (HU10).
- Cambiar la contraseña desde el perfil.
- Iniciar sesión automáticamente después de crear la cuenta.
- Modo oscuro: solo se verifica que nada se rompa.
- Cualquier cambio de backend.
