import EtiquetaOculta from "@/components/elaboraciones/EtiquetaOculta";
import Badge from "@/components/ui/Badge";
import type { EstadoElaboracion } from "@/types/elaboracion";
import type { LoteEstado } from "@/types/relacionadas";

/** «Borrador» / «Finalizada»: always with text, never only a color. */
export function EtiquetaEstado({ estado }: { estado: EstadoElaboracion }) {
  return estado === "borrador" ? (
    <Badge variant="warning">Borrador</Badge>
  ) : (
    <Badge variant="success">Finalizada</Badge>
  );
}

/** Whether the product of the elaboración is published (its public consultation is enabled). */
export function EtiquetaPublicacion({ publicado }: { publicado: boolean }) {
  return publicado ? (
    <Badge variant="brand" title="El producto tiene su consulta pública habilitada">
      Publicado
    </Badge>
  ) : (
    <Badge variant="neutral" title="El producto no tiene su consulta pública habilitada">
      No publicado
    </Badge>
  );
}

/** The two labels of a use whose lot is not a lot: «Sin lote registrado» and «Lote pendiente». */
export function EtiquetaSinLote({ estado }: { estado: Exclude<LoteEstado, "con_lote"> }) {
  return estado === "sin_lote" ? (
    <Badge variant="warning" title="La elaboración registró este insumo sin lote">
      Sin lote registrado
    </Badge>
  ) : (
    <Badge variant="warning" title="El borrador todavía no define el lote de este insumo">
      Lote pendiente
    </Badge>
  );
}

export { EtiquetaOculta };
