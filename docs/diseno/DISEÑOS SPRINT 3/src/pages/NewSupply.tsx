import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SearchMode = "barcode" | "name";
type Step = "start" | "search" | "loading" | "review" | "success";
type JumboStatus = "matched" | "timeout" | "no-match" | "not-searched";

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
  freeFrom: string[];
  jumboStatus: JumboStatus;
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
    contains: [{ name: "Gluten", sources: ["Jumbo", "Open Food Facts", "Detectado en los ingredientes"] }],
    traces: [{ name: "Soya", sources: ["Open Food Facts"] }],
    freeFrom: [],
    jumboStatus: "matched",
  },
  {
    id: 2,
    name: "Leche semidescremada sin lactosa",
    brand: "Colun",
    presentation: "Caja 1 L",
    barcode: "7802920001841",
    imageLabel: "LS",
    jumbo: true,
    off: true,
    ingredients: "Leche semidescremada, enzima lactasa, vitaminas A y D.",
    contains: [{ name: "Leche", sources: ["Jumbo", "Open Food Facts", "Detectado en los ingredientes"] }],
    traces: [],
    freeFrom: ["Libre de lactosa"],
    jumboStatus: "matched",
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
    contains: [{ name: "Gluten", sources: ["Jumbo", "Detectado en los ingredientes"] }],
    traces: [{ name: "Soya", sources: ["Jumbo"] }],
    unknown: "Trazas de oleaginosas",
    freeFrom: ["Libre de huevo"],
    jumboStatus: "matched",
  },
];

const MANUAL_RESULT: SearchResult = {
  id: 99,
  name: "",
  brand: "",
  presentation: "",
  barcode: "",
  imageLabel: "MI",
  jumbo: false,
  off: false,
  ingredients: "",
  contains: [],
  traces: [],
  freeFrom: [],
  jumboStatus: "not-searched",
};

const INGREDIENTS = ["Harina de trigo", "Leche", "Huevo", "Azúcar", "Frutillas frescas", "Aceite de oliva"];

