import { useState } from "react";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";

type ConsumerViewState = "published" | "unpublished" | "hidden-batch" | "no-batches";

interface ConsumerProductProps {
  onBack: () => void;
  productId: number;
}

type PublicProduct = {
  id: number;
  name: string;
  category: string;
  weight: string;
  manufacturer: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  batches: Array<{ code: string; date: string; bestBefore: string }>;
  supplies: Array<{ name: string; sourceLabel: string; source: string; detail: string }>;
  ingredients: string;
  contains: string[];
  traces: string[];
};

const PUBLIC_PRODUCTS: PublicProduct[] = [
  {
    id: 1,
    name: "Mermelada de frutilla",
    category: "Conservas",
    weight: "350 g",
    manufacturer: "Conservas Valle de Curicó",
    image: "https://images.unsplash.com/photo-1633084426862-3a8c25aa7ce5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxhcnRpc2FuJTIwc3RyYXdiZXJyeSUyMGphbSUyMGphciUyMHJ1c3RpYyUyMGZvb2QlMjBwcm9kdWN0fGVufDF8fHx8MTc5MzAyNzg4NXww&ixlib=rb-4.1.0&q=80&w=1080",
    imageAlt: "Frasco de mermelada artesanal de frutilla",
    imageCredit: "Barbara Chowaniec",
    batches: [
      { code: "MFRU-2025-042", date: "18 mar 2025", bestBefore: "18 sep 2025" },
      { code: "MFRU-2025-037", date: "6 mar 2025", bestBefore: "6 sep 2025" },
      { code: "MFRU-2025-029", date: "22 feb 2025", bestBefore: "22 ago 2025" },
    ],
    supplies: [
      { name: "Frutillas frescas", sourceLabel: "Origen", source: "Romeral, Región del Maule", detail: "Agrícola Los Boldos" },
      { name: "Azúcar granulada", sourceLabel: "Marca", source: "Iansa", detail: "Presentación 1 kg" },
      { name: "Jugo de limón", sourceLabel: "Origen", source: "Ovalle, Región de Coquimbo", detail: "Exprimido en planta" },
      { name: "Pectina cítrica", sourceLabel: "Marca", source: "Sosa Ingredients", detail: "Presentación 500 g" },
    ],
    ingredients: "Frutillas frescas, azúcar, jugo de limón y pectina cítrica.",
    contains: [],
    traces: ["Leche", "Frutos secos"],
  },
  {
    id: 2,
    name: "Queso crema artesanal",
    category: "Lácteos",
    weight: "200 g",
    manufacturer: "Lácteos Ranco",
    image: "https://images.unsplash.com/photo-1626624155295-d0152ab4200c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc2FuJTIwY3JlYW0lMjBjaGVlc2UlMjBib3dsJTIwcnVzdGljJTIwZm9vZHxlbnwxfHx8fDE3OTMwMjg0ODd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageAlt: "Queso crema artesanal servido en un recipiente",
    imageCredit: "Diniy Salleh",
    batches: [
      { code: "QCRE-2025-018", date: "20 mar 2025", bestBefore: "10 abr 2025" },
      { code: "QCRE-2025-016", date: "13 mar 2025", bestBefore: "3 abr 2025" },
    ],
    supplies: [
      { name: "Leche entera pasteurizada", sourceLabel: "Origen", source: "Río Bueno, Región de Los Ríos", detail: "Cooperativa Lechera del Sur" },
      { name: "Sal fina", sourceLabel: "Marca", source: "Lobos", detail: "Presentación 1 kg" },
      { name: "Cultivo láctico mesófilo", sourceLabel: "Marca", source: "Chr. Hansen", detail: "Cultivo para quesería" },
    ],
    ingredients: "Leche entera pasteurizada, cultivos lácticos y sal.",
    contains: ["Leche"],
    traces: [],
  },
  {
    id: 3,
    name: "Pan de campo integral",
    category: "Panificados",
    weight: "500 g",
    manufacturer: "Panadería Trigal de Ñuble",
    image: "https://images.unsplash.com/photo-1627308593341-d886acdc06a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc2FuJTIwd2hvbGUlMjB3aGVhdCUyMHNvdXJkb3VnaCUyMGJyZWFkJTIwbG9hZnxlbnwxfHx8fDE3OTMwMjg0ODd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageAlt: "Hogaza de pan integral artesanal",
    imageCredit: "Vicky Ng",
    batches: [
      { code: "PCI-2025-031", date: "21 mar 2025", bestBefore: "25 mar 2025" },
      { code: "PCI-2025-030", date: "20 mar 2025", bestBefore: "24 mar 2025" },
    ],
    supplies: [
      { name: "Harina integral de trigo", sourceLabel: "Marca", source: "Selecta", detail: "Saco 25 kg · Planta San Bernardo" },
      { name: "Agua purificada", sourceLabel: "Origen", source: "Chillán, Región de Ñuble", detail: "Red potable filtrada" },
      { name: "Sal de mar", sourceLabel: "Origen", source: "Cáhuil, Región de O'Higgins", detail: "Salinas de Barrancas" },
      { name: "Semillas de linaza", sourceLabel: "Marca", source: "Manare", detail: "Presentación 500 g" },
    ],
    ingredients: "Harina integral de trigo, agua, masa madre, sal de mar, semillas de linaza y semillas de maravilla.",
    contains: ["Gluten"],
    traces: ["Soya", "Sésamo"],
  },
  {
    id: 4,
    name: "Aceite de oliva extra virgen",
    category: "Aceites",
    weight: "500 ml",
    manufacturer: "Olivares del Limarí",
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbGl2ZSUyMG9pbCUyMGJvdHRsZSUyMGZvb2QlMjBwaG90b2dyYXBoeXxlbnwxfHx8fDE3OTMwMjg0OTN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageAlt: "Botella de aceite de oliva extra virgen",
    imageCredit: "Roberta Sorge",
    batches: [
      { code: "AOV-2025-009", date: "4 mar 2025", bestBefore: "4 mar 2027" },
      { code: "AOV-2025-006", date: "18 feb 2025", bestBefore: "18 feb 2027" },
    ],
    supplies: [
      { name: "Aceitunas variedad Arbequina", sourceLabel: "Origen", source: "Ovalle, Región de Coquimbo", detail: "Fundo El Maitén" },
    ],
    ingredients: "Aceitunas variedad Arbequina.",
    contains: [],
    traces: [],
  },
];

