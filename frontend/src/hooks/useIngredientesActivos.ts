import { useCallback, useEffect, useState } from "react";
import { listIngredients } from "@/services/ingredientService";
import type { Ingrediente } from "@/types/ingredient";

const LOAD_ERROR = "No pudimos cargar tus ingredientes.";

/** Active ingredients of the productor (the API only returns active ones), by name. */
export function useIngredientesActivos() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listIngredients();
      setIngredientes(
        [...data].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })),
      );
    } catch {
      setIngredientes([]);
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ingredientes, loading, error, reload: load };
}