export default function NewSupply({ onBack, onUseExisting }: { onBack: () => void; onUseExisting: (id: number) => void }) {
  const [step, setStep] = useState<Step>("start");
  const [mode, setMode] = useState<SearchMode>("barcode");
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [ingredient, setIngredient] = useState("");
  const [tracesConfirmed, setTracesConfirmed] = useState(false);
  const [manualAssignment, setManualAssignment] = useState("");
  const [traceAnswer, setTraceAnswer] = useState<"" | "none" | "has">("");
  const [manualTraces, setManualTraces] = useState<string[]>([]);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const noResults = query.toLowerCase().includes("xyz") || query === "0000000000000";

  function search() {
    setStep("loading");
    setLoadingPhase(0);
  }

  function selectResult(result: SearchResult) {
    setSelected({ ...result });
    setStep("review");
    setIngredient("");
    setTracesConfirmed(result.traces.length > 0);
    setManualAssignment("");
    setTraceAnswer("");
    setManualTraces([]);
  }

  function updateSelected(field: "name" | "brand" | "presentation" | "barcode" | "ingredients", value: string) {
    setSelected((current) => current ? { ...current, [field]: value } : current);
  }

  function toggleContainsAllergen(name: string) {
    setSelected((current) => {
      if (!current) return current;
      const exists = current.contains.some((item) => item.name === name);
      return {
        ...current,
        contains: exists
          ? current.contains.filter((item) => item.name !== name)
          : [...current.contains, { name, sources: ["Agregado por el productor"] }],
      };
    });
  }

  useEffect(() => {
    if (step !== "loading") return;
    const second = window.setTimeout(() => setLoadingPhase(1), 650);
    const third = window.setTimeout(() => setLoadingPhase(2), 1400);
    const done = window.setTimeout(() => {
      if (noResults) {
        setHasSearched(true);
        setStep("search");
        return;
      }
      if (mode === "name") {
        setHasSearched(true);
        setStep("search");
        return;
      }
      const base = RESULTS.find((result) => result.barcode === query) ?? RESULTS[1];
      if (query.endsWith("111")) {
        selectResult({ ...base, jumbo: false, off: true, jumboStatus: "timeout" });
      } else if (query.endsWith("222")) {
        selectResult({ ...base, jumbo: false, off: true, jumboStatus: "no-match" });
      } else {
        selectResult(base);
      }
    }, 2200);
    return () => {
      window.clearTimeout(second);
      window.clearTimeout(third);
      window.clearTimeout(done);
    };
  }, [step]);

  if (step === "start") {
    return (
      <div className="max-w-5xl">
        <Button variant="ghost" className="!-ml-3 !px-3 mb-4 min-h-11" onClick={onBack}><ArrowLeftIcon /> Volver a Insumos</Button>
        <div className="mb-6">
          <p className="text-xs font-semibold text-brand-600 mb-1">Nuevo insumo</p>
          <p className="text-2xl font-semibold text-text-primary">¿Cómo quieres registrar el insumo?</p>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">Puedes recuperar información pública o completar la ficha manualmente. Nada se guardará sin tu confirmación.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StartMethod
            primary
            icon={<ScanIcon />}
            title="Escanear código de barras"
            description="Usa la cámara del celular o escribe el código que aparece en el envase."
            action="Comenzar escaneo"
            onClick={() => { setMode("barcode"); setQuery(""); setHasSearched(false); setStep("search"); }}
          />
          <StartMethod
            icon={<SearchLargeIcon />}
            title="Buscar por nombre o marca"
            description="Encuentra el producto en el catálogo de Jumbo y elige la presentación correcta."
            action="Buscar producto"
            onClick={() => { setMode("name"); setQuery(""); setHasSearched(false); setStep("search"); }}
          />
          <StartMethod
            icon={<EditIcon />}
            title="Ingresar manualmente"
            description="Completa todos los datos mirando directamente el envase del producto."
            action="Crear ficha manual"
            onClick={() => selectResult(MANUAL_RESULT)}
          />
        </div>

        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 flex items-start gap-3">
          <span className="text-brand-600 mt-0.5"><ShieldIcon /></span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Tú decides qué se registra</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">Las fuentes solo preparan un borrador. Podrás editar cada campo y revisar especialmente los alérgenos antes de confirmar.</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "loading") {
    const phases = [
      { label: "Buscando en Open Food Facts", detail: "Identificando el producto y sus declaraciones" },
      { label: "Buscando el mismo producto en Jumbo", detail: "Verificando código, marca y presentación" },
      { label: "Combinando información", detail: "Uniendo datos y alérgenos sin descartar fuentes" },
    ];
    return (
      <div className="max-w-2xl mx-auto py-5 sm:py-10">
        <div className="bg-card rounded-2xl border border-border p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="h-12 w-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><LoadingIcon /></span>
            <div>
              <p className="text-xs font-semibold text-brand-600 mb-1">Consultando fuentes</p>
              <p className="text-xl font-semibold text-text-primary">Estamos preparando la ficha</p>
              <p className="text-sm text-text-secondary mt-1">Normalmente demora menos de 10 segundos.</p>
            </div>
          </div>
          <div className="mt-7 space-y-1">
            {phases.map((phase, index) => (
              <div key={phase.label} className={`flex items-start gap-3 rounded-xl p-3.5 transition-colors ${index === loadingPhase ? "bg-brand-50" : ""}`}>
                <span className={`h-7 w-7 rounded-full border flex items-center justify-center shrink-0 ${index < loadingPhase ? "bg-success border-success text-white" : index === loadingPhase ? "border-brand-600 text-brand-600" : "border-border text-text-secondary"}`}>
                  {index < loadingPhase ? <CheckIcon /> : index === loadingPhase ? <SmallSpinner /> : index + 1}
                </span>
                <div>
                  <p className={`text-sm font-medium ${index <= loadingPhase ? "text-text-primary" : "text-text-secondary"}`}>{phase.label}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{phase.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 h-2 rounded-full bg-surface overflow-hidden">
            <div className={`h-full rounded-full bg-brand-600 transition-all duration-500 ${loadingPhase === 0 ? "w-1/3" : loadingPhase === 1 ? "w-2/3" : "w-full"}`} />
          </div>
          <Button variant="ghost" className="w-full mt-4 min-h-11" onClick={() => setStep("search")}>Cancelar consulta</Button>
        </div>
      </div>
    );
  }

  if (step === "success" && selected) {
    const sourceNames = [selected.jumbo && "Jumbo", selected.off && "Open Food Facts"].filter(Boolean) as string[];
    return (
      <div className="max-w-4xl">
        <div className="flex items-start gap-3 mb-5">
          <span className="h-11 w-11 rounded-full bg-success-bg text-success flex items-center justify-center shrink-0"><CheckCircleIcon /></span>
          <div>
            <p className="text-xs font-semibold text-success mb-1">Insumo registrado</p>
            <p className="text-2xl font-semibold text-text-primary">{selected.name}</p>
            <p className="text-sm text-text-secondary mt-1">La información fue confirmada y asociada a {ingredient}.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-5 items-start">
          <div className="space-y-5">
            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Identificación comercial" description="Información confirmada por el productor." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5">
                <ReadField label="Nombre comercial" value={selected.name} />
                <ReadField label="Marca" value={selected.brand} />
                <ReadField label="Presentación" value={selected.presentation} />
                <ReadField label="Código de barras" value={selected.barcode || "Sin código registrado"} mono />
              </div>
            </section>
            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Declaraciones del envase" description="Ingredientes y alérgenos guardados en la ficha." />
              <div className="p-5 border-b border-border"><ReadField label="Ingredientes declarados" value={selected.ingredients} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5">
                <AllergenSummary title="Contiene" items={selected.contains.map((item) => item.name)} danger />
                <AllergenSummary title="Puede contener" items={[...selected.traces.map((item) => item.name), ...manualTraces]} />
              </div>
            </section>
          </div>
          <aside className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm font-semibold text-text-primary">Origen de la información</p>
              <p className="text-xs text-text-secondary mt-1">Datos recuperados y luego revisados por el productor.</p>
              <div className="mt-4 space-y-3">
                {sourceNames.length > 0 ? sourceNames.map((source) => (
                  <div key={source} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-xs font-semibold text-text-primary">Fuente: {source}</p>
                    <p className="text-xs text-text-secondary mt-1">Recuperado el 24 de marzo de 2025</p>
                  </div>
                )) : <p className="text-xs text-text-secondary">Ficha ingresada manualmente.</p>}
              </div>
            </div>
            <div className="bg-brand-50 rounded-xl border border-brand-200 p-4">
              <p className="text-xs font-semibold text-text-primary">Ingrediente asociado</p>
              <p className="text-sm font-medium text-brand-700 mt-1">{ingredient}</p>
            </div>
            <Button className="w-full min-h-11" onClick={onBack}>Volver a Insumos</Button>
            <Button variant="secondary" className="w-full min-h-11" onClick={() => { setStep("start"); setSelected(null); setQuery(""); setHasSearched(false); }}>Registrar otro insumo</Button>
          </aside>
        </div>
      </div>
    );
  }

  if (step === "review" && selected) {
    const commercialComplete = Boolean(selected.name.trim() && selected.brand.trim() && selected.presentation.trim() && selected.ingredients.trim());
    const tracesReviewed = selected.traces.length > 0 || (traceAnswer === "none" && tracesConfirmed) || (traceAnswer === "has" && manualTraces.length > 0);
    const canConfirm = commercialComplete && Boolean(ingredient) && tracesReviewed && (!selected.unknown || Boolean(manualAssignment));
    const manual = !selected.jumbo && !selected.off && selected.jumboStatus === "not-searched";
    const defaultSource = manual ? "Ingresado manualmente" : selected.jumbo ? "Jumbo" : "Open Food Facts";
    const sharedSource = selected.jumbo && selected.off ? "Jumbo · Open Food Facts" : defaultSource;
    return (
      <div className="max-w-6xl">
        <Button variant="ghost" className="!-ml-3 !px-3 mb-4 min-h-11" onClick={() => setStep(manual ? "start" : "search")}><ArrowLeftIcon /> {manual ? "Volver al inicio" : "Volver a resultados"}</Button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-brand-600 mb-1">Nuevo insumo · Revisión final</p>
            <p className="text-2xl font-semibold text-text-primary">{manual ? "Completar ficha manual" : "Revisar información combinada"}</p>
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
            <Button variant="secondary" className="shrink-0 min-h-11" onClick={() => onUseExisting(1)}>Usar el insumo existente</Button>
          </div>
        )}

        {selected.jumboStatus === "timeout" && <SourceNotice title="Jumbo no respondió a tiempo" detail="Continuamos con la información encontrada en Open Food Facts. Puedes revisar y completar todos los campos." />}
        {selected.jumboStatus === "no-match" && <SourceNotice title="No encontramos el mismo código en Jumbo" detail="Para evitar mezclar productos distintos, continuamos solo con Open Food Facts." />}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
          <div className="space-y-5">
            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Identificación comercial" description="Revisa y corrige los datos antes de registrar." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                <SourcedInput label="Nombre comercial" value={selected.name} source={defaultSource} onChange={(value) => updateSelected("name", value)} />
                <SourcedInput label="Marca" value={selected.brand} source={sharedSource} onChange={(value) => updateSelected("brand", value)} />
                <SourcedInput label="Presentación" value={selected.presentation} source={defaultSource} onChange={(value) => updateSelected("presentation", value)} />
                <SourcedInput label="Código de barras" value={selected.barcode} source={sharedSource} onChange={(value) => updateSelected("barcode", value)} mono />
              </div>
              {selected.off && selected.jumbo && (
                <div className="mx-5 mb-5 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3 flex items-start gap-2">
                  <span className="text-brand-600 mt-0.5"><LinkIcon /></span>
                  <p className="text-xs text-brand-700 leading-relaxed"><strong className="font-semibold">Fichas combinadas con seguridad.</strong> El código de barras de Jumbo coincide con el encontrado en Open Food Facts.</p>
                </div>
              )}
            </section>

            <section className="bg-card rounded-xl border border-border overflow-hidden">
              <SectionHeader title="Ingredientes declarados" description="Transcripción editable de la declaración del envase." source={defaultSource} />
              <div className="p-5">
                <div
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Ingredientes declarados"
                  onInput={(event) => updateSelected("ingredients", event.currentTarget.textContent ?? "")}
                  className="min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  {selected.ingredients}
                </div>
                <p className="text-xs text-text-secondary mt-2">Fuente: <strong className="font-medium text-text-primary">{defaultSource}</strong>. Puedes corregir la transcripción según el envase.</p>
              </div>
            </section>

            <section className="bg-card rounded-xl border-2 border-brand-200 overflow-hidden shadow-sm">
              <SectionHeader title="Alérgenos combinados" description="Revisa esta sección con el envase a la vista. Es obligatoria antes de confirmar." />
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <AllergenGroup title="Contiene" items={selected.contains} danger onToggle={toggleContainsAllergen} />
                <AllergenGroup title="Puede contener" items={selected.traces} />
              </div>
              <div className="mx-5 mb-5 rounded-lg bg-surface px-3.5 py-3 flex items-start gap-2">
                <span className="text-text-secondary mt-0.5"><ShieldIcon /></span>
                <p className="text-xs text-text-secondary leading-relaxed">Los alérgenos se combinan por unión. Una indicación “libre de” se conserva como dato de origen, pero nunca elimina un alérgeno informado o detectado.</p>
              </div>

              {selected.freeFrom.length > 0 && (
                <div className="mx-5 mb-5 rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-text-primary">Indicaciones “Libre de…”</p>
                  <p className="text-xs text-text-secondary mt-1">Información adicional del producto. No modifica los alérgenos de arriba.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selected.freeFrom.map((claim) => <span key={claim} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">{claim}</span>)}
                  </div>
                </div>
              )}

              {selected.unknown && (
                <div className="m-5 mt-0 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-700 mt-0.5"><AlertIcon /></span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-900">Alérgeno no reconocido: “{selected.unknown}”</p>
                      <p className="text-xs text-amber-800 mt-1">Asígnalo a una categoría del catálogo para poder continuar.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {["Frutos secos", "Maní", "Sésamo", "Otro"].map((option) => (
                          <Button key={option} variant="secondary" className={`!px-3 min-h-11 !text-xs ${manualAssignment === option ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`} onClick={() => setManualAssignment(option)}>{option}</Button>
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
                      <p className="text-xs text-amber-800 mt-1">Revisa el envase y elige una respuesta antes de continuar.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        <Button variant="secondary" className={`min-h-11 !justify-start ${traceAnswer === "none" ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`} onClick={() => { setTraceAnswer("none"); setTracesConfirmed(true); setManualTraces([]); }}>
                          <ChoiceDot selected={traceAnswer === "none"} /> El envase no indica “puede contener”
                        </Button>
                        <Button variant="secondary" className={`min-h-11 !justify-start ${traceAnswer === "has" ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`} onClick={() => { setTraceAnswer("has"); setTracesConfirmed(false); }}>
                          <ChoiceDot selected={traceAnswer === "has"} /> El envase indica…
                        </Button>
                      </div>
                      {traceAnswer === "has" && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-amber-900">Selecciona los alérgenos indicados</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {["Leche", "Soya", "Maní", "Frutos secos", "Sésamo"].map((allergen) => (
                              <Button key={allergen} variant="secondary" className={`min-h-11 !px-3 ${manualTraces.includes(allergen) ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`} onClick={() => setManualTraces((current) => current.includes(allergen) ? current.filter((item) => item !== allergen) : [...current, allergen])}>
                                {manualTraces.includes(allergen) && <CheckIcon />}{allergen}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                <CheckRow done={commercialComplete} label="Información comercial revisada" />
                <CheckRow done={Boolean(ingredient)} label="Ingrediente asociado" />
                <CheckRow done={tracesReviewed} label="Trazas verificadas" />
                {selected.unknown && <CheckRow done={Boolean(manualAssignment)} label="Alérgeno asignado" />}
              </div>
              <Button className="w-full mt-5 min-h-11" disabled={!canConfirm} onClick={() => setStep("success")}>Confirmar registro</Button>
              <Button variant="ghost" className="w-full mt-2 min-h-11 text-text-secondary" onClick={onBack}>Cancelar</Button>
              <p className="text-xs text-text-secondary text-center mt-2.5">Cancelar no guarda ningún dato.</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-text-primary"><ClockIcon /><p className="text-xs font-semibold">Origen de la ficha</p></div>
              <div className="mt-3 space-y-2">
                <SourceDate label="Jumbo" active={selected.jumbo} />
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
      <Button variant="ghost" className="!-ml-3 !px-3 mb-4 min-h-11" onClick={() => setStep("start")}><ArrowLeftIcon /> Volver al inicio</Button>

      <div className="mb-6">
        <p className="text-xs font-semibold text-brand-600 mb-1">Nuevo insumo · Búsqueda</p>
        <p className="text-2xl font-semibold text-text-primary">Buscar producto comercial</p>
        <p className="text-sm text-text-secondary mt-1">Recupera información pública para evitar transcribir la ficha manualmente.</p>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border">
          <div className="flex rounded-lg bg-surface p-1 w-fit mb-5">
            <Button variant="ghost" className={`!px-3.5 !py-2 min-h-11 ${mode === "barcode" ? "bg-card shadow-sm text-text-primary" : "text-text-secondary"}`} onClick={() => { setMode("barcode"); setHasSearched(false); setQuery(""); }}><BarcodeIcon /> Código de barras</Button>
            <Button variant="ghost" className={`!px-3.5 !py-2 min-h-11 ${mode === "name" ? "bg-card shadow-sm text-text-primary" : "text-text-secondary"}`} onClick={() => { setMode("name"); setHasSearched(false); setQuery(""); }}><SearchIcon /> Nombre o marca</Button>
          </div>

          {mode === "barcode" && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="h-12 w-12 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0"><ScanIcon /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">Escanea el código del envase</p>
                <p className="text-xs text-text-secondary mt-1">En celular, la cámara identifica automáticamente los números del código de barras.</p>
              </div>
              <Button className="w-full sm:w-auto min-h-11" onClick={() => { setQuery("7802920001841"); setStep("loading"); setLoadingPhase(0); }}>Abrir cámara</Button>
            </div>
          )}

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
            <Button className="w-full sm:w-auto min-h-11" disabled={!query.trim()} onClick={search}><SearchIcon /> Buscar en fuentes</Button>
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
            <p className="text-sm font-semibold text-text-primary">{mode === "barcode" ? "Código no encontrado" : "Sin resultados para esta búsqueda"}</p>
            <p className="text-xs text-text-secondary mt-1">Prueba con el nombre o la marca, o completa la ficha por tu cuenta.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-2 mt-4">
              {mode === "barcode" && <Button variant="secondary" onClick={() => { setMode("name"); setQuery(""); setHasSearched(false); }}>Buscar por nombre</Button>}
              <Button variant="ghost" className="min-h-11" onClick={() => selectResult(MANUAL_RESULT)}>Ingresar manualmente</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="px-5 py-3 bg-surface border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-text-secondary"><strong className="font-semibold text-text-primary">{mode === "barcode" ? "Coincidencia exacta" : "Resultados de Jumbo"}</strong> para “{query}”</p>
              <p className="text-xs text-text-secondary">Datos ficticios para revisar el flujo</p>
            </div>
            <div className="divide-y divide-border">
              {(mode === "barcode" ? RESULTS.slice(0, 1) : RESULTS).map((result) => (
                <div key={result.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface transition-colors">
                  <span className="h-14 w-14 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">{result.imageLabel}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{result.name}</p>
                      {result.duplicate && <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-semibold">Ya registrado</span>}
                    </div>
                    <p className="text-xs text-text-secondary mt-1"><strong className="font-medium text-text-primary">{result.brand}</strong> · {result.presentation}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="font-mono text-xs text-text-secondary">{result.barcode}</span>
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

function StartMethod({ icon, title, description, action, onClick, primary }: { icon: React.ReactNode; title: string; description: string; action: string; onClick: () => void; primary?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col ${primary ? "border-brand-200 bg-brand-50" : "border-border bg-card"}`}>
      <span className={`h-11 w-11 rounded-xl flex items-center justify-center ${primary ? "bg-brand-600 text-white" : "bg-surface text-brand-600"}`}>{icon}</span>
      <p className="text-lg font-semibold text-text-primary mt-5">{title}</p>
      <p className="text-sm text-text-secondary mt-2 leading-relaxed flex-1">{description}</p>
      <Button variant={primary ? "primary" : "secondary"} className="w-full mt-5 min-h-11" onClick={onClick}>{action}<ArrowRightIcon /></Button>
    </div>
  );
}

function SourcedInput({ label, value, source, mono, onChange }: { label: string; value: string; source: string; mono?: boolean; onChange: (value: string) => void }) {
  return (
    <div>
      <Input label={label} value={value} onChange={(event) => onChange(event.target.value)} className={mono ? "font-mono" : ""} />
      <div className="flex items-center gap-1 mt-1.5 text-xs text-text-secondary"><SourceIcon /> Fuente: <strong className="font-medium text-text-primary">{source}</strong></div>
    </div>
  );
}

function SourceNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5 flex items-start gap-3">
      <span className="text-amber-700 mt-0.5"><AlertIcon /></span>
      <div><p className="text-sm font-semibold text-amber-900">{title}</p><p className="text-xs text-amber-800 mt-1">{detail}</p></div>
    </div>
  );
}

function ChoiceDot({ selected }: { selected: boolean }) {
  return <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${selected ? "border-brand-600" : "border-border"}`}>{selected && <span className="h-2 w-2 rounded-full bg-brand-600" />}</span>;
}

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs font-medium text-text-secondary">{label}</p><p className={`text-sm font-medium text-text-primary mt-1 ${mono ? "font-mono" : ""}`}>{value || "No informado"}</p></div>;
}

function AllergenSummary({ title, items, danger }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-semibold ${danger ? "text-error" : "text-amber-800"}`}>{title}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.length > 0 ? items.map((item) => <span key={item} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${danger ? "border-red-200 bg-error-bg text-error" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{item}</span>) : <span className="text-xs text-text-secondary">Sin alérgenos informados</span>}
      </div>
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

function AllergenGroup({ title, items, danger, onToggle }: { title: string; items: SearchResult["contains"]; danger?: boolean; onToggle?: (name: string) => void }) {
  const options = ["Gluten", "Leche", "Huevo", "Soya", "Maní", "Frutos secos", "Sésamo"];
  return (
    <div className="p-5">
      <div className={`flex items-center gap-2 ${danger ? "text-error" : "text-amber-700"}`}><AlertIcon /><p className="text-sm font-semibold">{title}</p></div>
      {items.length > 0 ? items.map((item) => (
        <div key={item.name} className={`mt-3 rounded-xl border p-3 ${danger ? "border-red-200 bg-error-bg" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${danger ? "text-error" : "text-amber-900"}`}>{item.name}</p>
            {onToggle && <Button variant="ghost" className="!p-0 min-h-11 min-w-11 text-text-secondary" onClick={() => onToggle(item.name)} aria-label={`Quitar ${item.name}`}><CloseIcon /></Button>}
          </div>
          <p className="text-xs text-text-secondary mt-1.5">Fuentes: {item.sources.join(" · ")}</p>
        </div>
      )) : <p className="text-xs text-text-secondary mt-3">{danger ? "Ninguna fuente informa alérgenos que contiene." : "Ninguna fuente informa trazas."}</p>}
      {onToggle && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-text-primary">Agregar alérgeno</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {options.filter((option) => !items.some((item) => item.name === option)).map((option) => (
              <Button key={option} variant="secondary" className="min-h-11 !px-3" onClick={() => onToggle(option)}>+ {option}</Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceFlow({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-surface text-brand-600 flex items-center justify-center">{icon}</span><div><p className="text-xs font-semibold text-text-primary">{label}</p><p className="text-xs text-text-secondary">{detail}</p></div></div>;
}

function SourcePill({ label, small }: { label: string; small?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 ${small ? "px-2 py-0.5" : "px-2 py-0.5"} text-xs font-medium`}><span className="h-1 w-1 rounded-full bg-brand-600" />{label}</span>;
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
function ScanIcon() { return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" /><line x1="7" y1="8" x2="7" y2="16" /><line x1="10" y1="8" x2="10" y2="16" /><line x1="14" y1="8" x2="14" y2="16" /><line x1="17" y1="8" x2="17" y2="16" /></svg>; }
function EditIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function LoadingIcon() { return <svg className="animate-pulse" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></svg>; }
function SmallSpinner() { return <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 11-6.2-8.6" /></svg>; }
function CloseIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>; }
