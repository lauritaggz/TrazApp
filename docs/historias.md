# A3 · Historias de usuario con criterios de aceptación

Escenarios en formato Dado/Cuando/Entonces de cada historia del MVP, redactados a partir de los criterios de aceptación del Product Backlog (informe, sección 13 y planificación de cada sprint). Cada historia tiene al menos un escenario principal y uno negativo o de borde. La lista completa de criterios está en el ticket de Taiga de cada historia.

La aprobación del stakeholder se registra en el ticket de cada historia, con nombre, rol y fecha.

## HU01 — Gestión de productos (RF-01)

**Escenario: registrar un producto**
- **Dado** que el productor ha iniciado sesión
- **Cuando** registra un producto con código interno, nombre, descripción, contenido neto y unidad de medida
- **Entonces** el producto queda en su listado y disponible para asociarle una formulación

**Escenario: código interno repetido**
- **Dado** que el productor ya tiene un producto con el código interno «PAN-01»
- **Cuando** intenta registrar otro producto con el mismo código
- **Entonces** el sistema rechaza el registro e indica que el código ya existe

## HU02 — Gestión de ingredientes y composición (RF-02)

**Escenario: registrar un ingrediente compuesto**
- **Dado** que el productor ha iniciado sesión
- **Cuando** registra un ingrediente compuesto con sus componentes declarados y sus alérgenos
- **Entonces** el ingrediente queda registrado con su composición

**Escenario: ingrediente desactivado**
- **Dado** que el productor desactivó un ingrediente
- **Cuando** intenta asociarlo a una formulación
- **Entonces** el sistema no lo ofrece para nuevas asociaciones y conserva sus relaciones históricas

## HU03 — Gestión de formulación y versiones del producto (RF-03)

**Escenario: cambiar una formulación ya utilizada**
- **Dado** que la formulación vigente de un producto se usó en una elaboración
- **Cuando** el productor la modifica
- **Entonces** el sistema crea una nueva versión del producto, que pasa a ser la vigente, y la versión anterior no cambia

**Escenario: cambiar una formulación sin uso**
- **Dado** que ninguna elaboración usa la formulación vigente
- **Cuando** el productor la modifica
- **Entonces** el cambio se aplica sin crear una nueva versión

**Escenario: ingrediente repetido**
- **Dado** que la formulación ya incluye «harina»
- **Cuando** el productor intenta agregar «harina» de nuevo
- **Entonces** el sistema lo rechaza

## HU04 — Gestión de insumos comerciales (RF-04)

**Escenario: registrar un insumo con alérgenos**
- **Dado** que el productor tiene el ingrediente «chocolate»
- **Cuando** registra el insumo «Chocolate Ambrosoli 500 g» con sus alérgenos del catálogo, indicando si los contiene o puede contenerlos
- **Entonces** el insumo queda asociado al ingrediente con sus alérgenos y su tipo

**Escenario: código de barras repetido**
- **Dado** que el productor ya tiene un insumo con un código de barras
- **Cuando** intenta registrar otro insumo con el mismo código
- **Entonces** el sistema lo rechaza

## HU07 — Recuperación de información de insumos (RF-05)

**Escenario: buscar un insumo por nombre**
- **Dado** que el productor está registrando un insumo
- **Cuando** busca «pan de molde» por nombre y selecciona un resultado
- **Entonces** el formulario se precarga con ingredientes, alérgenos y advertencias, indicando la fuente de cada dato, y nada se registra hasta que el productor confirma

**Escenario: la fuente no responde**
- **Dado** que la fuente externa no está disponible
- **Cuando** el productor busca un producto
- **Entonces** el sistema informa que no se pudo consultar y permite el ingreso manual

## HU13 — Búsqueda de insumos mediante código de barras (RF-06)

**Escenario: escanear un código de barras**
- **Dado** que el productor abrió el escáner desde el registro de un insumo
- **Cuando** la cámara reconoce un código EAN-13
- **Entonces** el sistema busca el producto, precarga la ficha y detiene la cámara

**Escenario: cámara no disponible**
- **Dado** que el navegador no permite el acceso a la cámara o el productor lo deniega
- **Cuando** el productor intenta escanear
- **Entonces** el sistema lo informa y ofrece ingresar el número del código a mano

## HU05 — Registro de elaboración (RF-07)

**Escenario: finalizar una elaboración completa**
- **Dado** que cada ingrediente de la elaboración tiene un insumo activo, un lote o la indicación «sin lote», y alérgenos revisados
- **Cuando** el productor la finaliza y confirma
- **Entonces** el sistema conserva una copia de la información de cada insumo y la elaboración ya no puede modificarse ni eliminarse

**Escenario: falta un insumo**
- **Dado** que un ingrediente de la elaboración no tiene insumo asignado
- **Cuando** el productor intenta finalizarla
- **Entonces** el sistema lo impide e indica qué falta en ese ingrediente

