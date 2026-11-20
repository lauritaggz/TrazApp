/**
 * Browser memory of «ya respondí» for one (public id, elaboración code) pair (HU11, D1).
 *
 * It is only a mark: the answer itself (Sí/No) or anything else is never stored. It does not identify
 * anyone and it is not a guarantee (another browser or a private window starts clean). Every access
 * is guarded: if storage is blocked or full, the question works exactly the same.
 */
const PREFIJO = "trazapp:evaluado:";

const normalizar = (codigo: string) => codigo.trim().toUpperCase();
const clave = (idPublico: string, codigo: string) => `${PREFIJO}${idPublico}:${normalizar(codigo)}`;

export function yaEvaluado(idPublico: string, codigo: string): boolean {
  try {
    return window.localStorage.getItem(clave(idPublico, codigo)) !== null;
  } catch {
    return false;
  }
}

export function marcarEvaluado(idPublico: string, codigo: string): void {
  try {
    window.localStorage.setItem(clave(idPublico, codigo), "1");
  } catch {
    // Blocked storage: nothing to do, the question still works.
  }
}
