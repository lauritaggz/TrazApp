import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Status = "Finalizada" | "Borrador";

type IngredientSnapshot = {
  ingredient: string;
  supply: string;
  brand: string;
  lot: string | null;
  expiry: string | null;
  declaredIngredients: string;
  allergens: string[];
};

type Elaboration = {
  id: number;
  code: string;
  product: string;
  productVersion: string;
  date: string;
  dateLabel: string;
  status: Status;
  published: boolean;
  hidden: boolean;
  units: number | null;
  ingredients: IngredientSnapshot[];
};

const ELABORATIONS: Elaboration[] = [
  {
    id: 1,
    code: "ELAB-250320-01",
    product: "Queso crema artesanal",
    productVersion: "Versión 3 · 10 mar 2025",
    date: "2025-03-20",
    dateLabel: "20 mar 2025",
    status: "Finalizada",
    published: true,
    hidden: false,
    units: 25,
    ingredients: [
      { ingredient: "Leche", supply: "Leche entera", brand: "Colun", lot: "LC-0320-A", expiry: "02 abr 2025", declaredIngredients: "Leche entera pasteurizada", allergens: ["Leche"] },
      { ingredient: "Sal", supply: "Sal fina", brand: "Lobos", lot: null, expiry: null, declaredIngredients: "Cloruro de sodio, yodo", allergens: [] },
      { ingredient: "Cultivo láctico", supply: "Cultivo mesófilo", brand: "Chr. Hansen", lot: "CH-8841", expiry: "30 jun 2025", declaredIngredients: "Cultivos lácticos, maltodextrina", allergens: ["Leche"] },
    ],
  },
  {
    id: 2,
    code: "ELAB-250318-04",
    product: "Pan de campo integral",
    productVersion: "Versión 5 · 14 mar 2025",
    date: "2025-03-18",
    dateLabel: "18 mar 2025",
    status: "Finalizada",
    published: false,
    hidden: false,
    units: 36,
    ingredients: [
      { ingredient: "Harina de trigo", supply: "Harina Selecta sin polvos", brand: "Selecta", lot: "HS-240315", expiry: "15 sep 2025", declaredIngredients: "Harina de trigo fortificada", allergens: ["Gluten"] },
      { ingredient: "Sal", supply: "Sal fina", brand: "Lobos", lot: null, expiry: null, declaredIngredients: "Cloruro de sodio, yodo", allergens: [] },
      { ingredient: "Semillas de lino", supply: "Lino dorado", brand: "Semillas del Sur", lot: "LD-0312", expiry: "12 dic 2025", declaredIngredients: "Semillas de lino", allergens: ["Puede contener sésamo"] },
    ],
  },
  {
    id: 3,
    code: "ELAB-250316-02",
    product: "Mermelada de frutilla",
    productVersion: "Versión 2 · 01 mar 2025",
    date: "2025-03-16",
    dateLabel: "16 mar 2025",
    status: "Borrador",
    published: true,
    hidden: true,
    units: null,
    ingredients: [
      { ingredient: "Azúcar", supply: "Azúcar granulada", brand: "Iansa", lot: "AG-98214", expiry: "18 ene 2027", declaredIngredients: "Azúcar", allergens: [] },
      { ingredient: "Pectina", supply: "Pectina cítrica", brand: "Gastronómica Sur", lot: null, expiry: null, declaredIngredients: "Pectina cítrica, dextrosa", allergens: [] },
    ],
  },
  {
    id: 4,
    code: "ELAB-250312-02",
    product: "Pan de campo integral",
    productVersion: "Versión 4 · 02 mar 2025",
    date: "2025-03-12",
    dateLabel: "12 mar 2025",
    status: "Finalizada",
    published: false,
    hidden: true,
    units: 32,
    ingredients: [
      { ingredient: "Harina de trigo", supply: "Harina Selecta sin polvos", brand: "Selecta", lot: "HS-240315", expiry: "15 sep 2025", declaredIngredients: "Harina de trigo fortificada", allergens: ["Gluten"] },
      { ingredient: "Sal", supply: "Sal fina", brand: "Lobos", lot: "SL-9902", expiry: "08 nov 2027", declaredIngredients: "Cloruro de sodio, yodo", allergens: [] },
    ],
  },
  {
    id: 5,
    code: "ELAB-250306-01",
    product: "Galletas de avena",
    productVersion: "Versión 1 · 20 feb 2025",
    date: "2025-03-06",
    dateLabel: "06 mar 2025",
    status: "Finalizada",
    published: true,
    hidden: false,
    units: 60,
    ingredients: [
      { ingredient: "Harina de trigo", supply: "Harina Selecta sin polvos", brand: "Selecta", lot: "HS-240228", expiry: "28 ago 2025", declaredIngredients: "Harina de trigo fortificada", allergens: ["Gluten"] },
      { ingredient: "Azúcar", supply: "Azúcar granulada", brand: "Iansa", lot: "AG-98214", expiry: "18 ene 2027", declaredIngredients: "Azúcar", allergens: [] },
    ],
  },
];

