import { useState } from "react";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import CostCalculator from "@/pages/CostCalculator";
import Publications from "@/pages/Publications";
import NewSupply from "@/pages/NewSupply";
import Elaborations from "@/pages/Elaborations";

interface DashboardProps {
  producerName: string;
  onLogout: () => void;
  onOpenPublic: (productId: number) => void;
}

type ActivePage = "inicio" | "productos" | "ingredientes" | "insumos" | "insumo-nuevo" | "elaboraciones" | "costos" | "publicaciones" | "producto-detalle" | "ingrediente-detalle" | "insumo-detalle";

/* ─── Sample data ─── */
const SAMPLE_PRODUCTS = [
  {
    id: 1,
    name: "Mermelada de frutilla",
    category: "Conservas",
    description: "Mermelada artesanal elaborada con frutillas frescas de temporada, sin conservantes ni colorantes artificiales. Cocción lenta para preservar el sabor natural de la fruta.",
    ingredients: 4,
    status: "completo" as const,
    updatedAt: "Hace 2 días",
    createdAt: "12 de marzo, 2025",
    color: "#b3dbd0",
    emoji: "🍓",
    netWeight: "350 g",
    lot: "MFRU-2025-042",
    certifications: ["Sin gluten", "Sin conservantes"],
  },
  {
    id: 2,
    name: "Queso crema artesanal",
    category: "Lácteos",
    description: "Queso crema elaborado con leche entera de una lechería local, sin aditivos. Textura suave y sabor fresco, ideal para untar.",
    ingredients: 3,
    status: "completo" as const,
    updatedAt: "Hace 5 días",
    createdAt: "3 de febrero, 2025",
    color: "#fde8b0",
    emoji: "🧀",
    netWeight: "200 g",
    lot: "QCRE-2025-018",
    certifications: ["Sin conservantes"],
  },
  {
    id: 3,
    name: "Pan de campo integral",
    category: "Panificados",
    description: "Pan integral de masa madre con harina de trigo de molienda regional. Fermentación natural de 18 horas. Trazabilidad de ingredientes en proceso de documentación.",
    ingredients: 6,
    status: "incompleto" as const,
    updatedAt: "Hace 1 semana",
    createdAt: "28 de enero, 2025",
    color: "#f5d5c0",
    emoji: "🍞",
    netWeight: "500 g",
    lot: "PCI-2025-031",
    certifications: ["Masa madre", "Sin aditivos"],
  },
  {
    id: 4,
    name: "Aceite de oliva extra virgen",
    category: "Aceites",
    description: "Aceite de primera prensada en frío, obtenido de aceitunas verdes cultivadas en un fundo del valle del Limarí. Acidez inferior al 0,5 %.",
    ingredients: 1,
    status: "completo" as const,
    updatedAt: "Hace 3 días",
    createdAt: "20 de enero, 2025",
    color: "#d4edcc",
    emoji: "🫒",
    netWeight: "500 ml",
    lot: "AOV-2025-009",
    certifications: ["Primera prensada", "Sin refinar"],
  },
];

const PRODUCT_INGREDIENTS: Record<number, Array<{ id: number; name: string; origin: string; supplier: string; traceability: "completa" | "parcial" | "pendiente"; quantity: string }>> = {
  1: [
    { id: 1, name: "Frutillas frescas", origin: "Romeral, Región del Maule", supplier: "Agrícola Los Boldos", traceability: "completa", quantity: "60 %" },
    { id: 2, name: "Azúcar granulada", origin: "Linares, Región del Maule", supplier: "Iansa", traceability: "completa", quantity: "38 %" },
    { id: 3, name: "Jugo de limón", origin: "Ovalle, Región de Coquimbo", supplier: "Elaboración propia", traceability: "completa", quantity: "1,5 %" },
    { id: 4, name: "Pectina natural", origin: "Santiago, Región Metropolitana", supplier: "Distribuidora Gastronómica Sur", traceability: "parcial", quantity: "0,5 %" },
  ],
  2: [
    { id: 1, name: "Leche entera", origin: "Río Bueno, Región de Los Ríos", supplier: "Cooperativa Lechera del Sur", traceability: "completa", quantity: "95 %" },
    { id: 2, name: "Sal fina", origin: "Región de Tarapacá", supplier: "Lobos", traceability: "completa", quantity: "2 %" },
    { id: 3, name: "Cultivo láctico", origin: "Santiago, Región Metropolitana", supplier: "Proveedor especializado", traceability: "completa", quantity: "3 %" },
  ],
  3: [
    { id: 1, name: "Harina integral", origin: "San Bernardo, Región Metropolitana", supplier: "Molino Selecta", traceability: "completa", quantity: "55 %" },
    { id: 2, name: "Agua purificada", origin: "Chillán, Región de Ñuble", supplier: "Red potable filtrada", traceability: "completa", quantity: "35 %" },
    { id: 3, name: "Masa madre activa", origin: "Propia", supplier: "Propia elaboración", traceability: "parcial", quantity: "7 %" },
    { id: 4, name: "Sal de mar", origin: "Cáhuil, Región de O'Higgins", supplier: "Salinas de Barrancas", traceability: "pendiente", quantity: "2 %" },
    { id: 5, name: "Semillas de lino", origin: "Por confirmar", supplier: "Por confirmar", traceability: "pendiente", quantity: "0,7 %" },
    { id: 6, name: "Semillas de maravilla", origin: "Por confirmar", supplier: "Por confirmar", traceability: "pendiente", quantity: "0,3 %" },
  ],
  4: [
    { id: 1, name: "Aceitunas Arbequina", origin: "Ovalle, Región de Coquimbo", supplier: "Fundo El Maitén", traceability: "completa", quantity: "100 %" },
  ],
};

const SAMPLE_INGREDIENTS = [
  { id: 1, name: "Harina de trigo", category: "Cereales y harinas", productsUsed: 2, supplies: 2, allergens: ["Gluten"] },
  { id: 2, name: "Leche", category: "Lácteos", productsUsed: 1, supplies: 2, allergens: ["Leche"] },
  { id: 3, name: "Huevo", category: "Huevos y derivados", productsUsed: 2, supplies: 1, allergens: ["Huevo"] },
  { id: 4, name: "Azúcar", category: "Endulzantes", productsUsed: 2, supplies: 1, allergens: [] },
  { id: 5, name: "Frutillas frescas", category: "Frutas", productsUsed: 1, supplies: 0, allergens: [] },
  { id: 6, name: "Aceite de oliva", category: "Aceites", productsUsed: 1, supplies: 0, allergens: [] },
];

