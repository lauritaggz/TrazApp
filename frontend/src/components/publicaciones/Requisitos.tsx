import { Link } from "react-router-dom";
import type { RequisitoPublicacion } from "@/types/product";

export const ID_SECCION_FORMULACION = "product-detail-formulation";

const ESTILO_ENLACE =
  "inline-flex min-h-11 items-center text-left text-sm font-medium underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Where the action that fixes each requisito is. The same links everywhere (list, detail, product). */
export function rutaDeRequisito(requisito: RequisitoPublicacion, productoId: number): string {
  return requisito === "sin_formulacion"
    ? `/productos/${productoId}#${ID_SECCION_FORMULACION}`
    : `/elaboraciones?producto=${productoId}`;
}

export function RequisitoEnlace({ requisito, productoId }: { requisito: string; productoId: number }) {
  const conocido = requisito as RequisitoPublicacion;
  if (conocido === "sin_formulacion") {
    return (
      <Link to={rutaDeRequisito(conocido, productoId)} className={ESTILO_ENLACE}>
        Falta la formulación: defínela en el producto
      </Link>
    );
  }
  if (conocido === "sin_elaboracion_finalizada") {
    return (
      <Link to={rutaDeRequisito(conocido, productoId)} className={ESTILO_ENLACE}>
        Falta una elaboración finalizada: registra y finaliza una
      </Link>
    );
  }
  return <span className="text-sm">Hay un requisito pendiente.</span>;
}

/** Every requisito the API says is missing, each with the link to its action. */
export function RequisitosFaltantes({ faltantes, productoId }: { faltantes: string[]; productoId: number }) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-warning"
    >
      <p className="text-sm font-semibold">Este producto todavía no se puede publicar</p>
      <ul className="space-y-1">
        {faltantes.map((requisito) => (
          <li key={requisito}>
            <RequisitoEnlace requisito={requisito} productoId={productoId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