const PRODUCTS = [...new Set(ELABORATIONS.map((item) => item.product))];
const SUPPLIES = [...new Set(ELABORATIONS.flatMap((item) => item.ingredients.map((ingredient) => ingredient.supply)))];

export default function Elaborations() {
  const [tab, setTab] = useState<"history" | "related">("history");
  const [selected, setSelected] = useState<Elaboration | null>(null);

  if (selected) return <ElaborationDetail elaboration={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-6">
        <div>
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">Gestión</p>
          <p className="text-2xl font-semibold text-text-primary">Elaboraciones</p>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">Consulta el historial de producción o rastrea rápidamente dónde se utilizó un insumo.</p>
        </div>
        <div className="inline-flex self-start rounded-xl border border-border bg-card p-1 shadow-sm" role="tablist" aria-label="Vistas de elaboraciones">
          <Button variant="ghost" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={`!px-3.5 !py-2 ${tab === "history" ? "bg-brand-50 text-brand-700" : "text-text-secondary hover:text-text-primary hover:bg-surface"}`}>
            <HistoryIcon /> Historial
          </Button>
          <Button variant="ghost" role="tab" aria-selected={tab === "related"} onClick={() => setTab("related")} className={`!px-3.5 !py-2 ${tab === "related" ? "bg-brand-50 text-brand-700" : "text-text-secondary hover:text-text-primary hover:bg-surface"}`}>
            <TraceIcon /> Rastrear insumo
          </Button>
        </div>
      </div>

      {tab === "history"
        ? <HistoryView onOpen={setSelected} />
        : <RelatedView onOpen={setSelected} />}
    </div>
  );
}

