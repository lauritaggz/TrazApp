/**
 * Un elemento de la línea de datos del insumo («$precio / contenido · Fuente · fecha · Editar insumo · …»).
 *
 * El separador «·» es del elemento que SIGUE: se dibuja a su izquierda, centrado en un hueco de 20 px, así que queda con el mismo espacio a ambos lados («1 kg · Jumbo · 18 nov 2026»). La línea va dentro de un contenedor con
 * `overflow-hidden` y un margen izquierdo negativo (`-ml-5`) que esconde el separador del primer elemento de cada
 * renglón, así nunca queda un «·» colgando al final de una línea cuando el resto baja al renglón siguiente.
 */
export const ELEMENTO_DE_DATOS =
  "relative inline-flex items-center pl-5 before:absolute before:left-0 before:top-1/2 before:w-5 before:-translate-y-1/2 before:text-center before:text-text-muted before:content-['·']";
