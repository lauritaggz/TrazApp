import { useState, type FormEvent } from "react";
import { IconoCalendario } from "@/components/fichaPublica/iconosPublicos";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { formatearFecha } from "@/lib/fichaPublicaFormato";
import type { ElaboracionResumenPublica } from "@/types/consultaPublica";

interface BusquedaProps {
  codigoInicial: string;
  fechaInicial: string;
  onBuscarCodigo: (codigo: string) => void;
  onBuscarFecha: (fecha: string) => void;
}

function Busqueda({ codigoInicial, fechaInicial, onBuscarCodigo, onBuscarFecha }: BusquedaProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [fecha, setFecha] = useState(fechaInicial);

  function buscarCodigo(evento: FormEvent) {
    evento.preventDefault();
    if (codigo.trim()) onBuscarCodigo(codigo.trim());
  }

  function buscarFecha(evento: FormEvent) {
    evento.preventDefault();
    if (fecha) onBuscarFecha(fecha);
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-3 text-sm font-medium text-text-primary">¿No la encuentras en la lista? Búscala</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={buscarCodigo} className="flex items-end gap-2" aria-label="Buscar por código">
          <div className="min-w-0 flex-1">
            <Input
              label="Código de la elaboración"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!codigo.trim()} aria-label="Buscar por código">
            Buscar
          </Button>
        </form>
        <form onSubmit={buscarFecha} className="flex items-end gap-2" aria-label="Buscar por fecha">
          <div className="min-w-0 flex-1">
            <Input
              type="date"
              label="Fecha de elaboración"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!fecha} aria-label="Buscar por fecha">
            Buscar
          </Button>
        </form>
      </div>
    </div>
  );
}

interface SelectorElaboracionProps {
  elaboraciones: ElaboracionResumenPublica[];
  /** Code of the elaboración being shown, or "" when none is (not found, several...). */
  codigoActual: string;
  codigoEnUrl: string;
  fechaEnUrl: string;
  onElegir: (codigo: string) => void;
  onBuscarCodigo: (codigo: string) => void;
  onBuscarFecha: (fecha: string) => void;
}

/** "Which elaboración do you have?": the list of visible ones, plus search by code or by date. */
export default function SelectorElaboracion({
  elaboraciones,
  codigoActual,
  codigoEnUrl,
  fechaEnUrl,
  onElegir,
  onBuscarCodigo,
  onBuscarFecha,
}: SelectorElaboracionProps) {
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-accent">
          <IconoCalendario />
        </span>
        <p className="text-sm text-text-secondary">
          Busca en el envase el código o la fecha de elaboración.
        </p>
      </div>
      <Select
        label="¿Qué elaboración tienes?"
        value={codigoActual}
        onChange={(e) => onElegir(e.target.value)}
      >
        {codigoActual === "" && (
          <option value="" disabled>
            Elige una elaboración
          </option>
        )}
        {elaboraciones.map((elaboracion) => (
          <option key={elaboracion.codigo} value={elaboracion.codigo}>
            {elaboracion.codigo} · {formatearFecha(elaboracion.fecha)}
          </option>
        ))}
      </Select>
      <Busqueda
        key={`${codigoEnUrl}|${fechaEnUrl}`}
        codigoInicial={codigoEnUrl}
        fechaInicial={fechaEnUrl}
        onBuscarCodigo={onBuscarCodigo}
        onBuscarFecha={onBuscarFecha}
      />
    </section>
  );
}