function HistoryView({ onOpen }: { onOpen: (elaboration: Elaboration) => void }) {
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("Todos");
  const [status, setStatus] = useState<"Todos" | Status>("Todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => ELABORATIONS.filter((item) => {
    const matchesQuery = `${item.code} ${item.product}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery
      && (product === "Todos" || item.product === product)
      && (status === "Todos" || item.status === status)
      && (!from || item.date >= from)
      && (!to || item.date <= to);
  }), [from, product, query, status, to]);

  const hasFilters = query || product !== "Todos" || status !== "Todos" || from || to;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric value={ELABORATIONS.length} label="Elaboraciones totales" icon={<LayersIcon />} />
        <Metric value={ELABORATIONS.filter((item) => item.status === "Finalizada").length} label="Finalizadas" icon={<CheckIcon />} positive />
        <Metric value={ELABORATIONS.filter((item) => item.status === "Borrador").length} label="En borrador" icon={<EditIcon />} />
        <Metric value={PRODUCTS.length} label="Productos elaborados" icon={<PackageIcon />} />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-visible">
        <div className="p-4 sm:p-5 border-b border-border">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código de elaboración" aria-label="Buscar elaboración por código" leftIcon={<SearchIcon />} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
              <FilterMenu label="Producto" value={product} options={["Todos", ...PRODUCTS]} onChange={setProduct} />
              <FilterMenu label="Estado" value={status} options={["Todos", "Finalizada", "Borrador"]} onChange={(value) => setStatus(value as "Todos" | Status)} />
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Fecha desde" title="Fecha desde" className="min-w-0 lg:w-36" />
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Fecha hasta" title="Fecha hasta" className="min-w-0 lg:w-36" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-xs text-text-secondary">{filtered.length} {filtered.length === 1 ? "elaboración encontrada" : "elaboraciones encontradas"}</p>
            {hasFilters && (
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => { setQuery(""); setProduct("Todos"); setStatus("Todos"); setFrom(""); setTo(""); }}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((item) => <ElaborationRow key={item.id} elaboration={item} onOpen={() => onOpen(item)} />)}
          {filtered.length === 0 && <EmptyState title="No hay elaboraciones con esos filtros" detail="Prueba ampliando el rango de fechas o limpiando algún filtro." />}
        </div>
      </div>
    </>
  );
}

function RelatedView({ onOpen }: { onOpen: (elaboration: Elaboration) => void }) {
  const [supply, setSupply] = useState(SUPPLIES[0]);
  const [lot, setLot] = useState("");

  const related = useMemo(() => ELABORATIONS.filter((item) =>
    item.ingredients.some((ingredient) =>
      ingredient.supply === supply && (!lot || ingredient.lot?.toLowerCase().includes(lot.toLowerCase())),
    ),
  ), [lot, supply]);

  const usedWithoutLot = !lot && related.filter((item) => item.ingredients.some((ingredient) => ingredient.supply === supply && !ingredient.lot)).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
      <div className="space-y-5">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="h-10 w-10 rounded-lg bg-card text-brand-600 flex items-center justify-center shrink-0 border border-brand-100"><TraceIcon /></span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Trazabilidad inversa de insumos</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">Identifica todas las elaboraciones que podrían estar afectadas ante un problema informado por el fabricante.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)] gap-3 mt-5">
            <FilterMenu label="Insumo comercial" value={supply} options={SUPPLIES} onChange={(value) => { setSupply(value); setLot(""); }} full />
            <Input label="Lote específico (opcional)" value={lot} onChange={(event) => setLot(event.target.value)} placeholder="Ej. HS-240315" leftIcon={<TagIcon />} />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-text-primary">Elaboraciones relacionadas</p>
              <p className="text-xs text-text-secondary mt-0.5">{lot ? `Insumo ${supply} · lote “${lot}”` : `Todas las apariciones de ${supply}`}</p>
            </div>
            <span className="self-start rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 text-xs font-semibold">{related.length} resultados</span>
          </div>
          {usedWithoutLot > 0 && (
            <div className="mx-4 sm:mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 flex items-start gap-2.5">
              <span className="text-amber-700 mt-0.5"><AlertIcon /></span>
              <p className="text-xs text-amber-900"><strong>{usedWithoutLot}</strong> {usedWithoutLot === 1 ? "elaboración registra" : "elaboraciones registran"} este insumo sin lote.</p>
            </div>
          )}
          <div className="divide-y divide-border">
            {related.map((item) => {
              const match = item.ingredients.find((ingredient) => ingredient.supply === supply && (!lot || ingredient.lot?.toLowerCase().includes(lot.toLowerCase())));
              return <ElaborationRow key={item.id} elaboration={item} onOpen={() => onOpen(item)} lot={match?.lot ?? null} />;
            })}
            {related.length === 0 && <EmptyState title="No se encontraron elaboraciones relacionadas" detail="Verifica el código de lote o consulta todas las apariciones del insumo." />}
          </div>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-5">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-text-primary">Resumen de impacto</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <ImpactStat value={related.filter((item) => item.status === "Finalizada").length} label="Finalizadas" />
            <ImpactStat value={related.filter((item) => item.status === "Borrador").length} label="Borradores" />
            <ImpactStat value={related.filter((item) => item.published).length} label="Publicadas" />
            <ImpactStat value={related.filter((item) => item.hidden).length} label="Ocultas" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3">
          <span className="text-brand-600 mt-0.5"><LockIcon /></span>
          <div>
            <p className="text-xs font-semibold text-text-primary">Consulta segura</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">Esta vista es de solo lectura. Las elaboraciones finalizadas se consultan desde su copia histórica conservada.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ElaborationDetail({ elaboration, onBack }: { elaboration: Elaboration; onBack: () => void }) {
  return (
    <div className="max-w-6xl">
      <Button variant="ghost" className="!-ml-3 !px-3 mb-4" onClick={onBack}><ArrowLeftIcon /> Volver a Elaboraciones</Button>
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-5">
        <div className={`h-1.5 ${elaboration.status === "Finalizada" ? "bg-brand-600" : "bg-amber-400"}`} />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="h-12 w-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><LayersIcon large /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <p className="font-mono text-xs font-semibold text-brand-700">{elaboration.code}</p>
                  <StatusBadge status={elaboration.status} />
                  {elaboration.hidden && <VisibilityBadge hidden />}
                </div>
                <p className="text-2xl font-semibold text-text-primary">{elaboration.product}</p>
                <p className="text-sm text-text-secondary mt-1">{elaboration.dateLabel}{elaboration.units ? ` · ${elaboration.units} unidades` : ""}</p>
              </div>
            </div>
            <PublicationBadge published={elaboration.published} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
            <DetailField label="Código" value={elaboration.code} mono />
            <DetailField label="Estado" value={elaboration.status} />
            <DetailField label="Versión del producto" value={elaboration.productVersion} />
            <DetailField label="Visibilidad" value={elaboration.hidden ? "Oculta" : "Visible"} />
          </div>
        </div>
      </div>

      {elaboration.status === "Finalizada" && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5 mb-5 flex items-start gap-3">
          <span className="text-brand-600 mt-0.5"><LockIcon /></span>
          <div>
            <p className="text-xs font-semibold text-text-primary">Información histórica conservada</p>
            <p className="text-xs text-text-secondary mt-1">Estos datos corresponden al momento de la finalización y no cambian aunque se actualicen los insumos o el producto.</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-text-primary">Insumos utilizados</p>
          <p className="text-xs text-text-secondary mt-0.5">Detalle por ingrediente de la versión utilizada.</p>
        </div>
        <div className="divide-y divide-border">
          {elaboration.ingredients.map((ingredient, index) => <IngredientDetail key={`${ingredient.supply}-${index}`} ingredient={ingredient} index={index + 1} />)}
        </div>
      </div>
    </div>
  );
}

function IngredientDetail({ ingredient, index }: { ingredient: IngredientSnapshot; index: number }) {
  const [expanded, setExpanded] = useState(index === 1);
  return (
    <div>
      <Button variant="ghost" className="!rounded-none !justify-start !text-left w-full !px-4 sm:!px-5 !py-4 text-text-primary hover:bg-surface" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold flex items-center justify-center shrink-0">{index}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate">{ingredient.ingredient}</span>
          <span className="block text-xs font-normal text-text-secondary mt-0.5 truncate">{ingredient.supply} · {ingredient.brand}</span>
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-normal text-text-secondary">
          <TagIcon /> {ingredient.lot ?? "Sin lote"}
        </span>
        <ChevronIcon expanded={expanded} />
      </Button>
      {expanded && (
        <div className="bg-surface border-t border-border px-4 sm:px-5 py-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DetailField label="Insumo utilizado" value={ingredient.supply} />
            <DetailField label="Marca u origen" value={ingredient.brand} />
            <DetailField label="Lote" value={ingredient.lot ?? "Sin lote registrado"} mono={Boolean(ingredient.lot)} />
            <DetailField label="Vencimiento" value={ingredient.expiry ?? "No registrado"} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <DetailField label="Ingredientes declarados" value={ingredient.declaredIngredients} />
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Alérgenos declarados</p>
              <div className="flex flex-wrap gap-1.5">
                {ingredient.allergens.length > 0
                  ? ingredient.allergens.map((allergen) => <span key={allergen} className="rounded-full border border-red-200 bg-error-bg text-error px-2 py-0.5 text-[10px] font-semibold">{allergen}</span>)
                  : <span className="text-sm text-text-secondary">No declara alérgenos</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ElaborationRow({ elaboration, onOpen, lot }: { elaboration: Elaboration; onOpen: () => void; lot?: string | null }) {
  return (
    <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-surface transition-colors">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${elaboration.status === "Finalizada" ? "bg-brand-50 text-brand-600" : "bg-amber-50 text-amber-700"}`}>
          {elaboration.status === "Finalizada" ? <CheckIcon /> : <EditIcon />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{elaboration.product}</p>
            <StatusBadge status={elaboration.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <span className="font-mono text-[11px] font-medium text-text-secondary">{elaboration.code}</span>
            <span className="text-border">·</span>
            <span className="text-xs text-text-secondary">{elaboration.dateLabel}</span>
            {lot !== undefined && (
              <>
                <span className="text-border">·</span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${lot ? "text-brand-700" : "text-amber-700"}`}><TagIcon /> {lot ?? "Sin lote"}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between lg:justify-end gap-2 pl-13 lg:pl-0">
        <div className="flex flex-wrap gap-1.5">
          <PublicationBadge published={elaboration.published} compact />
          <VisibilityBadge hidden={elaboration.hidden} />
        </div>
        <Button variant="ghost" className="!p-2 text-text-secondary" onClick={onOpen} aria-label={`Ver detalle de ${elaboration.code}`}><ChevronRightIcon /></Button>
      </div>
    </div>
  );
}

function FilterMenu({ label, value, options, onChange, full }: { label: string; value: string; options: string[]; onChange: (value: string) => void; full?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative ${full ? "w-full" : ""}`}>
      {full && <p className="text-sm font-medium text-text-primary mb-1.5">{label}</p>}
      <Button variant="secondary" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`!justify-between !py-2.5 ${full ? "w-full" : "w-full lg:w-40"}`}>
        <span className="truncate">{full ? value : value === "Todos" ? label : value}</span><ChevronIcon expanded={open} />
      </Button>
      {open && (
        <div role="listbox" className="absolute z-20 top-full left-0 mt-1 w-full min-w-52 max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {options.map((option) => (
            <Button key={option} variant="ghost" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }} className={`w-full !justify-start !px-3 !py-2 text-left ${option === value ? "bg-brand-50 text-brand-700" : "text-text-primary hover:bg-surface"}`}>
              {option === value && <CheckIcon />}<span className={option === value ? "" : "ml-5"}>{option}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, icon, positive }: { value: number; label: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-2xl font-semibold text-text-primary">{value}</p><p className="text-xs text-text-secondary mt-1">{label}</p></div>
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${positive ? "bg-success-bg text-success" : "bg-brand-50 text-brand-600"}`}>{icon}</span>
      </div>
    </div>
  );
}

function ImpactStat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-lg bg-surface border border-border p-3"><p className="text-xl font-semibold text-text-primary">{value}</p><p className="text-[10px] text-text-secondary mt-0.5">{label}</p></div>;
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">{label}</p><p className={`text-sm font-medium text-text-primary ${mono ? "font-mono text-xs" : ""}`}>{value}</p></div>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === "Finalizada" ? "bg-success-bg text-success" : "bg-amber-50 text-amber-800"}`}>{status}</span>;
}

function PublicationBadge({ published, compact }: { published: boolean; compact?: boolean }) {
  return <span title={published ? "Producto publicado" : "Producto no publicado"} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${published ? "border-green-200 bg-success-bg text-success" : "border-border bg-surface text-text-secondary"}`}><span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-success" : "bg-text-secondary"}`} />{compact ? (published ? "Publicado" : "No publicado") : (published ? "Producto publicado" : "Producto no publicado")}</span>;
}

