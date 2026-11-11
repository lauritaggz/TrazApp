/** Says the elaboración was made with an earlier recipe. Never shows a version number (CA6). */
export default function NotaVersionAnterior() {
  return (
    <aside
      aria-label="Receta anterior"
      className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4"
    >
      <p className="text-sm font-semibold text-text-primary">
        Esta elaboración se hizo con una receta anterior a la actual
      </p>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
        La información que ves corresponde a cómo se preparó esta elaboración y puede ser distinta de la receta actual del
        producto.
      </p>
    </aside>
  );
}