**Escenario: modificar un insumo después de finalizar**
- **Dado** que una elaboración está finalizada
- **Cuando** el productor modifica o desactiva uno de sus insumos
- **Entonces** la elaboración sigue mostrando la información conservada

## HU06 — Consulta del historial de elaboraciones (RF-08)

**Escenario: consultar el detalle de una elaboración finalizada**
- **Dado** que una elaboración finalizada usó un insumo que después se modificó
- **Cuando** el productor abre su detalle
- **Entonces** ve la versión del producto y, por ingrediente, el insumo, su marca, su lote y sus alérgenos tal como se conservaron

**Escenario: elaboración de otro productor**
- **Dado** que una elaboración pertenece a otro productor
- **Cuando** el productor intenta consultarla
- **Entonces** el sistema no la muestra

## HU08 — Identificación de elaboraciones relacionadas (RF-09)

**Escenario: elaboraciones que usaron un lote**
- **Dado** que el lote L-42 de un insumo se usó en dos elaboraciones
- **Cuando** el productor consulta las elaboraciones relacionadas con ese lote
- **Entonces** el resultado muestra esas dos elaboraciones con su producto, fecha, código, estado y visibilidad

**Escenario: elaboraciones que no usaron el insumo**
- **Dado** que una elaboración no usó el insumo consultado
- **Cuando** el productor consulta las elaboraciones relacionadas con ese insumo
- **Entonces** esa elaboración no aparece en el resultado

## HU09 — Habilitar publicación del producto (RF-10)

**Escenario: publicar un producto**
- **Dado** que el producto tiene formulación y al menos una elaboración finalizada
- **Cuando** el productor habilita su publicación
- **Entonces** puede descargar el código QR del producto, que es único y permanente

**Escenario: producto sin elaboración finalizada**
- **Dado** que el producto no tiene elaboraciones finalizadas
- **Cuando** el productor intenta publicarlo
- **Entonces** el sistema no lo permite e indica por qué

## HU10 — Consulta pública mediante QR (RF-11)

**Escenario: consultar la ficha pública**
- **Dado** que un producto está publicado
- **Cuando** el consumidor escanea su QR sin registrarse
- **Entonces** ve la elaboración finalizada y visible más reciente, con sus insumos y los alérgenos agrupados en «contiene» y «puede contener»

**Escenario: la información conservada no cambia**
- **Dado** que un insumo de la elaboración se modificó después de finalizarla
- **Cuando** el consumidor consulta la ficha
- **Entonces** ve la información conservada, no la vigente (PT10-08)

**Escenario: sin información interna**
- **Dado** que la elaboración tiene lotes, vencimientos y costos registrados
- **Cuando** el consumidor consulta la ficha
- **Entonces** la respuesta no contiene ninguno de esos datos (PT10-09)

## HU11 — Evaluación de utilidad de la información (RF-12)

**Escenario: responder la evaluación**
- **Dado** que el consumidor está viendo la ficha de una elaboración
- **Cuando** responde «Sí» a «¿Esta información te resultó útil?»
- **Entonces** la respuesta queda asociada al producto y a la elaboración, sin identificar al consumidor

**Escenario: segunda respuesta en la misma consulta**
- **Dado** que el consumidor ya respondió en esta consulta
- **Cuando** intenta responder otra vez
- **Entonces** el sistema no registra una segunda respuesta

## HU12 — Registro y acceso del productor (RF-13)

**Escenario: iniciar sesión**
- **Dado** que el productor tiene una cuenta
- **Cuando** inicia sesión con credenciales válidas
- **Entonces** accede a su espacio privado de gestión

**Escenario: credenciales inválidas**
- **Dado** que el productor ingresa una contraseña incorrecta
- **Cuando** intenta iniciar sesión
- **Entonces** el sistema no le da acceso

**Escenario: acceso sin sesión**
- **Dado** que no hay una sesión iniciada
- **Cuando** se intenta acceder a una funcionalidad privada
- **Entonces** el sistema lo rechaza

## HU14 — Calculadora de costos del producto (RF-14)

**Escenario: calcular el costo de una tanda**
- **Dado** que el producto tiene formulación vigente y sus insumos tienen precio y contenido
- **Cuando** el productor ingresa la cantidad de cada ingrediente por tanda y sus otros costos
- **Entonces** el sistema calcula el costo por tanda y por unidad, sin crear versiones ni modificar elaboraciones

**Escenario: unidades de distinta magnitud**
- **Dado** que un ingrediente se expresa en gramos y su insumo en mililitros
- **Cuando** el productor calcula el costo
- **Entonces** el sistema no convierte entre magnitudes distintas e indica que falta información en esa línea