function VisibilityBadge({ hidden }: { hidden: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${hidden ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-surface text-text-secondary"}`}>{hidden ? <EyeOffIcon /> : <EyeIcon />}{hidden ? "Oculta" : "Visible"}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="py-12 px-5 text-center"><span className="h-11 w-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3"><SearchIcon /></span><p className="text-sm font-semibold text-text-primary">{title}</p><p className="text-xs text-text-secondary mt-1">{detail}</p></div>;
}

function HistoryIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.5 15a9 9 0 102.1-9.4L1 10" /><polyline points="12 7 12 12 15 14" /></svg>; }
function TraceIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M6 16V8a3 3 0 013-3h6" /></svg>; }
function LayersIcon({ large }: { large?: boolean } = {}) { const size = large ? 22 : 16; return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></svg>; }
function CheckIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>; }
function EditIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function PackageIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.3 7 12 12 20.7 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>; }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.7" y2="16.7" /></svg>; }
function TagIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.6L11 23.2 1.8 14V4.8h9.2l9.6 9a1 1 0 010 1.4z" /><circle cx="6.5" cy="9.5" r="1.5" /></svg>; }
function AlertIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 2.9L1.8 17a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 2.9a2 2 0 00-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>; }
function LockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>; }
function ChevronRightIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>; }
function ArrowLeftIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>; }
function ChevronIcon({ expanded }: { expanded: boolean }) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>; }
function EyeIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>; }
function EyeOffIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.9" /><path d="M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2" /><line x1="1" y1="1" x2="23" y2="23" /></svg>; }