const SAMPLE_SUPPLIES = [
  { id: 1, name: "Harina Selecta sin polvos", brand: "Selecta", presentation: "Bolsa 1 kg", ingredient: "Harina de trigo", barcode: "7801234567890", allergens: ["Gluten"], updatedAt: "Actualizado ayer" },
  { id: 2, name: "Harina de fuerza", brand: "Molino del Sur", presentation: "Saco 5 kg", ingredient: "Harina de trigo", barcode: "Sin código", allergens: ["Gluten", "Puede contener soya"], updatedAt: "Hace 4 días" },
  { id: 3, name: "Leche sin lactosa", brand: "Loncoleche", presentation: "Caja 1 L", ingredient: "Leche", barcode: "7802920001841", allergens: ["Leche"], updatedAt: "Hace 2 días" },
  { id: 4, name: "Leche entera", brand: "Colun", presentation: "Caja 1 L", ingredient: "Leche", barcode: "7802920001254", allergens: ["Leche"], updatedAt: "Hace 1 semana" },
  { id: 5, name: "Huevos de campo", brand: "Granja Santa Ana", presentation: "Bandeja 30 unidades", ingredient: "Huevo", barcode: "Sin código", allergens: ["Huevo"], updatedAt: "Hace 3 días" },
  { id: 6, name: "Azúcar granulada", brand: "Iansa", presentation: "Bolsa 1 kg", ingredient: "Azúcar", barcode: "7801110000015", allergens: [], updatedAt: "Hace 6 días" },
];

const INGREDIENT_FORMULATIONS: Record<number, Array<{ product: string; category: string; quantity: string }>> = {
  1: [{ product: "Pan de campo integral", category: "Panificados", quantity: "55 %" }, { product: "Galletas de avena", category: "Panificados", quantity: "42 %" }],
  2: [{ product: "Queso crema artesanal", category: "Lácteos", quantity: "95 %" }],
  3: [{ product: "Galletas de avena", category: "Panificados", quantity: "12 %" }, { product: "Bizcocho casero", category: "Panificados", quantity: "18 %" }],
  4: [{ product: "Mermelada de frutilla", category: "Conservas", quantity: "38 %" }, { product: "Galletas de avena", category: "Panificados", quantity: "16 %" }],
  5: [{ product: "Mermelada de frutilla", category: "Conservas", quantity: "60 %" }],
  6: [{ product: "Aceite de oliva extra virgen", category: "Aceites", quantity: "100 %" }],
};