export default function ConsumerProduct({ onBack, productId }: ConsumerProductProps) {
  const [viewState, setViewState] = useState<ConsumerViewState>("published");
  const [activeProductId, setActiveProductId] = useState(productId);
  const product = PUBLIC_PRODUCTS.find((item) => item.id === activeProductId) ?? PUBLIC_PRODUCTS[0];

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[#1f2933]">
      <PreviewToolbar active={viewState} onChange={setViewState} onBack={onBack} productId={activeProductId} onProductChange={setActiveProductId} />

      <header className="bg-white border-b border-[#e5e7e5]">
        <div className="max-w-3xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
          <Logo size="sm" />
          <span className="inline-flex items-center gap-1.5 text-xs text-[#667085]">
            <ShieldIcon />
            Información trazable
          </span>
        </div>
      </header>

      {viewState === "unpublished" ? (
        <UnavailableState
          icon={<EyeOffIcon />}
          eyebrow="Producto no publicado"
          title="Esta ficha aún no está disponible"
          description="El fabricante todavía está preparando la información pública de este producto. Intenta nuevamente más adelante."
        />
      ) : (
        <main className="max-w-3xl mx-auto pb-10 sm:py-6 sm:px-6">
          <ProductHero product={product} />

          {viewState === "no-batches" ? (
            <div className="mx-4 sm:mx-0 mt-4">
              <UnavailableState
                compact
                icon={<CalendarOffIcon />}
                eyebrow="Sin elaboraciones"
                title="Todavía no hay elaboraciones disponibles"
                description="El producto está publicado, pero el fabricante aún no cargó una elaboración para consultar."
              />
              <DeclaredIngredients product={product} />
              <ConsumerNotice />
            </div>
          ) : (
            <div className="px-4 sm:px-0">
              <BatchSelector key={product.id} product={product} />
              {viewState === "hidden-batch" ? (
                <>
                  <UnavailableState
                    compact
                    icon={<EyeOffIcon />}
                    eyebrow="Elaboración no visible"
                    title="Esta elaboración fue ocultada"
                    description="La información de esta elaboración no está disponible públicamente. Puedes seleccionar otra elaboración del producto."
                  />
                  <ConsumerNotice />
                </>
              ) : (
                <PublishedTraceability product={product} />
              )}
            </div>
          )}
        </main>
      )}

      <footer className="border-t border-[#e5e7e5] bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <Logo size="sm" />
            <p className="text-[10px] text-[#9aa4a8] mt-2">Trazabilidad clara, del productor a tu mesa.</p>
          </div>
          <p className="text-[10px] text-[#9aa4a8]">Información actualizada por el fabricante · Foto: {product.imageCredit} / Unsplash</p>
        </div>
      </footer>
    </div>
  );
}

