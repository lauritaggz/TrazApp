import { useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SearchMode = "barcode" | "name";
type Step = "search" | "review" | "success";

type SearchResult = {
  id: number;
  name: string;
  brand: string;
  presentation: string;
  barcode: string;
  imageLabel: string;
  duplicate?: boolean;
  jumbo: boolean;
  off: boolean;
  ingredients: string;
  contains: Array<{ name: string; sources: string[] }>;
  traces: Array<{ name: string; sources: string[] }>;
  unknown?: string;
};

const RESULTS: SearchResult[] = [
  {
    id: 1,
    name: "Harina Selecta sin polvos",
    brand: "Selecta",
    presentation: "Bolsa 1 kg",
    barcode: "7801234567890",
    imageLabel: "HS",
    duplicate: true,
    jumbo: true,
    off: true,
    ingredients: "Harina de trigo enriquecida, hierro, tiamina, riboflavina, niacina y ácido fólico.",
    contains: [{ name: "Gluten", sources: ["Jumbo", "Open Food Facts", "Ingredientes"] }],
    traces: [{ name: "Soya", sources: ["Open Food Facts"] }],
  },
  {
    id: 2,
    name: "Harina integral",
    brand: "Selecta",
    presentation: "Bolsa 1 kg",
    barcode: "7802920004217",
    imageLabel: "HI",
    jumbo: true,
    off: true,
    ingredients: "Harina integral de trigo.",
    contains: [{ name: "Gluten", sources: ["Jumbo", "Ingredientes"] }],
    traces: [],
  },
  {
    id: 3,
    name: "Harina de fuerza",
    brand: "Molino del Sur",
    presentation: "Bolsa 1 kg",
    barcode: "7804650912048",
    imageLabel: "HF",
    jumbo: true,
    off: false,
    ingredients: "Harina de trigo, gluten de trigo, ácido ascórbico y enzimas.",
    contains: [{ name: "Gluten", sources: ["Jumbo", "Ingredientes"] }],
    traces: [{ name: "Soya", sources: ["Jumbo"] }],
    unknown: "Trazas de oleaginosas",
  },
];

const INGREDIENTS = ["Harina de trigo", "Leche", "Huevo", "Azúcar", "Frutillas frescas", "Aceite de oliva"];

export default function NewSupply({ onBack, onUseExisting }: { onBack: () => void; onUseExisting: (id: number) => void }) {
  const [step, setStep] = useState<Step>("search");
  const [mode, setMode] = useState<SearchMode>("barcode");
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [ingredient, setIngredient] = useState("");
  const [tracesConfirmed, setTracesConfirmed] = useState(false);
  const [manualAssignment, setManualAssignment] = useState("");
  const noResults = query.toLowerCase().includes("xyz") || query === "0000000000000";

  function search() {
    setHasSearched(true);
  }

  function selectResult(result: SearchResult) {
    setSelected(result);
    setStep("review");
    setIngredient("");
    setTracesConfirmed(result.traces.length > 0);
    setManualAssignment("");
  }

  if (step === "success" && selected) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-card rounded-2xl border border-border p-6 sm:p-9 text-center">
          <span className="h-14 w-14 rounded-full bg-success-bg text-success flex items-center justify-center mx-auto mb-4"><CheckCircleIcon /></span>
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">Insumo registrado</p>
          <p className="text-2xl font-semibold text-text-primary">{selected.name}</p>
          <p className="text-sm text-text-secondary mt-2">La ficha fue revisada y asociada a <strong className="font-semibold text-text-primary">{ingredient}</strong>.</p>
          <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-text-primary">Origen conservado</p>
                <p className="text-xs text-text-secondary mt-1">Jumbo + Open Food Facts · Recuperado hoy</p>
              </div>
              <span className="rounded-full bg-success-bg text-success px-2.5 py-1 text-[10px] font-semibold">Confirmado</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2 mt-6">
            <Button variant="secondary" onClick={onBack}>Volver a Insumos</Button>
            <Button onClick={() => { setStep("search"); setSelected(null); setQuery(""); setHasSearched(false); }}>Registrar otro insumo</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "review" && selected) {
    const canConfirm = Boolean(ingredient) && (selected.traces.length > 0 || tracesConfirmed) && (!selected.unknown || Boolean(manualAssignment));
    return (
      <div className="max-w-6xl">
        <Button variant="ghost" className="!-ml-3 !px-3 mb-4" onClick={() => setStep("search")}><ArrowLeftIcon /> Volver a resultados</Button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">Nuevo insumo · Paso 2 de 2</p>
            <p className="text-2xl font-semibold text-text-primary">Revisar información recuperada</p>
            <p className="text-sm text-text-secondary mt-1">Nada se guardará hasta que confirmes el registro.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <SourceMark label="Jumbo" active={selected.jumbo} />
            <SourceMark label="Open Food Facts" active={selected.off} />
          </div>
        </div>

        {selected.duplicate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-white text-amber-700 flex items-center justify-center shrink-0"><CopyIcon /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Este producto ya está en tus insumos</p>
              <p className="text-xs text-amber-800 mt-1">Fue registrado como “Harina Selecta sin polvos”. Puedes usar la ficha existente y evitar duplicados.</p>
            </div>
            <Button variant="secondary" className="shrink-0" onClick={() => onUseExisting(1)}>Usar registro existente</Button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
          <div className="space-y-5">
            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Identificación comercial" description="Revisa y corrige los datos antes de registrar." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                <SourcedInput label="Nombre comercial" value={selected.name} source="Jumbo" />
                <SourcedInput label="Marca" value={selected.brand} source={selected.off ? "Ambas fuentes" : "Jumbo"} />
                <SourcedInput label="Presentación" value={selected.presentation} source="Jumbo" />
                <SourcedInput label="Código de barras" value={selected.barcode} source={selected.off ? "Coincidencia verificada" : "Jumbo"} mono />
              </div>
              {selected.off && selected.jumbo && (
                <div className="mx-5 mb-5 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3 flex items-start gap-2">
                  <span className="text-brand-600 mt-0.5"><LinkIcon /></span>
                  <p className="text-xs text-brand-700 leading-relaxed"><strong className="font-semibold">Fichas combinadas con seguridad.</strong> El código de barras de Jumbo coincide con el encontrado en Open Food Facts.</p>
                </div>
              )}
            </section>

            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Ingredientes declarados" description="Se prioriza Jumbo; si no informa ingredientes, se usa Open Food Facts." source="Jumbo" />
              <div className="p-5">
                <div
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Ingredientes declarados"
                  className="min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  {selected.ingredients}
                </div>
                <p className="text-[10px] text-text-secondary mt-2">Puedes corregir la transcripción según lo que indica el envase.</p>
              </div>
            </section>

            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Alérgenos combinados" description="Se conserva la unión de las fuentes y lo detectado en los ingredientes." />
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <AllergenGroup title="Contiene" items={selected.contains} danger />
                <AllergenGroup title="Puede contener" items={selected.traces} />
              </div>
              <div className="mx-5 mb-5 rounded-lg bg-surface px-3.5 py-3 flex items-start gap-2">
                <span className="text-text-secondary mt-0.5"><ShieldIcon /></span>
                <p className="text-[10px] text-text-secondary leading-relaxed">Los alérgenos se combinan por unión. Una indicación “libre de” se conserva como dato de origen, pero nunca elimina un alérgeno informado o detectado.</p>
              </div>

              {selected.unknown && (
                <div className="m-5 mt-0 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-700 mt-0.5"><AlertIcon /></span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-900">Alérgeno no reconocido: “{selected.unknown}”</p>
                      <p className="text-xs text-amber-800 mt-1">Asígnalo a una categoría del catálogo para poder continuar.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {["Frutos secos", "Maní", "Sésamo", "Otro"].map((option) => (
                          <Button key={option} variant="secondary" className={`!px-3 !py-1.5 !text-xs ${manualAssignment === option ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`} onClick={() => setManualAssignment(option)}>{option}</Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selected.traces.length === 0 && (
                <div className="m-5 mt-0 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-700 mt-0.5"><AlertIcon /></span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">Ninguna fuente informa “puede contener”</p>
                      <p className="text-xs text-amber-800 mt-1">Revisa el envase y confirma que no declara trazas antes de continuar.</p>
                    </div>
                    <Button variant="secondary" className={`shrink-0 !px-3 !py-2 ${tracesConfirmed ? "border-success text-success" : ""}`} onClick={() => setTracesConfirmed(true)}>
                      {tracesConfirmed ? <><CheckIcon /> Confirmado</> : "Confirmar envase"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="xl:sticky xl:top-5 space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm font-semibold text-text-primary">Asociar a un ingrediente</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">Elige qué ingrediente de tus formulaciones cubre este producto comercial.</p>
              <div className="space-y-2 mt-4">
                {INGREDIENTS.map((item) => (
                  <Button key={item} variant="secondary" className={`w-full !justify-start !px-3 !py-2.5 ${ingredient === item ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`} onClick={() => setIngredient(item)}>
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${ingredient === item ? "border-brand-600 bg-brand-600 text-white" : "border-border"}`}>{ingredient === item && <CheckIcon />}</span>
                    {item}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm font-semibold text-text-primary">Confirmar registro</p>
              <div className="space-y-2.5 mt-4">
                <CheckRow done label="Información comercial revisada" />
                <CheckRow done={Boolean(ingredient)} label="Ingrediente asociado" />
                <CheckRow done={selected.traces.length > 0 || tracesConfirmed} label="Trazas verificadas" />
                {selected.unknown && <CheckRow done={Boolean(manualAssignment)} label="Alérgeno asignado" />}
              </div>
              <Button className="w-full mt-5" disabled={!canConfirm} onClick={() => setStep("success")}>Confirmar y registrar insumo</Button>
              <p className="text-[10px] text-text-secondary text-center mt-2.5">Esta acción crea el registro en tu catálogo.</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-text-primary"><ClockIcon /><p className="text-xs font-semibold">Origen de la ficha</p></div>
              <div className="mt-3 space-y-2">
                <SourceDate label="Jumbo.cl" active={selected.jumbo} />
                <SourceDate label="Open Food Facts" active={selected.off} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Button variant="ghost" className="!-ml-3 !px-3 mb-4" onClick={onBack}><ArrowLeftIcon /> Volver a Insumos</Button>

      <div className="mb-6">
        <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">Nuevo insumo · Paso 1 de 2</p>
        <p className="text-2xl font-semibold text-text-primary">Buscar producto comercial</p>
        <p className="text-sm text-text-secondary mt-1">Recupera información pública para evitar transcribir la ficha manualmente.</p>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border">
          <div className="flex rounded-lg bg-surface p-1 w-fit mb-5">
            <Button variant="ghost" className={`!px-3.5 !py-2 ${mode === "barcode" ? "bg-card shadow-sm text-text-primary" : "text-text-secondary"}`} onClick={() => { setMode("barcode"); setHasSearched(false); setQuery(""); }}><BarcodeIcon /> Código de barras</Button>
            <Button variant="ghost" className={`!px-3.5 !py-2 ${mode === "name" ? "bg-card shadow-sm text-text-primary" : "text-text-secondary"}`} onClick={() => { setMode("name"); setHasSearched(false); setQuery(""); }}><SearchIcon /> Nombre o marca</Button>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-2">
            <div className="w-full flex-1">
              <Input
                label={mode === "barcode" ? "Código de barras" : "Nombre o marca"}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setHasSearched(false); }}
                onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) search(); }}
                placeholder={mode === "barcode" ? "Ej. 7801234567890" : "Ej. harina Selecta"}
                leftIcon={mode === "barcode" ? <BarcodeIcon /> : <SearchIcon />}
                inputMode={mode === "barcode" ? "numeric" : "search"}
              />
            </div>
            <Button className="w-full sm:w-auto" disabled={!query.trim()} onClick={search}><SearchIcon /> Buscar en fuentes</Button>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <SourceFlow icon={<DatabaseIcon />} label="Open Food Facts" detail={mode === "barcode" ? "Identifica nombre y marca" : "Complementa la ficha"} />
            <ArrowRightIcon />
            <SourceFlow icon={<StoreIcon />} label="Jumbo.cl" detail={mode === "barcode" ? "Verifica el mismo código" : "Busca coincidencias comerciales"} />
          </div>
        </div>

        {!hasSearched ? (
          <div className="px-6 py-12 text-center">
            <span className="h-12 w-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">{mode === "barcode" ? <BarcodeLargeIcon /> : <SearchLargeIcon />}</span>
            <p className="text-sm font-semibold text-text-primary">{mode === "barcode" ? "Ingresa el código del envase" : "Busca por nombre comercial o marca"}</p>
            <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
              {mode === "barcode" ? "Consultaremos Open Food Facts y solo combinaremos datos de Jumbo si el código coincide." : "Mostraremos productos encontrados en Jumbo para que elijas la presentación correcta."}
            </p>
          </div>
        ) : noResults ? (
          <div className="px-6 py-10 text-center">
            <span className="h-11 w-11 rounded-full bg-surface text-text-secondary flex items-center justify-center mx-auto mb-3"><SearchLargeIcon /></span>
            <p className="text-sm font-semibold text-text-primary">No encontramos resultados</p>
            <p className="text-xs text-text-secondary mt-1">Prueba con el nombre o la marca, o completa la ficha por tu cuenta.</p>
            <div className="flex justify-center gap-2 mt-4">
              {mode === "barcode" && <Button variant="secondary" onClick={() => { setMode("name"); setQuery(""); setHasSearched(false); }}>Buscar por nombre</Button>}
              <Button variant="ghost">Ingresar manualmente</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="px-5 py-3 bg-surface border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-text-secondary"><strong className="font-semibold text-text-primary">{mode === "barcode" ? "1 coincidencia exacta" : "3 resultados"}</strong> para “{query}”</p>
              <p className="text-[10px] text-text-secondary">Datos simulados para previsualizar el flujo</p>
            </div>
            <div className="divide-y divide-border">
              {(mode === "barcode" ? RESULTS.slice(0, 1) : RESULTS).map((result) => (
                <div key={result.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface transition-colors">
                  <span className="h-14 w-14 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">{result.imageLabel}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{result.name}</p>
                      {result.duplicate && <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">Ya registrado</span>}
                    </div>
                    <p className="text-xs text-text-secondary mt-1"><strong className="font-medium text-text-primary">{result.brand}</strong> · {result.presentation}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="font-mono text-[10px] text-text-secondary">{result.barcode}</span>
                      {result.off && <SourcePill label="Open Food Facts" />}
                      {result.jumbo && <SourcePill label="Jumbo" />}
                    </div>
                  </div>
                  <Button className="shrink-0" onClick={() => selectResult(result)}>Revisar ficha <ArrowRightIcon /></Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 flex items-start gap-3">
        <span className="text-text-secondary mt-0.5"><ShieldIcon /></span>
        <div>
          <p className="text-xs font-semibold text-text-primary">Tú mantienes el control</p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">La información recuperada solo completa un borrador. Puedes corregirla y nada se incorpora a tu catálogo sin tu confirmación.</p>
        </div>
      </div>
    </div>
  );
}

function SourcedInput({ label, value, source, mono }: { label: string; value: string; source: string; mono?: boolean }) {
  const [currentValue, setCurrentValue] = useState(value);
  return (
    <div>
      <Input label={label} value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} className={mono ? "font-mono" : ""} />
      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-text-secondary"><SourceIcon /> Fuente: <strong className="font-medium text-text-primary">{source}</strong></div>
    </div>
  );
}

function SectionHeader({ title, description, source }: { title: string; description: string; source?: string }) {
  return (
    <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-text-primary">{title}</p><p className="text-xs text-text-secondary mt-0.5">{description}</p></div>
      {source && <SourcePill label={source} />}
    </div>
  );
}

function AllergenGroup({ title, items, danger }: { title: string; items: SearchResult["contains"]; danger?: boolean }) {
  return (
    <div className="p-5">
      <div className={`flex items-center gap-2 ${danger ? "text-error" : "text-amber-700"}`}><AlertIcon /><p className="text-xs font-semibold uppercase tracking-wider">{title}</p></div>
      {items.length > 0 ? items.map((item) => (
        <div key={item.name} className="mt-3 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold text-text-primary">{item.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">{item.sources.map((source) => <SourcePill key={source} label={source} small />)}</div>
        </div>
      )) : <p className="text-xs text-text-secondary mt-3">Ninguna fuente informa trazas.</p>}
    </div>
  );
}

function SourceFlow({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-surface text-brand-600 flex items-center justify-center">{icon}</span><div><p className="text-[10px] font-semibold text-text-primary">{label}</p><p className="text-[10px] text-text-secondary">{detail}</p></div></div>;
}

function SourcePill({ label, small }: { label: string; small?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 ${small ? "px-2 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} font-medium`}><span className="h-1 w-1 rounded-full bg-brand-600" />{label}</span>;
}

function SourceMark({ label, active }: { label: string; active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-border bg-surface text-text-secondary"}`}>{active && <CheckIcon />}{label}</span>;
}

function CheckRow({ done, label }: { done: boolean; label: string }) {
  return <div className={`flex items-center gap-2 text-xs ${done ? "text-success" : "text-text-secondary"}`}><span className={`h-4 w-4 rounded-full border flex items-center justify-center ${done ? "bg-success text-white border-success" : "border-border"}`}>{done && <CheckIcon />}</span>{label}</div>;
}

function SourceDate({ label, active }: { label: string; active: boolean }) {
  return <div className="flex items-center justify-between gap-2 text-xs"><span className={active ? "text-text-primary" : "text-text-secondary"}>{label}</span><span className={active ? "text-success" : "text-text-secondary"}>{active ? "Recuperado hoy" : "Sin datos"}</span></div>;
}

function DatabaseIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></svg>; }
function StoreIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l2-6h14l2 6" /><path d="M5 13v8h14v-8M9 21v-6h6v6" /><path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" /></svg>; }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.7" y2="16.7" /></svg>; }
function SearchLargeIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.7" y2="16.7" /></svg>; }
function BarcodeIcon() { return <svg width="17" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="2" y1="1" x2="2" y2="17" /><line x1="5" y1="1" x2="5" y2="17" /><line x1="9" y1="1" x2="9" y2="17" /><line x1="12" y1="1" x2="12" y2="17" /><line x1="16" y1="1" x2="16" y2="17" /><line x1="21" y1="1" x2="21" y2="17" /></svg>; }
function BarcodeLargeIcon() { return <svg width="25" height="20" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="1" x2="2" y2="17" /><line x1="5" y1="1" x2="5" y2="17" /><line x1="9" y1="1" x2="9" y2="17" /><line x1="12" y1="1" x2="12" y2="17" /><line x1="16" y1="1" x2="16" y2="17" /><line x1="21" y1="1" x2="21" y2="17" /></svg>; }
function ArrowLeftIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>; }
function ArrowRightIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>; }
function CheckIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>; }
function CheckCircleIcon() { return <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.1V12a10 10 0 11-5.9-9.1" /><polyline points="22 4 12 14 9 11" /></svg>; }
function AlertIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>; }
function LinkIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></svg>; }
function CopyIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>; }
function SourceIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>; }
function ClockIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>; }
function ShieldIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }
