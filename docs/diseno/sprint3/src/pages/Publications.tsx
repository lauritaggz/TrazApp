import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";

type Batch = {
  id: string;
  date: string;
  units: number;
  visible: boolean;
};

type PublicationProduct = {
  id: number;
  name: string;
  category: string;
  weight: string;
  published: boolean;
  hasFormula: boolean;
  batches: Batch[];
  publicId: string;
};

const INITIAL_PRODUCTS: PublicationProduct[] = [
  {
    id: 1,
    name: "Mermelada de frutilla",
    category: "Conservas",
    weight: "350 g",
    published: true,
    hasFormula: true,
    publicId: "TRZ-MFRU-7K2P9X",
    batches: [
      { id: "MFRU-2025-042", date: "18 mar 2025", units: 48, visible: true },
      { id: "MFRU-2025-037", date: "6 mar 2025", units: 42, visible: true },
      { id: "MFRU-2025-029", date: "22 feb 2025", units: 45, visible: false },
    ],
  },
  {
    id: 2,
    name: "Queso crema artesanal",
    category: "Lácteos",
    weight: "200 g",
    published: true,
    hasFormula: true,
    publicId: "TRZ-QCRE-4M8R2B",
    batches: [
      { id: "QCRE-2025-018", date: "20 mar 2025", units: 25, visible: true },
      { id: "QCRE-2025-016", date: "13 mar 2025", units: 25, visible: true },
    ],
  },
  {
    id: 3,
    name: "Pan de campo integral",
    category: "Panificados",
    weight: "500 g",
    published: false,
    hasFormula: false,
    publicId: "TRZ-PCI-9D3N6A",
    batches: [
      { id: "PCI-2025-031", date: "21 mar 2025", units: 12, visible: true },
    ],
  },
  {
    id: 4,
    name: "Aceite de oliva extra virgen",
    category: "Aceites",
    weight: "500 ml",
    published: false,
    hasFormula: true,
    publicId: "TRZ-AOV-5T1C7L",
    batches: [
      { id: "AOV-2025-009", date: "4 mar 2025", units: 40, visible: true },
      { id: "AOV-2025-006", date: "18 feb 2025", units: 38, visible: true },
    ],
  },
];

export default function Publications({ onPreview }: { onPreview: (productId: number) => void }) {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const selected = products.find((product) => product.id === selectedId);
  const publishedCount = products.filter((product) => product.published).length;
  const eligibleCount = products.filter((product) => product.hasFormula && product.batches.length > 0).length;

  function updateProduct(id: number, update: (product: PublicationProduct) => PublicationProduct) {
    setProducts((current) => current.map((product) => product.id === id ? update(product) : product));
  }

  function setPublished(product: PublicationProduct, published: boolean) {
    if (published && (!product.hasFormula || product.batches.length === 0)) return;
    updateProduct(product.id, (current) => ({ ...current, published }));
    setNotice(published ? "El producto ya está disponible para consumidores." : "La publicación fue deshabilitada. El QR permanente se conserva.");
  }

  function toggleBatch(productId: number, batchId: string) {
    updateProduct(productId, (product) => ({
      ...product,
      batches: product.batches.map((batch) => batch.id === batchId ? { ...batch, visible: !batch.visible } : batch),
    }));
    setNotice("La visibilidad de la elaboración fue actualizada.");
  }

  if (selected) {
    return (
      <PublicationDetail
        product={selected}
        notice={notice}
        onBack={() => { setSelectedId(null); setNotice(""); }}
        onPublish={(published) => setPublished(selected, published)}
        onToggleBatch={(batchId) => toggleBatch(selected.id, batchId)}
        onPreview={() => onPreview(selected.id)}
      />
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">Herramientas</p>
          <p className="text-2xl font-semibold text-text-primary">Publicaciones</p>
          <p className="text-sm text-text-secondary mt-1">Administra qué productos y elaboraciones pueden consultar tus consumidores.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-text-secondary">
          <ShieldIcon />
          La estructura pública está protegida por TrazApp
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Metric label="Productos publicados" value={`${publishedCount} de ${products.length}`} icon={<GlobeIcon />} />
        <Metric label="Listos para publicar" value={`${eligibleCount}`} icon={<CheckIcon />} />
        <Metric label="Elaboraciones visibles" value={`${products.flatMap((product) => product.batches).filter((batch) => batch.visible).length}`} icon={<EyeIcon />} />
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 mb-5 flex items-start gap-3">
        <span className="h-9 w-9 rounded-lg bg-card text-brand-600 flex items-center justify-center shrink-0 border border-brand-100"><QrIcon /></span>
        <div>
          <p className="text-sm font-semibold text-text-primary">Un QR único para toda la vida del producto</p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">Puedes imprimirlo una sola vez. Aunque deshabilites una publicación, el código no cambia y mostrará un mensaje seguro sin revelar información.</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Tus productos</p>
            <p className="text-xs text-text-secondary mt-0.5">Revisa el estado y configura la información pública.</p>
          </div>
          <span className="text-xs text-text-secondary">{products.length} productos</span>
        </div>
        <div className="divide-y divide-border">
          {products.map((product) => {
            const eligible = product.hasFormula && product.batches.length > 0;
            return (
              <div key={product.id} className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-surface transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><PackageIcon /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">{product.name}</p>
                      <PublicationBadge published={product.published} />
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{product.category} · {product.weight} · {product.batches.length} elaboraciones finalizadas</p>
                  </div>
                </div>
                <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-6">
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    <Requirement met={product.hasFormula} label="Formulación" />
                    <Requirement met={product.batches.length > 0} label="Elaboración" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={product.published} disabled={!eligible} label={product.published ? "Deshabilitar publicación" : "Habilitar publicación"} onChange={(checked) => setPublished(product, checked)} />
                    <Button variant="secondary" className="!py-2 !px-3" onClick={() => setSelectedId(product.id)}>
                      Gestionar <ChevronRightIcon />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PublicationDetail({
  product,
  notice,
  onBack,
  onPublish,
  onToggleBatch,
  onPreview,
}: {
  product: PublicationProduct;
  notice: string;
  onBack: () => void;
  onPublish: (published: boolean) => void;
  onToggleBatch: (batchId: string) => void;
  onPreview: () => void;
}) {
  const eligible = product.hasFormula && product.batches.length > 0;
  const publicUrl = `traz.app/p/${product.publicId.toLowerCase()}`;

  return (
    <div className="max-w-6xl">
      <Button variant="ghost" className="!-ml-3 !px-3 mb-4" onClick={onBack}><ArrowLeftIcon /> Volver a Publicaciones</Button>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Publicación del producto</p>
            <PublicationBadge published={product.published} />
          </div>
          <p className="text-2xl font-semibold text-text-primary">{product.name}</p>
          <p className="text-sm text-text-secondary mt-1">{product.category} · {product.weight}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onPreview}><EyeIcon /> Vista previa pública</Button>
          <Switch checked={product.published} disabled={!eligible} large label={product.published ? "Deshabilitar" : "Habilitar"} onChange={onPublish} />
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 flex items-center gap-2 text-sm font-medium text-brand-700">
          <CheckIcon /> {notice}
        </div>
      )}

      {!eligible && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <span className="text-amber-700 mt-0.5"><AlertIcon /></span>
          <div>
            <p className="text-sm font-semibold text-amber-900">Este producto todavía no se puede publicar</p>
            <p className="text-xs text-amber-800 mt-1">Completa los requisitos pendientes. Necesitas una formulación y al menos una elaboración finalizada.</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <Requirement met={product.hasFormula} label="Formulación registrada" />
              <Requirement met={product.batches.length > 0} label="Elaboración finalizada" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-5 items-start">
        <div className="space-y-5">
          <section className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">Estado de publicación</p>
                <p className="text-xs text-text-secondary mt-0.5">Controla el acceso a la ficha pública del producto.</p>
              </div>
              <PublicationBadge published={product.published} />
            </div>
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${product.published ? "bg-success-bg text-success" : "bg-surface text-text-secondary"}`}>
                  {product.published ? <GlobeIcon /> : <EyeOffIcon />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{product.published ? "Visible para consumidores" : "Información no disponible"}</p>
                  <p className="text-xs text-text-secondary mt-1 max-w-lg leading-relaxed">
                    {product.published ? "Quienes escaneen el QR podrán consultar las elaboraciones visibles." : "El QR sigue funcionando, pero no expone datos del producto mientras la publicación está deshabilitada."}
                  </p>
                </div>
              </div>
              <Switch checked={product.published} disabled={!eligible} label={product.published ? "Deshabilitar" : "Habilitar"} onChange={onPublish} />
            </div>
          </section>

          <section className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-text-primary">Elaboraciones finalizadas</p>
              <p className="text-xs text-text-secondary mt-0.5">Ocultar una elaboración no modifica ni elimina la información conservada.</p>
            </div>
            <div className="divide-y divide-border">
              {product.batches.map((batch) => (
                <div key={batch.id} className="p-4 sm:px-5 flex items-center gap-3">
                  <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${batch.visible ? "bg-brand-50 text-brand-600" : "bg-surface text-text-secondary"}`}>
                    {batch.visible ? <EyeIcon /> : <EyeOffIcon />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-semibold text-text-primary">{batch.id}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${batch.visible ? "bg-success-bg text-success" : "bg-surface text-text-secondary"}`}>{batch.visible ? "Visible" : "Oculta"}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{batch.date} · {batch.units} unidades</p>
                  </div>
                  <Switch checked={batch.visible} label={batch.visible ? `Ocultar ${batch.id}` : `Mostrar ${batch.id}`} onChange={() => onToggleBatch(batch.id)} />
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3">
            <span className="text-text-secondary mt-0.5"><LockIcon /></span>
            <div>
              <p className="text-xs font-semibold text-text-primary">La ficha pública no se puede personalizar</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">TrazApp define qué información se muestra y cómo se presenta para asegurar una consulta clara y consistente.</p>
            </div>
          </div>
        </div>

        <aside className="xl:sticky xl:top-5">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <p className="text-sm font-semibold text-text-primary">Código QR permanente</p>
              <p className="text-xs text-text-secondary mt-1">Listo para etiquetas y material impreso.</p>
            </div>
            <div className="p-5">
              <div className="rounded-xl bg-white border border-border p-4 shadow-sm">
                <QrCode value={product.publicId} />
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Enlace público</p>
                <p className="text-xs font-mono text-text-primary mt-1 break-all">{publicUrl}</p>
                <p className="text-[10px] text-text-secondary mt-1">ID {product.publicId}</p>
              </div>
              <Button className="w-full mt-4" onClick={() => downloadQr(product)}><DownloadIcon /> Descargar SVG para impresión</Button>
              <Button variant="secondary" className="w-full mt-2" onClick={onPreview}><EyeIcon /> Comprobar ficha pública</Button>
              <div className="mt-4 pt-4 border-t border-border flex items-start gap-2">
                <span className="text-brand-600 mt-0.5"><InfoIcon /></span>
                <p className="text-[10px] text-text-secondary leading-relaxed">El QR no cambia al ocultar elaboraciones o deshabilitar la publicación. Resolución vectorial, apta para cualquier tamaño.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">{icon}</span>
      <div><p className="text-xl font-semibold text-text-primary">{value}</p><p className="text-xs text-text-secondary mt-0.5">{label}</p></div>
    </div>
  );
}

function PublicationBadge({ published }: { published: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${published ? "bg-success-bg text-success" : "bg-surface text-text-secondary border border-border"}`}><span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-success" : "bg-text-secondary"}`} />{published ? "Publicado" : "No publicado"}</span>;
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs ${met ? "text-success" : "text-amber-700"}`}>{met ? <CheckIcon /> : <AlertIcon />}{label}</span>;
}

function Switch({ checked, disabled, label, large, onChange }: { checked: boolean; disabled?: boolean; label: string; large?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Button
      variant="ghost"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={disabled ? "Completa los requisitos para habilitar la publicación" : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`!p-0 rounded-full ${large ? "!w-12 !h-7" : "!w-10 !h-6"} ${checked ? "bg-brand-600 hover:bg-brand-700" : "bg-border hover:bg-border"}`}
    >
      <span className={`rounded-full bg-white shadow-sm transition-transform ${large ? "h-5 w-5" : "h-4 w-4"} ${checked ? (large ? "translate-x-2.5" : "translate-x-2") : (large ? "-translate-x-2.5" : "-translate-x-2")}`} />
    </Button>
  );
}

function QrCode({ value }: { value: string }) {
  const cells = useMemo(() => qrCells(value), [value]);
  return (
    <svg viewBox="0 0 29 29" role="img" aria-label={`Código QR ${value}`} className="w-full aspect-square text-text-primary">
      <rect width="29" height="29" fill="white" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />)}
    </svg>
  );
}

function qrCells(value: string) {
  const size = 29;
  const cells = new Set<string>();
  const finder = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y += 1) for (let x = 0; x < 7; x += 1) {
      if (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) cells.add(`${startX + x},${startY + y}`);
    }
  };
  finder(1, 1); finder(21, 1); finder(1, 21);
  let seed = [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  const reserved = (x: number, y: number) => (x <= 8 && y <= 8) || (x >= 20 && y <= 8) || (x <= 8 && y >= 20);
  for (let y = 1; y < size - 1; y += 1) for (let x = 1; x < size - 1; x += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    if (!reserved(x, y) && ((seed >>> 29) + x + y) % 3 !== 0) cells.add(`${x},${y}`);
  }
  return [...cells].map((cell) => cell.split(",").map(Number) as [number, number]);
}

function downloadQr(product: PublicationProduct) {
  const cells = qrCells(product.publicId);
  const modules = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 35" width="1740" height="2100"><rect width="29" height="35" fill="white"/><g fill="#1f2933">${modules}</g><text x="14.5" y="32" text-anchor="middle" font-family="Arial,sans-serif" font-size="1.3" fill="#1f2933">${product.publicId}</text></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `qr-${product.name.toLowerCase().replace(/\s+/g, "-")}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

function QrIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" /></svg>; }
function PackageIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.3 7 12 12 20.7 7" /></svg>; }
function CheckIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>; }
function AlertIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>; }
function EyeIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>; }
function EyeOffIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.9 17.9A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.9M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2" /><line x1="1" y1="1" x2="23" y2="23" /></svg>; }
function GlobeIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /></svg>; }
function ShieldIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }
function LockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>; }
function InfoIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>; }
function DownloadIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function ArrowLeftIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>; }
function ChevronRightIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>; }