export default function Dashboard({ producerName, onLogout, onOpenPublic }: DashboardProps) {
  const [activePage, setActivePage] = useState<ActivePage>("inicio");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [selectedSupplyId, setSelectedSupplyId] = useState<number | null>(null);
  const [costProductId, setCostProductId] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const firstName = producerName.split(" ")[0];

  function openProduct(id: number) {
    setSelectedProductId(id);
    setActivePage("producto-detalle");
  }

  function openIngredient(id: number) {
    setSelectedIngredientId(id);
    setActivePage("ingrediente-detalle");
  }

  function openSupply(id: number) {
    setSelectedSupplyId(id);
    setActivePage("insumo-detalle");
  }

  const breadcrumbLabel =
    activePage === "inicio" ? "Inicio"
    : activePage === "productos" ? "Productos"
    : activePage === "ingredientes" ? "Ingredientes"
    : activePage === "insumos" ? "Insumos"
    : activePage === "insumo-nuevo" ? "Nuevo insumo"
    : activePage === "elaboraciones" ? "Elaboraciones"
    : activePage === "costos" ? "Calculadora de costos"
    : activePage === "publicaciones" ? "Publicaciones"
    : activePage === "ingrediente-detalle"
      ? SAMPLE_INGREDIENTS.find((ingredient) => ingredient.id === selectedIngredientId)?.name ?? "Ingrediente"
    : activePage === "insumo-detalle"
      ? SAMPLE_SUPPLIES.find((supply) => supply.id === selectedSupplyId)?.name ?? "Insumo"
    : activePage === "producto-detalle"
      ? SAMPLE_PRODUCTS.find((p) => p.id === selectedProductId)?.name ?? "Producto"
    : "Inicio";

  return (
    <div className="min-h-screen bg-[#f7f8f7] flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-[220px] bg-white border-r border-[#e5e7e5] transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center h-16 px-5 border-b border-[#e5e7e5] shrink-0">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wider px-3 pb-2 pt-1">Gestión</p>
          <NavItem icon={<HomeIcon />} label="Inicio" active={activePage === "inicio"} onClick={() => { setActivePage("inicio"); setSidebarOpen(false); }} />
          <NavItem icon={<BoxIcon />} label="Productos" active={activePage === "productos" || activePage === "producto-detalle"} badge={SAMPLE_PRODUCTS.length} onClick={() => { setActivePage("productos"); setSidebarOpen(false); }} />
          <NavItem icon={<LeafIcon />} label="Ingredientes" active={activePage === "ingredientes" || activePage === "ingrediente-detalle"} badge={SAMPLE_INGREDIENTS.length} onClick={() => { setActivePage("ingredientes"); setSidebarOpen(false); }} />
          <NavItem icon={<PackageIcon />} label="Insumos" active={activePage === "insumos" || activePage === "insumo-detalle" || activePage === "insumo-nuevo"} badge={SAMPLE_SUPPLIES.length} onClick={() => { setActivePage("insumos"); setSidebarOpen(false); }} />
          <NavItem icon={<HistoryIcon />} label="Elaboraciones" active={activePage === "elaboraciones"} badge={5} onClick={() => { setActivePage("elaboraciones"); setSidebarOpen(false); }} />
          <p className="text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wider px-3 pb-2 pt-5">Herramientas</p>
          <NavItem icon={<CalculatorIcon />} label="Calculadora de costos" active={activePage === "costos"} onClick={() => { setActivePage("costos"); setSidebarOpen(false); }} />
          <NavItem icon={<QrIcon />} label="Publicaciones" active={activePage === "publicaciones"} onClick={() => { setActivePage("publicaciones"); setSidebarOpen(false); }} />
        </nav>
        <div className="px-3 pb-4 border-t border-[#e5e7e5] pt-3 space-y-1 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-[#2f6b57] flex items-center justify-center text-white text-xs font-semibold shrink-0">{firstName[0]}</div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#1f2933] truncate">{producerName}</p>
              <p className="text-[10px] text-[#667085]">Productor</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-[#667085] hover:text-[#b42318] hover:bg-[#fef3f2] transition-colors">
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-16 flex items-center justify-between px-5 lg:px-8 bg-white border-b border-[#e5e7e5] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-md text-[#667085] hover:bg-[#f7f8f7] transition-colors" aria-label="Abrir menú">
              <MenuIcon />
            </button>
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <button onClick={() => setActivePage("inicio")} className="text-[#667085] hover:text-[#2f6b57] transition-colors">TrazApp</button>
              {activePage !== "inicio" && (
                <>
                  <span className="text-[#e5e7e5]">/</span>
                  {activePage === "producto-detalle" || activePage === "ingrediente-detalle" || activePage === "insumo-detalle" || activePage === "insumo-nuevo" ? (
                    <>
                      <button onClick={() => setActivePage(activePage === "producto-detalle" ? "productos" : activePage === "ingrediente-detalle" ? "ingredientes" : "insumos")} className="text-[#667085] hover:text-[#2f6b57] transition-colors">
                        {activePage === "producto-detalle" ? "Productos" : activePage === "ingrediente-detalle" ? "Ingredientes" : "Insumos"}
                      </button>
                      <span className="text-[#e5e7e5]">/</span>
                      <span className="text-[#1f2933] font-medium truncate max-w-[180px]">{breadcrumbLabel}</span>
                    </>
                  ) : (
                    <span className="text-[#1f2933] font-medium capitalize">{breadcrumbLabel}</span>
                  )}
                </>
              )}
            </nav>
          </div>
          <button className="flex items-center gap-2 text-sm text-[#667085] hover:text-[#1f2933] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#f7f8f7]">
            <BellIcon />
            <span className="hidden sm:block">Notificaciones</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          {activePage === "inicio" && <HomePage firstName={firstName} onNavigate={(p) => setActivePage(p as ActivePage)} onOpenProduct={openProduct} />}
          {activePage === "productos" && <ProductsPage onBack={() => setActivePage("inicio")} onOpenProduct={openProduct} />}
          {activePage === "ingredientes" && <IngredientsPage onOpenSupplies={() => setActivePage("insumos")} onOpenIngredient={openIngredient} />}
          {activePage === "insumos" && <SuppliesPage onOpenIngredients={() => setActivePage("ingredientes")} onOpenSupply={openSupply} onNewSupply={() => setActivePage("insumo-nuevo")} />}
          {activePage === "insumo-nuevo" && <NewSupply onBack={() => setActivePage("insumos")} onUseExisting={(id) => openSupply(id)} />}
          {activePage === "elaboraciones" && <Elaborations />}
          {activePage === "costos" && <CostCalculator initialProductId={costProductId} onOpenProduct={(id) => { setSelectedProductId(id); setActivePage("producto-detalle"); }} />}
          {activePage === "publicaciones" && <Publications onPreview={onOpenPublic} />}
          {activePage === "ingrediente-detalle" && selectedIngredientId !== null && (
            <IngredientDetailPage
              ingredient={SAMPLE_INGREDIENTS.find((ingredient) => ingredient.id === selectedIngredientId)!}
              onBack={() => setActivePage("ingredientes")}
              onOpenSupply={openSupply}
            />
          )}
          {activePage === "insumo-detalle" && selectedSupplyId !== null && (
            <SupplyDetailPage
              supply={SAMPLE_SUPPLIES.find((supply) => supply.id === selectedSupplyId)!}
              onBack={() => setActivePage("insumos")}
              onOpenIngredient={openIngredient}
            />
          )}
          {activePage === "producto-detalle" && selectedProductId !== null && (
            <ProductDetailPage
              product={SAMPLE_PRODUCTS.find((p) => p.id === selectedProductId)!}
              ingredients={PRODUCT_INGREDIENTS[selectedProductId] ?? []}
              onBack={() => setActivePage("productos")}
              onOpenPublic={() => setActivePage("publicaciones")}
              onOpenCosts={() => { setCostProductId(selectedProductId); setActivePage("costos"); }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── Product detail page ─── */
function ProductDetailPage({
  product,
  ingredients,
  onBack,
  onOpenPublic,
  onOpenCosts,
}: {
  product: typeof SAMPLE_PRODUCTS[0];
  ingredients: typeof PRODUCT_INGREDIENTS[1];
  onBack: () => void;
  onOpenPublic: () => void;
  onOpenCosts: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"ingredientes" | "informacion">("ingredientes");
  const complete = ingredients.filter((i) => i.traceability === "completa").length;
  const partial = ingredients.filter((i) => i.traceability === "parcial").length;
  const pending = ingredients.filter((i) => i.traceability === "pendiente").length;
  const tracePercent = Math.round(((complete + partial * 0.5) / ingredients.length) * 100);
  const calculatedCosts: Record<number, { unit: string; manual: string }> = {
    1: { unit: "$1.551", manual: "$1.650" },
    2: { unit: "$586", manual: "$650" },
    3: { unit: "Pendiente", manual: "$1.200" },
    4: { unit: "$2.963", manual: "$3.200" },
  };
  const cost = calculatedCosts[product.id];

  return (
    <div className="max-w-3xl">
      <BackButton onClick={onBack} label="Volver a Productos" />

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-[#e5e7e5] overflow-hidden mb-5">
        {/* Color strip */}
        <div className="h-2 w-full" style={{ backgroundColor: product.color }} />

        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: product.color + "55" }}>
              {product.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl font-semibold text-[#1f2933]">{product.name}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-[#667085] bg-[#f7f8f7] border border-[#e5e7e5] rounded-full px-2.5 py-0.5">{product.category}</span>
                    <StatusBadge status={product.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={onOpenCosts} className="flex items-center gap-1.5 text-sm font-medium text-[#2f6b57] bg-[#f0f7f4] border border-[#b3dbd0] rounded-lg px-3 py-1.5 hover:bg-[#d9ede6] transition-colors">
                    <CalculatorIcon /> Costos
                  </button>
                  <button className="flex items-center gap-1.5 text-sm font-medium text-[#667085] hover:text-[#1f2933] bg-[#f7f8f7] border border-[#e5e7e5] rounded-lg px-3 py-1.5 transition-colors">
                    <EditIcon /> Editar
                  </button>
                  <button onClick={onOpenPublic} className="flex items-center gap-1.5 text-sm font-medium text-[#2f6b57] bg-[#f0f7f4] border border-[#b3dbd0] rounded-lg px-3 py-1.5 hover:bg-[#d9ede6] transition-colors">
                    <QrIcon /> Ver QR
                  </button>
                </div>
              </div>
              <p className="text-sm text-[#667085] mt-3 leading-relaxed max-w-xl">{product.description}</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-5 pt-4 border-t border-[#f0f0f0] grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetaItem label="Peso neto" value={product.netWeight} />
            <MetaItem label="Lote" value={product.lot} mono />
            <MetaItem label="Actualizado" value={product.updatedAt} />
            <MetaItem label="Creado" value={product.createdAt} />
          </div>

          {/* Certifications */}
          {product.certifications.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.certifications.map((cert) => (
                <span key={cert} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2f6b57] bg-[#f0f7f4] border border-[#b3dbd0] rounded-full px-2.5 py-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {cert}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e5e7e5] px-5 py-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0"><CalculatorIcon /></div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#1f2933]">Costo de producción</p>
              {cost.unit !== "Pendiente" && <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-semibold text-[#027a48]">Calculado</span>}
            </div>
            <p className="text-xs text-[#667085] mt-0.5">Valor manual: {cost.manual} por unidad</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="sm:text-right">
            <p className={`text-lg font-semibold ${cost.unit === "Pendiente" ? "text-[#b42318]" : "text-[#1f2933]"}`}>{cost.unit}</p>
            <p className="text-[10px] text-[#9aa4a8]">{cost.unit === "Pendiente" ? "Faltan datos" : "por unidad"}</p>
          </div>
          <Button variant="ghost" className="!px-2.5 !py-1.5" onClick={onOpenCosts}>Abrir calculadora <ArrowRightIcon /></Button>
        </div>
      </div>

      {/* Traceability summary */}
      <div className="bg-white rounded-xl border border-[#e5e7e5] px-6 py-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[#1f2933]">Trazabilidad de ingredientes</p>
            <p className="text-xs text-[#667085] mt-0.5">{complete} de {ingredients.length} ingredientes con información completa</p>
          </div>
          <span className="text-2xl font-bold" style={{ color: tracePercent >= 80 ? "#027a48" : tracePercent >= 50 ? "#854d0e" : "#b42318" }}>
            {tracePercent}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#f0f0f0] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${tracePercent}%`,
              backgroundColor: tracePercent >= 80 ? "#2f6b57" : tracePercent >= 50 ? "#d97706" : "#b42318",
            }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3">
          <TraceLegend color="#2f6b57" bg="#ecfdf3" label="Completa" count={complete} />
          <TraceLegend color="#854d0e" bg="#fef9c3" label="Parcial" count={partial} />
          <TraceLegend color="#b42318" bg="#fef3f2" label="Pendiente" count={pending} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-[#f0f0f0] p-1 rounded-xl w-fit mb-5">
        {(["ingredientes", "informacion"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-white text-[#1f2933] shadow-sm" : "text-[#667085] hover:text-[#1f2933]"}`}
          >
            {tab === "ingredientes" ? "Ingredientes" : "Información adicional"}
          </button>
        ))}
      </div>

      {/* Ingredients tab */}
      {activeTab === "ingredientes" && (
        <div className="space-y-2.5">
          {ingredients.map((ing, idx) => (
            <IngredientRow key={ing.id} ingredient={ing} index={idx + 1} total={ingredients.length} />
          ))}
          <button className="w-full mt-1 flex items-center justify-center gap-2 border border-dashed border-[#b3dbd0] rounded-xl py-3 text-sm font-medium text-[#2f6b57] hover:bg-[#f0f7f4] transition-colors">
            <PlusIcon /> Agregar ingrediente
          </button>
        </div>
      )}

      {/* Info tab */}
      {activeTab === "informacion" && (
        <div className="bg-white rounded-xl border border-[#e5e7e5] divide-y divide-[#f0f0f0]">
          {[
            { label: "Nombre del producto", value: product.name },
            { label: "Categoría", value: product.category },
            { label: "Peso / Volumen neto", value: product.netWeight },
            { label: "Número de lote", value: product.lot },
            { label: "Fecha de creación", value: product.createdAt },
            { label: "Última actualización", value: product.updatedAt },
            { label: "Certificaciones", value: product.certifications.join(", ") || "—" },
            { label: "Estado de trazabilidad", value: product.status === "completo" ? "Completa" : "En progreso" },
          ].map((row) => (
            <div key={row.label} className="flex items-start justify-between px-5 py-3.5 gap-4">
              <span className="text-sm text-[#667085] shrink-0">{row.label}</span>
              <span className="text-sm font-medium text-[#1f2933] text-right">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IngredientRow({
  ingredient,
  index,
  total,
}: {
  ingredient: typeof PRODUCT_INGREDIENTS[1][0];
  index: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const traceConfig = {
    completa: { bg: "#ecfdf3", text: "#027a48", border: "#a9efc5", label: "Completa" },
    parcial: { bg: "#fef9c3", text: "#854d0e", border: "#fde68a", label: "Parcial" },
    pendiente: { bg: "#fef3f2", text: "#b42318", border: "#fecdca", label: "Pendiente" },
  }[ingredient.traceability];

  return (
    <div className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden hover:border-[#b3dbd0] transition-colors">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Step indicator */}
        <div className="flex flex-col items-center shrink-0 self-stretch">
          <div className="h-6 w-6 rounded-full border-2 border-[#b3dbd0] flex items-center justify-center text-[10px] font-bold text-[#2f6b57]">
            {index}
          </div>
          {index < total && <div className="w-px flex-1 mt-1 bg-[#e5e7e5]" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1f2933] truncate">{ingredient.name}</p>
              <p className="text-xs text-[#667085] mt-0.5 truncate">{ingredient.supplier} · {ingredient.origin}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border"
                style={{ backgroundColor: traceConfig.bg, color: traceConfig.text, borderColor: traceConfig.border }}>
                {traceConfig.label}
              </span>
              <ChevronIcon expanded={expanded} />
            </div>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#f0f0f0] px-5 py-4 bg-[#fafafa]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <MicroField label="Origen" value={ingredient.origin} />
            <MicroField label="Proveedor" value={ingredient.supplier} />
          </div>
          {ingredient.traceability !== "completa" && (
            <div className="flex items-start gap-2 bg-[#fef9c3] border border-[#fde68a] rounded-lg px-3.5 py-3 mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#854d0e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-[#854d0e]">
                {ingredient.traceability === "parcial"
                  ? "Información incompleta. Verificá el origen del proveedor para completar la trazabilidad."
                  : "Información pendiente. Agregá el origen y proveedor de este ingrediente."}
              </p>
            </div>
          )}
          <button className="text-xs font-medium text-[#2f6b57] hover:text-[#255747] hover:underline underline-offset-2 transition-colors">
            {ingredient.traceability === "completa" ? "Editar información" : "Completar trazabilidad →"}
          </button>
        </div>
      )}
    </div>
  );
}

function MicroField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-[#1f2933]">{value}</p>
    </div>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-[#1f2933] ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function TraceLegend({ color, bg, label, count }: { color: string; bg: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-[#667085]">{count} {label.toLowerCase()}</span>
    </div>
  );
}

/* ─── Home page ─── */
function HomePage({
  firstName,
  onNavigate,
  onOpenProduct,
}: {
  firstName: string;
  onNavigate: (p: string) => void;
  onOpenProduct: (id: number) => void;
}) {
  const complete = SAMPLE_PRODUCTS.filter((p) => p.status === "completo").length;
  const today = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const catalogTotal = SAMPLE_INGREDIENTS.length + SAMPLE_SUPPLIES.length;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-xs font-medium text-[#667085] capitalize mb-1">{today}</p>
          <h1 className="text-2xl font-semibold text-[#1f2933]">Buen día, {firstName}</h1>
          <p className="text-sm text-[#667085] mt-1">Este es el estado actual de tu operación.</p>
        </div>
        <Button className="self-start sm:self-auto"><PlusIcon /> Registrar producto</Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <HomeMetric label="Productos" value={SAMPLE_PRODUCTS.length} detail="registrados" icon={<BoxIcon />} />
        <HomeMetric label="Trazabilidad" value={`${complete}/${SAMPLE_PRODUCTS.length}`} detail="productos completos" icon={<CheckCircleIcon />} positive />
        <HomeMetric label="Catálogo base" value={catalogTotal} detail="ingredientes e insumos" icon={<LayersIcon />} />
        <HomeMetric label="Por revisar" value={SAMPLE_PRODUCTS.length - complete} detail="producto pendiente" icon={<ClockIcon />} warning />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)] gap-5">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7e5] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#1f2933]">Productos recientes</h2>
                <p className="text-xs text-[#667085] mt-0.5">Continuá trabajando desde donde lo dejaste.</p>
              </div>
              <Button variant="ghost" className="!px-2.5 !py-1.5 shrink-0" onClick={() => onNavigate("productos")}>Ver todos <ArrowRightIcon /></Button>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {SAMPLE_PRODUCTS.slice(0, 4).map((product) => (
                <div key={product.id} className="group px-5 py-4 flex items-center gap-3 hover:bg-[#f7f8f7] transition-colors">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: product.color + "55" }}>{product.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#1f2933] truncate">{product.name}</p>
                      <StatusBadge status={product.status} />
                    </div>
                    <p className="text-xs text-[#667085] mt-0.5">{product.category} · {product.ingredients} ingredientes</p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0 mr-2">
                    <p className="text-xs text-[#667085]">{product.updatedAt}</p>
                    <p className="text-[10px] text-[#9aa4a8] mt-0.5">última edición</p>
                  </div>
                  <Button variant="ghost" className="!p-1.5 shrink-0 text-[#9aa4a8] group-hover:text-[#2f6b57]" aria-label={`Abrir ${product.name}`} onClick={() => onOpenProduct(product.id)}><ChevronRightIcon /></Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e5e7e5] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-sm font-semibold text-[#1f2933]">Catálogos de trabajo</h2>
                <p className="text-xs text-[#667085] mt-0.5">Mantené organizada la base de tus formulaciones.</p>
              </div>
              <span className="text-xs text-[#667085]">{catalogTotal} registros en total</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <QuickAction icon={<BoxIcon />} label="Productos" count={SAMPLE_PRODUCTS.length} helper="Formulaciones" onClick={() => onNavigate("productos")} />
              <QuickAction icon={<LeafIcon />} label="Ingredientes" count={SAMPLE_INGREDIENTS.length} helper="Componentes genéricos" onClick={() => onNavigate("ingredientes")} />
              <QuickAction icon={<PackageIcon />} label="Insumos" count={SAMPLE_SUPPLIES.length} helper="Opciones comerciales" onClick={() => onNavigate("insumos")} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#2f6b57] rounded-xl p-5 text-white overflow-hidden relative">
            <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold">Estado de trazabilidad</p>
                <span className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><RouteIcon /></span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-semibold">{Math.round((complete / SAMPLE_PRODUCTS.length) * 100)}%</span>
                <span className="text-xs text-[#c8e0d8] mb-1">completado</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden mb-4">
                <div className="h-full rounded-full bg-white" style={{ width: `${(complete / SAMPLE_PRODUCTS.length) * 100}%` }} />
              </div>
              <p className="text-xs text-[#c8e0d8] leading-relaxed">Tenés {complete} productos completos y {SAMPLE_PRODUCTS.length - complete} que requiere información adicional.</p>
              <Button variant="secondary" className="w-full mt-5 !py-2 bg-white border-white" onClick={() => onOpenProduct(3)}>Revisar pendiente <ArrowRightIcon /></Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e5e7e5] p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[#1f2933]">Actividad reciente</h2>
                <p className="text-xs text-[#667085] mt-0.5">Últimos cambios en tu cuenta.</p>
              </div>
              <HistoryIcon />
            </div>
            <div className="space-y-4">
              <ActivityItem icon={<PackageIcon />} title="Insumo actualizado" detail="Leche sin lactosa" time="Hace 2 días" />
              <ActivityItem icon={<BoxIcon />} title="Producto completado" detail="Aceite de oliva extra virgen" time="Hace 3 días" positive />
              <ActivityItem icon={<LeafIcon />} title="Ingrediente agregado" detail="Harina de trigo" time="Hace 4 días" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeMetric({
  label,
  value,
  detail,
  icon,
  positive,
  warning,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ReactNode;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e7e5] p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-medium text-[#667085]">{label}</p>
        <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${positive ? "bg-[#ecfdf3] text-[#027a48]" : warning ? "bg-[#fef3f2] text-[#b42318]" : "bg-[#f0f7f4] text-[#2f6b57]"}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-semibold ${warning ? "text-[#b42318]" : "text-[#1f2933]"}`}>{value}</p>
      <p className="text-[10px] text-[#9aa4a8] mt-1">{detail}</p>
    </div>
  );
}

function QuickAction({ icon, label, count, helper, onClick }: { icon: React.ReactNode; label: string; count: number; helper: string; onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick} className="!p-3.5 !justify-start !items-start text-left group">
      <span className="h-8 w-8 rounded-lg bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#1f2933]">{label}</span>
          <span className="text-sm font-semibold text-[#2f6b57]">{count}</span>
        </span>
        <span className="block text-[10px] font-normal text-[#667085] mt-1">{helper}</span>
      </span>
    </Button>
  );
}

function ActivityItem({ icon, title, detail, time, positive }: { icon: React.ReactNode; title: string; detail: string; time: string; positive?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${positive ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#f0f7f4] text-[#2f6b57]"}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#1f2933]">{title}</p>
        <p className="text-xs text-[#667085] truncate mt-0.5">{detail}</p>
      </div>
      <span className="text-[10px] text-[#9aa4a8] shrink-0">{time}</span>
    </div>
  );
}

/* ─── Products page ─── */
function ProductsPage({ onBack, onOpenProduct }: { onBack: () => void; onOpenProduct: (id: number) => void }) {
  return (
    <div className="max-w-3xl">
      <BackButton onClick={onBack} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1f2933]">Productos</h1>
          <p className="text-sm text-[#667085] mt-0.5">{SAMPLE_PRODUCTS.length} productos registrados</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-[#2f6b57] text-white text-sm font-medium rounded-lg px-3.5 py-2 hover:bg-[#255747] transition-colors">
          <PlusIcon /> Agregar
        </button>
      </div>
      <div className="space-y-3">
        {SAMPLE_PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} onClick={() => onOpenProduct(p.id)} />
        ))}
      </div>
    </div>
  );
}

/* ─── Ingredients page ─── */
function IngredientsPage({ onOpenSupplies, onOpenIngredient }: { onOpenSupplies: () => void; onOpenIngredient: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const filteredIngredients = SAMPLE_INGREDIENTS.filter((ingredient) =>
    `${ingredient.name} ${ingredient.category}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-[#2f6b57] uppercase tracking-wider mb-1">Catálogo de formulación</p>
          <h1 className="text-2xl font-semibold text-[#1f2933]">Ingredientes</h1>
          <p className="text-sm text-[#667085] mt-1">Definí qué componentes genéricos llevan tus productos.</p>
        </div>
        <Button className="shrink-0"><PlusIcon /> Nuevo ingrediente</Button>
      </div>

      <div className="bg-[#f0f7f4] border border-[#b3dbd0] rounded-xl p-4 mb-5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-white text-[#2f6b57] flex items-center justify-center shrink-0 border border-[#d9ede6]"><RecipeIcon /></div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1f2933]">El ingrediente define qué lleva la receta</p>
          <p className="text-xs text-[#667085] mt-1 leading-relaxed">No incluye marca, formato ni proveedor. Sus alérgenos son una referencia para formular; los declarados en cada insumo son los que se usan en trazabilidad.</p>
        </div>
        <Button variant="ghost" className="hidden sm:inline-flex shrink-0 !px-3 !py-2" onClick={onOpenSupplies}>Ver insumos <ArrowRightIcon /></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <CatalogStat label="Ingredientes registrados" value={SAMPLE_INGREDIENTS.length} />
        <CatalogStat label="Usados en productos" value={SAMPLE_INGREDIENTS.filter((ingredient) => ingredient.productsUsed > 0).length} />
        <CatalogStat label="Insumos asociados" value={SAMPLE_INGREDIENTS.reduce((total, ingredient) => total + ingredient.supplies, 0)} />
      </div>

      <div className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
        <div className="p-4 border-b border-[#e5e7e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:max-w-sm">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o categoría" aria-label="Buscar ingredientes" leftIcon={<SearchIcon />} />
          </div>
          <p className="text-xs text-[#667085]">{filteredIngredients.length} de {SAMPLE_INGREDIENTS.length} ingredientes</p>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {filteredIngredients.map((ingredient) => (
            <div key={ingredient.id} className="group px-4 sm:px-5 py-4 hover:bg-[#f7f8f7] transition-colors">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#f0f7f4] flex items-center justify-center shrink-0 text-[#2f6b57]"><LeafIcon /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1f2933]">{ingredient.name}</p>
                      <p className="text-xs text-[#667085] mt-0.5">{ingredient.category}</p>
                    </div>
                    <Button variant="ghost" aria-label={`Abrir ${ingredient.name}`} className="!p-1 text-[#9aa4a8] group-hover:text-[#2f6b57]" onClick={() => onOpenIngredient(ingredient.id)}><ChevronRightIcon /></Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#667085]"><BoxIcon /> {ingredient.productsUsed} {ingredient.productsUsed === 1 ? "producto" : "productos"}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2f6b57]"><PackageIcon /> {ingredient.supplies} {ingredient.supplies === 1 ? "insumo asociado" : "insumos asociados"}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[#9aa4a8] uppercase tracking-wide">Alérgenos de referencia</span>
                      {ingredient.allergens.length > 0 ? ingredient.allergens.map((allergen) => <AllergenBadge key={allergen} label={allergen} reference />) : <span className="text-xs text-[#667085]">Ninguno</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredIngredients.length === 0 && <EmptySearch label="No encontramos ingredientes con esa búsqueda." />}
        </div>
      </div>
    </div>
  );
}

/* ─── Supplies page ─── */
function SuppliesPage({ onOpenIngredients, onOpenSupply, onNewSupply }: { onOpenIngredients: () => void; onOpenSupply: (id: number) => void; onNewSupply: () => void }) {
  const [query, setQuery] = useState("");
  const filteredSupplies = SAMPLE_SUPPLIES.filter((supply) =>
    `${supply.name} ${supply.brand} ${supply.ingredient} ${supply.barcode}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-[#2f6b57] uppercase tracking-wider mb-1">Catálogo de compras</p>
          <h1 className="text-2xl font-semibold text-[#1f2933]">Insumos</h1>
          <p className="text-sm text-[#667085] mt-1">Registrá los productos comerciales que usás en tus elaboraciones.</p>
        </div>
        <Button className="shrink-0" onClick={onNewSupply}><PlusIcon /> Nuevo insumo</Button>
      </div>

      <div className="bg-white border border-[#e5e7e5] rounded-xl p-4 mb-5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0"><PackageIcon /></div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1f2933]">El insumo es el producto concreto que comprás</p>
          <p className="text-xs text-[#667085] mt-1 leading-relaxed">Incluye marca, presentación y los alérgenos declarados en el envase. Se vincula a un solo ingrediente y sus datos quedan inmutables al cerrar una elaboración.</p>
        </div>
        <Button variant="ghost" className="hidden sm:inline-flex shrink-0 !px-3 !py-2" onClick={onOpenIngredients}>Ver ingredientes <ArrowRightIcon /></Button>
      </div>

      <div className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
        <div className="p-4 border-b border-[#e5e7e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:max-w-sm">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar insumo, marca o ingrediente" aria-label="Buscar insumos" leftIcon={<SearchIcon />} />
          </div>
          <p className="text-xs text-[#667085]">{filteredSupplies.length} insumos registrados</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 sm:p-4 bg-[#f7f8f7]">
          {filteredSupplies.map((supply) => (
            <div key={supply.id} className="group bg-white border border-[#e5e7e5] rounded-xl p-4 hover:border-[#b3dbd0] hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0"><PackageIcon /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1f2933] truncate">{supply.name}</p>
                      <p className="text-xs text-[#667085] mt-0.5">{supply.brand} · {supply.presentation}</p>
                    </div>
                    <Button variant="ghost" aria-label={`Abrir ${supply.name}`} className="!p-1 text-[#9aa4a8] group-hover:text-[#2f6b57] shrink-0" onClick={() => onOpenSupply(supply.id)}><ChevronRightIcon /></Button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                    <p className="text-[10px] text-[#9aa4a8] uppercase tracking-wide mb-1">Cubre el ingrediente</p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2f6b57] bg-[#f0f7f4] rounded-md px-2 py-1"><LeafIcon small /> {supply.ingredient}</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] text-[#9aa4a8] uppercase tracking-wide mb-1.5">Alérgenos declarados en envase</p>
                    <div className="flex flex-wrap gap-1.5">
                      {supply.allergens.length > 0 ? supply.allergens.map((allergen) => <AllergenBadge key={allergen} label={allergen} />) : <span className="text-xs text-[#667085]">No declara alérgenos</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-4 text-[10px] text-[#9aa4a8]">
                    <span className="font-mono">{supply.barcode}</span>
                    <span>{supply.updatedAt}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredSupplies.length === 0 && <div className="lg:col-span-2"><EmptySearch label="No encontramos insumos con esa búsqueda." /></div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Ingredient detail page ─── */
function IngredientDetailPage({
  ingredient,
  onBack,
  onOpenSupply,
}: {
  ingredient: typeof SAMPLE_INGREDIENTS[0];
  onBack: () => void;
  onOpenSupply: (id: number) => void;
}) {
  const associatedSupplies = SAMPLE_SUPPLIES.filter((supply) => supply.ingredient === ingredient.name);
  const formulations = INGREDIENT_FORMULATIONS[ingredient.id] ?? [];

  return (
    <div className="max-w-5xl">
      <BackButton onClick={onBack} label="Volver a Ingredientes" />

      <div className="bg-white rounded-2xl border border-[#e5e7e5] p-5 sm:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0"><LeafDetailIcon /></div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold text-[#2f6b57] uppercase tracking-wider">Ingrediente</span>
                  <span className="h-1 w-1 rounded-full bg-[#b3dbd0]" />
                  <span className="text-xs text-[#667085]">{ingredient.category}</span>
                </div>
                <h1 className="text-2xl font-semibold text-[#1f2933]">{ingredient.name}</h1>
                <p className="text-sm text-[#667085] mt-2 max-w-xl leading-relaxed">Componente genérico utilizado en las formulaciones. No representa una marca ni una presentación comercial específica.</p>
              </div>
              <Button variant="secondary" className="shrink-0"><EditIcon /> Editar ingrediente</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7e5] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1f2933]">Uso en formulaciones</h2>
                <p className="text-xs text-[#667085] mt-0.5">Productos cuya receta incluye este ingrediente.</p>
              </div>
              <span className="text-xs font-medium text-[#667085] bg-[#f7f8f7] border border-[#e5e7e5] rounded-full px-2.5 py-1">{formulations.length} {formulations.length === 1 ? "producto" : "productos"}</span>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {formulations.map((formulation) => (
                <div key={formulation.product} className="px-5 py-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#f7f8f7] text-[#667085] flex items-center justify-center shrink-0"><RecipeIcon /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1f2933]">{formulation.product}</p>
                    <p className="text-xs text-[#667085] mt-0.5">{formulation.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#1f2933]">{formulation.quantity}</p>
                    <p className="text-[10px] text-[#9aa4a8]">de la formulación</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7e5] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1f2933]">Insumos asociados</h2>
                <p className="text-xs text-[#667085] mt-0.5">Opciones comerciales disponibles para cubrir este ingrediente.</p>
              </div>
              <Button className="!px-3 !py-2"><PlusIcon /> Asociar insumo</Button>
            </div>
            {associatedSupplies.length > 0 ? (
              <div className="divide-y divide-[#f0f0f0]">
                {associatedSupplies.map((supply) => (
                  <div key={supply.id} className="group px-5 py-4 flex items-start gap-3 hover:bg-[#f7f8f7] transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0"><PackageIcon /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1f2933]">{supply.name}</p>
                      <p className="text-xs text-[#667085] mt-0.5">{supply.brand} · {supply.presentation}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {supply.allergens.length > 0 ? supply.allergens.map((allergen) => <AllergenBadge key={allergen} label={allergen} />) : <span className="text-xs text-[#667085]">No declara alérgenos</span>}
                      </div>
                    </div>
                    <Button variant="ghost" className="!p-1 shrink-0 text-[#9aa4a8] group-hover:text-[#2f6b57]" aria-label={`Ver ${supply.name}`} onClick={() => onOpenSupply(supply.id)}><ChevronRightIcon /></Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <div className="h-10 w-10 rounded-full bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center mx-auto mb-3"><PackageIcon /></div>
                <p className="text-sm font-medium text-[#1f2933]">Todavía no hay insumos asociados</p>
                <p className="text-xs text-[#667085] mt-1">Asociá una opción comercial antes de registrar una elaboración.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e5e7e5] p-4">
            <h2 className="text-sm font-semibold text-[#1f2933] mb-4">Información general</h2>
            <div className="space-y-4">
              <DetailField label="Categoría" value={ingredient.category} />
              <DetailField label="Productos que lo usan" value={`${formulations.length}`} />
              <DetailField label="Insumos asociados" value={`${associatedSupplies.length}`} />
              <DetailField label="Última actualización" value="14 de marzo, 2025" />
            </div>
          </div>

          <div className="bg-[#f7f8f7] rounded-xl border border-[#e5e7e5] p-4">
            <p className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider mb-2">Alérgenos de referencia</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ingredient.allergens.length > 0 ? ingredient.allergens.map((allergen) => <AllergenBadge key={allergen} label={allergen} reference />) : <span className="text-sm text-[#667085]">Ninguno registrado</span>}
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">Sirven como guía al formular. Para la trazabilidad se consideran los alérgenos declarados por el insumo elegido.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Supply detail page ─── */
function SupplyDetailPage({
  supply,
  onBack,
  onOpenIngredient,
}: {
  supply: typeof SAMPLE_SUPPLIES[0];
  onBack: () => void;
  onOpenIngredient: (id: number) => void;
}) {
  const ingredient = SAMPLE_INGREDIENTS.find((item) => item.name === supply.ingredient);

  return (
    <div className="max-w-5xl">
      <BackButton onClick={onBack} label="Volver a Insumos" />

      <div className="bg-white rounded-2xl border border-[#e5e7e5] p-5 sm:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center shrink-0"><PackageDetailIcon /></div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold text-[#2f6b57] uppercase tracking-wider">Insumo</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#027a48] bg-[#ecfdf3] rounded-full px-2 py-0.5"><span className="h-1.5 w-1.5 rounded-full bg-[#027a48]" /> Activo</span>
                </div>
                <h1 className="text-2xl font-semibold text-[#1f2933]">{supply.name}</h1>
                <p className="text-sm text-[#667085] mt-2">{supply.brand} · {supply.presentation}</p>
              </div>
              <Button variant="secondary" className="shrink-0"><EditIcon /> Editar insumo</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7e5]">
              <h2 className="text-sm font-semibold text-[#1f2933]">Identificación comercial</h2>
              <p className="text-xs text-[#667085] mt-0.5">Datos que permiten reconocer el producto al comprarlo.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 p-5">
              <DetailField label="Nombre comercial" value={supply.name} />
              <DetailField label="Marca" value={supply.brand} />
              <DetailField label="Presentación" value={supply.presentation} />
              <div>
                <p className="text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wider mb-1">Código de barras</p>
                <div className="inline-flex items-center gap-2 bg-[#f7f8f7] border border-[#e5e7e5] rounded-lg px-3 py-2">
                  <BarcodeIcon />
                  <span className="text-xs font-mono font-medium text-[#1f2933]">{supply.barcode}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#e5e7e5] p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#fef3f2] text-[#b42318] flex items-center justify-center shrink-0"><AlertTriangleIcon /></div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-[#1f2933]">Alérgenos declarados en el envase</h2>
                <p className="text-xs text-[#667085] mt-1 leading-relaxed">Esta es la información que se copiará a la elaboración y contará para su trazabilidad.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {supply.allergens.length > 0 ? supply.allergens.map((allergen) => <AllergenBadge key={allergen} label={allergen} />) : <span className="text-sm text-[#667085]">El fabricante no declara alérgenos.</span>}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#e5e7e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7e5] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1f2933]">Uso reciente en elaboraciones</h2>
                <p className="text-xs text-[#667085] mt-0.5">Lotes donde se seleccionó este insumo.</p>
              </div>
              <span className="text-xs text-[#667085]">3 registros</span>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {[
                { product: "Pan de campo integral", lot: "ELAB-250318-04", date: "18 mar 2025" },
                { product: "Pan de campo integral", lot: "ELAB-250312-02", date: "12 mar 2025" },
                { product: "Galletas de avena", lot: "ELAB-250306-01", date: "6 mar 2025" },
              ].map((use) => (
                <div key={use.lot} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#f7f8f7] text-[#667085] flex items-center justify-center shrink-0"><HistoryIcon /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1f2933]">{use.product}</p>
                    <p className="text-[10px] text-[#9aa4a8] font-mono mt-0.5">{use.lot}</p>
                  </div>
                  <span className="text-xs text-[#667085] shrink-0">{use.date}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {ingredient && (
            <div className="bg-[#f0f7f4] rounded-xl border border-[#b3dbd0] p-4">
              <p className="text-[10px] font-semibold text-[#2f6b57] uppercase tracking-wider mb-3">Ingrediente asociado</p>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-white text-[#2f6b57] flex items-center justify-center shrink-0"><LeafIcon /></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1f2933]">{ingredient.name}</p>
                  <p className="text-xs text-[#667085] mt-0.5">{ingredient.category}</p>
                </div>
              </div>
              <Button variant="ghost" className="w-full mt-4 !py-2" onClick={() => onOpenIngredient(ingredient.id)}>Ver ingrediente <ArrowRightIcon /></Button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#e5e7e5] p-4">
            <h2 className="text-sm font-semibold text-[#1f2933] mb-4">Información del registro</h2>
            <div className="space-y-4">
              <DetailField label="Código interno" value={`INS-${String(supply.id).padStart(4, "0")}`} mono />
              <DetailField label="Creado" value="5 de marzo, 2025" />
              <DetailField label="Última actualización" value={supply.updatedAt.replace("Actualizado ", "")} />
            </div>
          </div>

          <div className="bg-[#f7f8f7] rounded-xl border border-[#e5e7e5] p-4">
            <div className="flex items-center gap-2 text-[#2f6b57] mb-2"><LockIcon /><p className="text-xs font-semibold">Datos históricos protegidos</p></div>
            <p className="text-xs text-[#667085] leading-relaxed">Los cambios que hagas aquí no alteran elaboraciones finalizadas. Cada una conserva una copia inmutable de los datos usados.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#9aa4a8] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-medium text-[#1f2933] ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function CatalogStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-[#e5e7e5] rounded-xl px-4 py-3">
      <p className="text-xl font-semibold text-[#1f2933]">{value}</p>
      <p className="text-xs text-[#667085] mt-0.5">{label}</p>
    </div>
  );
}

function AllergenBadge({ label, reference }: { label: string; reference?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${reference ? "border-[#e5e7e5] bg-[#f7f8f7] text-[#667085]" : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"}`}>
      {label}
    </span>
  );
}

function EmptySearch({ label }: { label: string }) {
  return (
    <div className="py-10 px-4 text-center">
      <div className="h-10 w-10 rounded-full bg-[#f0f7f4] text-[#2f6b57] flex items-center justify-center mx-auto mb-3"><SearchIcon /></div>
      <p className="text-sm font-medium text-[#1f2933]">{label}</p>
      <p className="text-xs text-[#667085] mt-1">Probá con otro nombre o categoría.</p>
    </div>
  );
}

/* ─── Shared UI ─── */
function StatCard({ label, value, icon, accent, dim }: { label: string; value: number; icon: React.ReactNode; accent: string; dim?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e7e5] p-4">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${accent}18`, color: accent }}>{icon}</div>
      <p className="text-2xl font-bold mb-0.5" style={{ color: dim ? accent : "#1f2933" }}>{value}</p>
      <p className="text-xs text-[#667085] leading-snug">{label}</p>
    </div>
  );
}

function ProductCard({ product, onClick }: { product: typeof SAMPLE_PRODUCTS[0]; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="group bg-white rounded-xl border border-[#e5e7e5] p-4 flex items-start gap-4 hover:border-[#b3dbd0] hover:shadow-sm transition-all duration-150 cursor-pointer">
      <div className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: product.color + "55" }}>{product.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1f2933] truncate">{product.name}</p>
            <p className="text-xs text-[#667085] mt-0.5">{product.category}</p>
          </div>
          <StatusBadge status={product.status} />
        </div>
        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex items-center gap-1 text-xs text-[#667085]"><LeafIcon small />{product.ingredients} ingredientes</div>
          <span className="text-[#e5e7e5]">·</span>
          <span className="text-xs text-[#9aa4a8]">{product.updatedAt}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "completo" | "incompleto" }) {
  return (
    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === "completo" ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#fef9c3] text-[#854d0e]"}`}>
      {status === "completo" ? "Completo" : "Pendiente"}
    </span>
  );
}

function BackButton({ onClick, label = "Volver al inicio" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-[#667085] hover:text-[#1f2933] mb-5 transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
      {label}
    </button>
  );
}

function NavItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#f0f7f4] text-[#2f6b57]" : "text-[#667085] hover:bg-[#f7f8f7] hover:text-[#1f2933]"}`}>
      <span className={active ? "text-[#2f6b57]" : "text-[#9aa4a8]"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${active ? "bg-[#2f6b57] text-white" : "bg-[#f0f0f0] text-[#667085]"}`}>{badge}</span>
      )}
    </button>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 text-[#9aa4a8] ${expanded ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ─── Icons ─── */
function HomeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}
function BoxIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
}
function LeafIcon({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 16;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 19.82A2 2 0 004 22h1c8.27 0 15-6.73 15-15v-1l-3 2z" /><line x1="7" y1="17" x2="13" y2="11" /></svg>;
}
function PackageIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4L7.5 4.2" /><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.3 7 12 12 20.7 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>;
}
function CalculatorIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="11" x2="8" y2="11" /><line x1="12" y1="11" x2="12" y2="11" /><line x1="16" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="8" y2="15" /><line x1="12" y1="15" x2="12" y2="15" /><line x1="16" y1="15" x2="16" y2="19" /><line x1="8" y1="19" x2="12" y2="19" /></svg>;
}
function RecipeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>;
}
function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}
function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
}
function ArrowRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}
function LeafDetailIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 19.82A2 2 0 004 22h1c8.27 0 15-6.73 15-15V6l-3 2z" /><line x1="7" y1="17" x2="13" y2="11" /></svg>;
}
function PackageDetailIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22" x2="12" y2="12" /></svg>;
}
function BarcodeIcon() {
  return <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="1" x2="2" y2="17" /><line x1="5" y1="1" x2="5" y2="17" /><line x1="9" y1="1" x2="9" y2="17" /><line x1="11" y1="1" x2="11" y2="17" /><line x1="15" y1="1" x2="15" y2="17" /><line x1="19" y1="1" x2="19" y2="17" /><line x1="22" y1="1" x2="22" y2="17" /></svg>;
}
function AlertTriangleIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 2.9L1.8 17a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 2.9a2 2 0 00-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function HistoryIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.5 15a9 9 0 102.1-9.4L1 10" /><polyline points="12 7 12 12 15 14" /></svg>;
}
function LockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
}
function LayersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></svg>;
}
function RouteIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M6 16V8a3 3 0 013-3h6" /></svg>;
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}
function MenuIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
}
function FlagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f6b57" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
}
function BellIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>;
}
function CheckCircleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function ClockIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function QrIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><line x1="14" y1="14" x2="14" y2="14" /><line x1="17" y1="14" x2="21" y2="14" /><line x1="14" y1="17" x2="14" y2="21" /><line x1="21" y1="17" x2="17" y2="17" /><line x1="17" y1="21" x2="21" y2="21" /></svg>;
}
