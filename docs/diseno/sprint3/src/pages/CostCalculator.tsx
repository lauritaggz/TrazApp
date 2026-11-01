import { useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Unit = "g" | "kg" | "ml" | "L" | "unidad";

type Supply = {
  id: string;
  name: string;
  price: number | null;
  content: number | null;
  contentUnit: Unit;
  source: "Jumbo" | "Open Food Facts" | "Manual";
  priceDate: string;
};

type CostLineDefinition = {
  ingredient: string;
  quantity: number;
  unit: Unit;
  selectedSupplyId: string;
  supplies: Supply[];
  selectionReason: "Última elaboración" | "Insumo habitual";
};

type CalculatorProduct = {
  id: number;
  name: string;
  emoji: string;
  batchLabel: string;
  yield: number;
  lines: CostLineDefinition[];
};

const PRODUCTS: CalculatorProduct[] = [
  {
    id: 1,
    name: "Mermelada de frutilla",
    emoji: "🍓",
    batchLabel: "Tanda de 3,5 kg",
    yield: 10,
    lines: [
      { ingredient: "Frutillas frescas", quantity: 2.1, unit: "kg", selectedSupplyId: "fru-1", selectionReason: "Última elaboración", supplies: [
        { id: "fru-1", name: "Frutillas · Agrícola Los Boldos", price: 3990, content: 1, contentUnit: "kg", source: "Manual", priceDate: "2025-03-12" },
        { id: "fru-2", name: "Frutillas congeladas · Minuto Verde", price: 5490, content: 1, contentUnit: "kg", source: "Jumbo", priceDate: "2025-03-18" },
      ] },
      { ingredient: "Azúcar", quantity: 1.33, unit: "kg", selectedSupplyId: "azu-1", selectionReason: "Última elaboración", supplies: [
        { id: "azu-1", name: "Azúcar granulada · Iansa", price: 1490, content: 1, contentUnit: "kg", source: "Jumbo", priceDate: "2025-03-17" },
      ] },
      { ingredient: "Jugo de limón", quantity: 52.5, unit: "ml", selectedSupplyId: "lim-1", selectionReason: "Insumo habitual", supplies: [
        { id: "lim-1", name: "Jugo de limón · Minuto Verde", price: 2490, content: 1, contentUnit: "L", source: "Jumbo", priceDate: "2025-03-15" },
      ] },
      { ingredient: "Pectina natural", quantity: 17.5, unit: "g", selectedSupplyId: "pec-1", selectionReason: "Última elaboración", supplies: [
        { id: "pec-1", name: "Pectina cítrica · Sosa", price: 8990, content: 500, contentUnit: "g", source: "Manual", priceDate: "2025-03-14" },
      ] },
    ],
  },
  {
    id: 2,
    name: "Queso crema artesanal",
    emoji: "🧀",
    batchLabel: "Tanda de 5 kg",
    yield: 25,
    lines: [
      { ingredient: "Leche entera", quantity: 5, unit: "L", selectedSupplyId: "lec-1", selectionReason: "Última elaboración", supplies: [
        { id: "lec-1", name: "Leche entera · Colun", price: 1190, content: 1, contentUnit: "L", source: "Jumbo", priceDate: "2025-03-16" },
        { id: "lec-2", name: "Leche entera · Soprole", price: 1250, content: 1, contentUnit: "L", source: "Jumbo", priceDate: "2025-03-18" },
      ] },
      { ingredient: "Sal fina", quantity: 100, unit: "g", selectedSupplyId: "sal-1", selectionReason: "Insumo habitual", supplies: [
        { id: "sal-1", name: "Sal fina · Lobos", price: 890, content: 1, contentUnit: "kg", source: "Jumbo", priceDate: "2025-03-11" },
      ] },
      { ingredient: "Cultivo láctico", quantity: 10, unit: "g", selectedSupplyId: "cul-1", selectionReason: "Última elaboración", supplies: [
        { id: "cul-1", name: "Cultivo mesófilo · Chr. Hansen", price: 12900, content: 50, contentUnit: "g", source: "Manual", priceDate: "2025-03-10" },
      ] },
    ],
  },
  {
    id: 3,
    name: "Pan de campo integral",
    emoji: "🍞",
    batchLabel: "Tanda de 12 panes",
    yield: 12,
    lines: [
      { ingredient: "Harina integral", quantity: 4, unit: "kg", selectedSupplyId: "har-1", selectionReason: "Última elaboración", supplies: [
        { id: "har-1", name: "Harina integral · Selecta", price: 2190, content: 1, contentUnit: "kg", source: "Jumbo", priceDate: "2025-03-18" },
        { id: "har-2", name: "Harina integral · Molino del Sur", price: 8990, content: 5, contentUnit: "kg", source: "Manual", priceDate: "2025-03-13" },
      ] },
      { ingredient: "Agua purificada", quantity: 2.5, unit: "L", selectedSupplyId: "agu-1", selectionReason: "Insumo habitual", supplies: [
        { id: "agu-1", name: "Agua purificada · Red local", price: 20, content: 1, contentUnit: "L", source: "Manual", priceDate: "2025-03-01" },
      ] },
      { ingredient: "Masa madre activa", quantity: 500, unit: "g", selectedSupplyId: "mas-1", selectionReason: "Insumo habitual", supplies: [
        { id: "mas-1", name: "Masa madre · Elaboración propia", price: 800, content: 1, contentUnit: "kg", source: "Manual", priceDate: "2025-03-08" },
      ] },
      { ingredient: "Sal de mar", quantity: 80, unit: "g", selectedSupplyId: "sal-2", selectionReason: "Última elaboración", supplies: [
        { id: "sal-2", name: "Sal de mar · Salinas de Barrancas", price: 2490, content: 500, contentUnit: "g", source: "Open Food Facts", priceDate: "2025-03-09" },
      ] },
      { ingredient: "Semillas de linaza", quantity: 150, unit: "g", selectedSupplyId: "lin-1", selectionReason: "Última elaboración", supplies: [
        { id: "lin-1", name: "Linaza · Manare", price: null, content: 500, contentUnit: "g", source: "Open Food Facts", priceDate: "2025-03-07" },
      ] },
      { ingredient: "Semillas de maravilla", quantity: 120, unit: "g", selectedSupplyId: "mar-1", selectionReason: "Insumo habitual", supplies: [
        { id: "mar-1", name: "Semillas de maravilla · Positiv", price: 3490, content: 400, contentUnit: "g", source: "Jumbo", priceDate: "2025-03-17" },
      ] },
    ],
  },
  {
    id: 4,
    name: "Aceite de oliva extra virgen",
    emoji: "🫒",
    batchLabel: "Tanda de 20 L",
    yield: 40,
    lines: [
      { ingredient: "Aceitunas Arbequina", quantity: 100, unit: "kg", selectedSupplyId: "ace-1", selectionReason: "Última elaboración", supplies: [
        { id: "ace-1", name: "Aceitunas Arbequina · Fundo El Maitén", price: 1100, content: 1, contentUnit: "kg", source: "Manual", priceDate: "2025-03-05" },
      ] },
    ],
  },
];

type LineState = CostLineDefinition;
type OtherCost = { id: number; name: string; amount: number };

const UNIT_FACTORS: Record<Unit, { dimension: "mass" | "volume" | "unit"; factor: number }> = {
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  L: { dimension: "volume", factor: 1000 },
  unidad: { dimension: "unit", factor: 1 },
};

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function CostCalculator({ initialProductId = 1, onOpenProduct }: { initialProductId?: number; onOpenProduct: (id: number) => void }) {
  const initialProduct = PRODUCTS.find((product) => product.id === initialProductId) ?? PRODUCTS[0];
  const [productId, setProductId] = useState(initialProduct.id);
  const [lines, setLines] = useState<LineState[]>(initialProduct.lines);
  const [yieldCount, setYieldCount] = useState(initialProduct.yield);
  const [otherCosts, setOtherCosts] = useState<OtherCost[]>([
    { id: 1, name: "Gas y electricidad", amount: 1200 },
    { id: 2, name: "Envases y etiquetas", amount: 3500 },
  ]);

  const product = PRODUCTS.find((item) => item.id === productId) ?? PRODUCTS[0];

  function changeProduct(nextId: number) {
    const next = PRODUCTS.find((item) => item.id === nextId) ?? PRODUCTS[0];
    setProductId(next.id);
    setLines(next.lines);
    setYieldCount(next.yield);
    setOtherCosts([{ id: 1, name: "Gas y electricidad", amount: next.id === 4 ? 8500 : 1200 }]);
  }

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  const lineResults = lines.map((line) => {
    const supply = line.supplies.find((item) => item.id === line.selectedSupplyId);
    if (!line.quantity || line.quantity <= 0) return { cost: null, error: "Falta la cantidad usada en la tanda.", supply };
    if (!supply) return { cost: null, error: "Selecciona un insumo.", supply };
    if (supply.price === null) return { cost: null, error: "Falta el precio del insumo.", supply };
    if (supply.content === null || supply.content <= 0) return { cost: null, error: "Falta el contenido del insumo.", supply };
    const amountUnit = UNIT_FACTORS[line.unit];
    const contentUnit = UNIT_FACTORS[supply.contentUnit];
    if (amountUnit.dimension !== contentUnit.dimension) return { cost: null, error: `No se puede convertir ${line.unit} a ${supply.contentUnit}.`, supply };
    const cost = (line.quantity * amountUnit.factor / (supply.content * contentUnit.factor)) * supply.price;
    return { cost, error: null, supply };
  });

  const lineMissing = lineResults.flatMap((result, index) => result.error ? [`${lines[index].ingredient}: ${result.error}`] : []);
  const missing = [...lineMissing];
  if (!yieldCount || yieldCount <= 0) missing.push("Rendimiento: indica cuántas unidades salen de la tanda.");
  const ingredientTotal = lineResults.reduce((total, result) => total + (result.cost ?? 0), 0);
  const otherTotal = otherCosts.reduce((total, cost) => total + (Number(cost.amount) || 0), 0);
  const batchTotal = missing.length === 0 ? ingredientTotal + otherTotal : null;
  const unitTotal = batchTotal !== null && yieldCount > 0 ? batchTotal / yieldCount : null;
  const oldestPriceDate = lines
    .map((line) => line.supplies.find((supply) => supply.id === line.selectedSupplyId)?.priceDate)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-[#2f6b57] uppercase tracking-wider mb-1">Herramientas</p>
          <h1 className="text-2xl font-semibold text-[#1f2933]">Calculadora de costos</h1>
          <p className="text-sm text-[#667085] mt-1">Estima el costo de producir una tanda y cada unidad.</p>
        </div>
        <div className="w-full lg:w-80">
          <label htmlFor="cost-product" className="block text-xs font-medium text-[#667085] mb-1.5">Producto</label>
          <select id="cost-product" value={productId} onChange={(event) => changeProduct(Number(event.target.value))} className="w-full rounded-lg border border-[#e5e7e5] bg-white px-3 py-2.5 text-sm font-medium text-[#1f2933] focus:outline-none focus:ring-2 focus:ring-[#2f6b57]">
            {PRODUCTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[#f0f7f4] border border-[#b3dbd0] rounded-xl p-4 mb-5 flex items-start gap-3">
        <span className="h-9 w-9 rounded-lg bg-white text-[#2f6b57] flex items-center justify-center shrink-0"><InfoIcon /></span>
        <div>
          <p className="text-sm font-semibold text-[#1f2933]">Esta es una estimación con precios vigentes</p>
          <p className="text-xs text-[#667085] mt-1 leading-relaxed">No modifica elaboraciones ni versiones. Cambiar un insumo aquí solo afecta este cálculo; las cantidades se guardan en el producto.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-[#e5e7e5] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-[#f0f7f4] flex items-center justify-center text-xl">{product.emoji}</span>
                <div>
                  <h2 className="text-sm font-semibold text-[#1f2933]">Ingredientes de la formulación vigente</h2>
                  <p className="text-xs text-[#667085] mt-0.5">{product.batchLabel} · Guardado automático</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-[#027a48]"><CheckIcon /> Cantidades guardadas</span>
            </div>

            <div className="hidden lg:grid grid-cols-[1.05fr_1.45fr_150px_110px] gap-4 px-5 py-2.5 bg-[#f7f8f7] border-b border-[#e5e7e5] text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wide">
              <span>Ingrediente</span><span>Insumo seleccionado</span><span>Cantidad por tanda</span><span className="text-right">Costo</span>
            </div>

            <div className="divide-y divide-[#f0f0f0]">
              {lines.map((line, index) => {
                const result = lineResults[index];
                const supply = result.supply;
                return (
                  <div key={line.ingredient} className={`p-4 sm:p-5 ${result.error ? "bg-[#fffafa]" : ""}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.45fr_150px_110px] gap-3 lg:gap-4 lg:items-start">
                      <div>
                        <p className="text-[10px] lg:hidden font-semibold text-[#9aa4a8] uppercase tracking-wide mb-1">Ingrediente</p>
                        <p className="text-sm font-semibold text-[#1f2933]">{line.ingredient}</p>
                        <p className="text-[10px] text-[#667085] mt-1">{line.selectionReason}</p>
                      </div>
                      <div>
                        <p className="text-[10px] lg:hidden font-semibold text-[#9aa4a8] uppercase tracking-wide mb-1">Insumo seleccionado</p>
                        <select value={line.selectedSupplyId} onChange={(event) => updateLine(index, { selectedSupplyId: event.target.value })} className="w-full rounded-lg border border-[#e5e7e5] bg-white px-2.5 py-2 text-xs text-[#1f2933] focus:outline-none focus:ring-2 focus:ring-[#2f6b57]">
                          {line.supplies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        {supply && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[10px] text-[#667085]">
                            <span>{supply.price === null ? "Sin precio" : `${money.format(supply.price)} / ${supply.content ?? "—"} ${supply.contentUnit}`}</span>
                            <span className="text-[#c4c7c4]">·</span>
                            <span>{supply.source}</span>
                            <span className="text-[#c4c7c4]">·</span>
                            <span>{formatDate(supply.priceDate)}</span>
                            <Button variant="ghost" className="!p-0 !text-[10px]">Editar insumo</Button>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] lg:hidden font-semibold text-[#9aa4a8] uppercase tracking-wide mb-1">Cantidad por tanda</p>
                        <div className="flex">
                          <input type="number" min="0" step="any" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} aria-label={`Cantidad de ${line.ingredient}`} className="min-w-0 w-full rounded-l-lg border border-r-0 border-[#e5e7e5] bg-white px-2.5 py-2 text-sm text-[#1f2933] focus:outline-none focus:ring-2 focus:ring-[#2f6b57]" />
                          <select value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value as Unit })} aria-label={`Unidad de ${line.ingredient}`} className="w-16 rounded-r-lg border border-[#e5e7e5] bg-[#f7f8f7] px-2 py-2 text-xs text-[#1f2933] focus:outline-none focus:ring-2 focus:ring-[#2f6b57]">
                            {(["g", "kg", "ml", "L", "unidad"] as Unit[]).map((unit) => <option key={unit}>{unit}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="lg:text-right">
                        <p className="text-[10px] lg:hidden font-semibold text-[#9aa4a8] uppercase tracking-wide mb-1">Costo de la línea</p>
                        <p className={`text-sm font-semibold ${result.error ? "text-[#b42318]" : "text-[#1f2933]"}`}>{result.cost === null ? "Pendiente" : money.format(result.cost)}</p>
                      </div>
                    </div>
                    {result.error && <div className="mt-3 flex items-center gap-2 text-xs text-[#b42318]"><AlertIcon /> {result.error} Edita el insumo para completar sus datos.</div>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-[#e5e7e5] flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-[#1f2933]">Otros costos por tanda</h2><p className="text-xs text-[#667085] mt-0.5">Agrega energía, envases u otros costos directos.</p></div>
              <Button variant="ghost" className="!px-2.5 !py-1.5" onClick={() => setOtherCosts((costs) => [...costs, { id: Date.now(), name: "", amount: 0 }])}><PlusIcon /> Agregar</Button>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {otherCosts.map((cost) => (
                <div key={cost.id} className="p-4 sm:px-5 flex items-end gap-3">
                  <div className="flex-1"><Input label="Nombre" value={cost.name} placeholder="Ej. Envases" onChange={(event) => setOtherCosts((costs) => costs.map((item) => item.id === cost.id ? { ...item, name: event.target.value } : item))} /></div>
                  <div className="w-32"><Input label="Monto" type="number" min="0" value={cost.amount} leftIcon={<span className="text-xs">$</span>} onChange={(event) => setOtherCosts((costs) => costs.map((item) => item.id === cost.id ? { ...item, amount: Number(event.target.value) } : item))} /></div>
                  <Button variant="ghost" aria-label={`Eliminar ${cost.name || "costo"}`} className="!p-2.5 text-[#b42318]" onClick={() => setOtherCosts((costs) => costs.filter((item) => item.id !== cost.id))}><TrashIcon /></Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#e5e7e5] p-5">
            <h2 className="text-sm font-semibold text-[#1f2933]">Resumen del cálculo</h2>
            <div className="mt-4">
              <Input label="Rendimiento por tanda" type="number" min="0" value={yieldCount} onChange={(event) => setYieldCount(Number(event.target.value))} hint="Cantidad de productos terminados" />
            </div>
            <div className="mt-5 pt-4 border-t border-[#f0f0f0] space-y-3">
              <SummaryRow label="Ingredientes" value={lineMissing.length > 0 ? "Pendiente" : money.format(ingredientTotal)} warning={lineMissing.length > 0} />
              <SummaryRow label="Otros costos" value={money.format(otherTotal)} />
            </div>

            {missing.length > 0 ? (
              <div className="mt-5 rounded-lg border border-[#fecdca] bg-[#fef3f2] p-3">
                <div className="flex items-center gap-2 text-[#b42318]"><AlertIcon /><p className="text-xs font-semibold">No se puede calcular el total</p></div>
                <ul className="mt-2 space-y-1 pl-5 list-disc text-[10px] leading-relaxed text-[#b42318]">
                  {missing.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-[#2f6b57] p-4 text-white">
                <p className="text-xs text-[#c8e0d8]">Costo por tanda</p>
                <p className="text-2xl font-semibold mt-1">{money.format(batchTotal ?? 0)}</p>
                <div className="mt-4 pt-4 border-t border-white/15 flex items-end justify-between gap-3">
                  <p className="text-xs text-[#c8e0d8]">Costo por unidad</p>
                  <p className="text-xl font-semibold">{money.format(unitTotal ?? 0)}</p>
                </div>
                <span className="inline-flex mt-3 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium">Calculado</span>
              </div>
            )}

            {oldestPriceDate && <p className="text-[10px] text-[#667085] leading-relaxed mt-4">Precio más antiguo considerado: <strong className="font-medium text-[#1f2933]">{formatDate(oldestPriceDate)}</strong>.</p>}
            <Button variant="secondary" className="w-full mt-4" onClick={() => onOpenProduct(product.id)}>Ver detalle del producto</Button>
          </div>

          <div className="rounded-xl border border-[#e5e7e5] bg-[#f7f8f7] p-4 flex items-start gap-2.5">
            <span className="text-[#667085] mt-0.5"><LockIcon /></span>
            <p className="text-xs text-[#667085] leading-relaxed">La selección temporal de insumos no se guarda ni altera elaboraciones finalizadas.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-xs text-[#667085]">{label}</span><span className={`text-sm font-medium ${warning ? "text-[#b42318]" : "text-[#1f2933]"}`}>{value}</span></div>;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function InfoIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}
function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>;
}
function AlertIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function TrashIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6m3 0V4h8v2" /></svg>;
}
function LockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
}