function PreviewToolbar({
  active,
  onChange,
  onBack,
  productId,
  onProductChange,
}: {
  active: ConsumerViewState;
  onChange: (state: ConsumerViewState) => void;
  onBack: () => void;
  productId: number;
  onProductChange: (id: number) => void;
}) {
  const states: Array<{ id: ConsumerViewState; label: string }> = [
    { id: "published", label: "Publicado" },
    { id: "unpublished", label: "No publicado" },
    { id: "hidden-batch", label: "Elaboración oculta" },
    { id: "no-batches", label: "Sin elaboraciones" },
  ];

  return (
    <div className="bg-[#1f2933] text-white">
      <div className="max-w-5xl mx-auto px-3 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold">Vista previa pública</p>
            <p className="text-[10px] text-[#c7cdd3]">Estos controles no son visibles para el consumidor.</p>
          </div>
          <Button variant="secondary" className="lg:hidden !px-2.5 !py-1.5 text-xs" onClick={onBack}>Salir</Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <select
            aria-label="Producto a previsualizar"
            value={productId}
            onChange={(event) => onProductChange(Number(event.target.value))}
            className="min-w-0 sm:w-48 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            {PUBLIC_PRODUCTS.map((product) => <option key={product.id} value={product.id} className="text-[#1f2933]">{product.name}</option>)}
          </select>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {states.map((state) => (
              <Button
                key={state.id}
                variant="ghost"
                onClick={() => onChange(state.id)}
                className={`!px-2.5 !py-1.5 text-xs whitespace-nowrap ${active === state.id ? "bg-white text-[#1f2933] hover:bg-white" : "text-[#d9dde1] hover:bg-white/10"}`}
              >
                {state.label}
              </Button>
            ))}
            <Button variant="secondary" className="hidden lg:inline-flex !px-2.5 !py-1.5 text-xs ml-2" onClick={onBack}>Salir de la vista previa</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductHero({ product }: { product: PublicProduct }) {
  return (
    <section className="bg-white sm:rounded-2xl border-y sm:border border-[#e5e7e5] overflow-hidden">
      <div className="relative aspect-[16/10] sm:aspect-[16/7] bg-[#e5e7e5]">
        <img src={product.image} alt={product.imageAlt} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute left-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-[#2f6b57]">
          <CheckCircleIcon />
          Información publicada
        </span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-medium text-[#2f6b57] mb-1.5">{product.category} · {product.weight}</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1f2933]">{product.name}</h1>
        <div className="flex items-center gap-2 mt-3">
          <div className="h-8 w-8 rounded-full bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center"><ProducerIcon /></div>
          <div>
            <p className="text-[10px] text-[#9aa4a8] uppercase tracking-wide">Elaborado por</p>
            <p className="text-sm font-medium text-[#1f2933]">{product.manufacturer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BatchSelector({ product }: { product: PublicProduct }) {
  const [batchCode, setBatchCode] = useState(product.batches[0].code);
  const currentBatch = product.batches.find((batch) => batch.code === batchCode) ?? product.batches[0];
  return (
    <section className="bg-white rounded-xl border border-[#e5e7e5] p-4 sm:p-5 mt-4">
      <label htmlFor="consumer-batch" className="block text-sm font-semibold text-[#1f2933] mb-1.5">Elaboración consultada</label>
      <p className="text-xs text-[#667085] mb-3">Selecciona el lote que aparece en el envase.</p>
      <div className="relative">
        <select id="consumer-batch" value={batchCode} onChange={(event) => setBatchCode(event.target.value)} className="w-full appearance-none rounded-lg border border-[#e5e7e5] bg-white px-3 py-3 pr-10 text-sm font-medium text-[#1f2933] focus:outline-none focus:ring-2 focus:ring-[#2f6b57]">
          {product.batches.map((batch) => <option key={batch.code} value={batch.code}>Lote {batch.code} · {batch.date}</option>)}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none"><ChevronDownIcon /></span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#f0f0f0]">
        <PublicMeta label="Fecha de elaboración" value={currentBatch.date} />
        <PublicMeta label="Consumir preferentemente" value={currentBatch.bestBefore} />
      </div>
    </section>
  );
}

function PublishedTraceability({ product }: { product: PublicProduct }) {
  return (
    <>
      <section className="mt-6">
        <SectionHeading icon={<PackageIcon />} title="Insumos utilizados" description="Productos concretos usados en esta elaboración." />
        <div className="space-y-2.5">
          {product.supplies.map((supply, index) => (
            <div key={supply.name} className="bg-white rounded-xl border border-[#e5e7e5] p-4 flex items-start gap-3">
              <span className="h-7 w-7 rounded-full bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center text-xs font-semibold shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1f2933]">{supply.name}</p>
                <p className="text-xs text-[#667085] mt-1">{supply.detail}</p>
              </div>
              <div className="text-right shrink-0 max-w-[42%]">
                <p className="text-[10px] text-[#9aa4a8] uppercase tracking-wide">{supply.sourceLabel}</p>
                <p className="text-xs font-medium text-[#1f2933] mt-0.5">{supply.source}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <DeclaredIngredients product={product} />

      <section className="mt-6">
        <SectionHeading icon={<AlertIcon />} title="Información de alérgenos" description="Declaración informada por el fabricante para esta elaboración." />
        <div className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
          <div className="p-4 border-b border-[#f0f0f0] flex items-start gap-3">
            <span className="h-8 w-8 rounded-lg bg-[#fef3f2] text-[#b42318] flex items-center justify-center shrink-0"><AlertIcon /></span>
            <div>
              <p className="text-[10px] font-semibold text-[#b42318] uppercase tracking-wider">Contiene</p>
              {product.contains.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">{product.contains.map((allergen) => <AllergenPill key={allergen} label={allergen} danger />)}</div>
              ) : (
                <p className="text-sm font-medium text-[#1f2933] mt-1">No contiene alérgenos de declaración obligatoria</p>
              )}
            </div>
          </div>
          <div className="p-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-lg bg-[#fef9c3] text-[#854d0e] flex items-center justify-center shrink-0"><TraceIcon /></span>
            <div>
              <p className="text-[10px] font-semibold text-[#854d0e] uppercase tracking-wider">Puede contener trazas de</p>
              {product.traces.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">{product.traces.map((allergen) => <AllergenPill key={allergen} label={allergen} />)}</div>
              ) : (
                <p className="text-sm font-medium text-[#1f2933] mt-1">No se declaran trazas de alérgenos</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <ConsumerNotice />
    </>
  );
}

function DeclaredIngredients({ product }: { product: PublicProduct }) {
  return (
    <section className="mt-6">
      <SectionHeading icon={<LeafIcon />} title="Ingredientes declarados" description="Componentes de la formulación, ordenados de mayor a menor proporción." />
      <div className="bg-white rounded-xl border border-[#e5e7e5] p-4 sm:p-5">
        <p className="text-sm text-[#1f2933] leading-7">{product.ingredients}</p>
      </div>
    </section>
  );
}

function ConsumerNotice() {
  return (
    <aside className="mt-6 rounded-xl border border-[#e5e7e5] bg-[#f7f8f7] p-4 flex items-start gap-3">
      <span className="text-[#667085] shrink-0 mt-0.5"><InfoIcon /></span>
      <div>
        <p className="text-xs font-semibold text-[#1f2933]">Información complementaria</p>
        <p className="text-xs text-[#667085] mt-1 leading-relaxed">Esta ficha no reemplaza el rotulado del envase ni certifica la inocuidad o seguridad del producto. Ante alergias o dudas, revisa siempre la etiqueta y contacta al fabricante.</p>
      </div>
    </aside>
  );
}

function UnavailableState({ icon, eyebrow, title, description, compact }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "my-4 rounded-xl border border-[#e5e7e5] bg-white px-5 py-9" : "max-w-md mx-auto px-6 py-24"} text-center`}>
      <div className="h-12 w-12 rounded-full bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center mx-auto mb-4">{icon}</div>
      <p className="text-[10px] font-semibold text-[#2f6b57] uppercase tracking-wider mb-2">{eyebrow}</p>
      <h1 className={`${compact ? "text-lg" : "text-xl"} font-semibold text-[#1f2933]`}>{title}</h1>
      <p className="text-sm text-[#667085] leading-relaxed mt-2">{description}</p>
    </div>
  );
}

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <span className="text-[#2f6b57] mt-0.5">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-[#1f2933]">{title}</h2>
        <p className="text-xs text-[#667085] mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function PublicMeta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-[#9aa4a8] uppercase tracking-wide">{label}</p><p className="text-xs font-medium text-[#1f2933] mt-1">{value}</p></div>;
}

function AllergenPill({ label, danger }: { label: string; danger?: boolean }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${danger ? "bg-[#fef3f2] border-[#fecdca] text-[#b42318]" : "bg-[#fef9c3] border-[#fde68a] text-[#854d0e]"}`}>{label}</span>;
}

function ShieldIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function CheckCircleIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.1V12a10 10 0 11-5.9-9.1" /><polyline points="22 4 12 14 9 11" /></svg>;
}
function ProducerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><path d="M6 21V8l6-4 6 4v13" /><path d="M9 21v-6h6v6" /></svg>;
}
function ChevronDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>;
}
function PackageIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.3 7 12 12 20.7 7" /></svg>;
}
function LeafIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 8C8 10 5.9 16.2 3.8 19.8A2 2 0 004 22h1c8.3 0 15-6.7 15-15V6l-3 2z" /><line x1="7" y1="17" x2="13" y2="11" /></svg>;
}
function AlertIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
}
function TraceIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a8 8 0 008-8c0-5-4-7-4-12-4 3-5 6-4 9-2-2-3-4-2-7-3 2-6 6-6 10a8 8 0 008 8z" /></svg>;
}
function InfoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}
function EyeOffIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.9 17.9A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.9" /><path d="M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}
function CalendarOffIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="3" y1="11" x2="21" y2="11" /><line x1="9" y1="15" x2="15" y2="19" /><line x1="15" y1="15" x2="9" y2="19" /></svg>;
}
