import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import FichaPublica from "@/pages/FichaPublica";
import { renderWithProviders } from "@/test/testUtils";

/** Shows the query string and offers a Back button, to check the selection lives in the URL. */
function Sonda() {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  return (
    <div>
      <p aria-label="búsqueda en la URL">{ubicacion.search}</p>
      <button type="button" onClick={() => navegar(-1)}>
        Atrás del navegador
      </button>
    </div>
  );
}

export function renderFicha(entrada = "/p/tok123") {
  return renderWithProviders(
    <Routes>
      <Route
        path="/p/:idPublico"
        element={
          <>
            <FichaPublica />
            <Sonda />
          </>
        }
      />
    </Routes>,
    { initialEntries: [entrada] },
  );
}
