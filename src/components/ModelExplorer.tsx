import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { MODELS, type ModelId, type ModelInfo } from "../three/models";
import {
  filterModelCatalog,
  formatModelReferenceBrief,
  MODEL_CATALOG_FILTERS,
  type ModelCatalogFilter,
} from "../lib/modelCatalog";

type Props = {
  activeModel: ModelId;
  onInspect: (id: ModelId) => void;
  onCompare: (id: ModelId) => void;
  onClose: () => void;
};

function CrossSection({ model }: { model: ModelInfo }) {
  // This is a within-model visual silhouette. It is NOT a scale comparison
  // between different ULDs; dimensions are presented separately below.
  const points = model.sectionProfile();
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);
  const width = Math.max(0.01, right - left);
  const height = Math.max(0.01, top - bottom);
  const scale = Math.min(252 / width, 126 / height);
  const offsetX = 150 - (left + right) * scale / 2;
  const offsetY = 145 + bottom * scale;
  const path = points.map((p, index) =>
    (index === 0 ? "M" : "L") +
    (p.x * scale + offsetX).toFixed(1) + "," +
    (offsetY - p.y * scale).toFixed(1)).join(" ") + " Z";
  return (
    <div className="relative overflow-hidden border border-[#356074] bg-[#071a27] p-2">
      <div className="absolute left-3 top-2 font-mono text-[9px] uppercase tracking-[.16em] text-[#8ac6da]">
        Reference cross-section
      </div>
      <svg
        role="img"
        aria-label={model.code + " reference section silhouette; fitted separately for display, not cross-model scale"}
        viewBox="0 0 300 170"
        className="mx-auto h-[150px] w-full max-w-[410px]"
      >
        <defs>
          <linearGradient id="uld-section-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#65c9eb" stopOpacity=".30" />
            <stop offset="100%" stopColor="#1c728f" stopOpacity=".10" />
          </linearGradient>
        </defs>
        <path d="M18 145H282" stroke="#7b9ead" strokeWidth="1" strokeDasharray="3 5" />
        <path d="M150 27V153" stroke="#557b90" strokeWidth="1" strokeDasharray="2 7" opacity=".55" />
        <path d={path} fill="url(#uld-section-fill)" stroke="#8be0f5" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="text-center font-mono text-[9px] text-[#9ab9c8]">
        Normalized silhouette · see dimensions for true scale
      </div>
    </div>
  );
}

function Metric({ name, value }: { name: string; value: string }) {
  return (
    <div className="min-w-0 border border-[#2d4a5a] bg-[#102330]/80 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[.10em] text-[#96bdce]">{name}</div>
      <div className="mt-1 font-display text-[18px] font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

export function ModelExplorer({ activeModel, onInspect, onCompare, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ModelCatalogFilter>("all");
  const [previewId, setPreviewId] = useState<ModelId>(activeModel);
  const [copyStatus, setCopyStatus] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusBefore = useRef<HTMLElement | null>(null);
  const matches = useMemo(() => filterModelCatalog(query, category), [query, category]);
  const selectedId = matches.includes(previewId) ? previewId : matches[0];
  const selected = selectedId ? MODELS[selectedId] : null;
  const active = MODELS[activeModel];

  // Keep the last searched model selected after clearing a query or filter,
  // instead of snapping back to the initial ULD unexpectedly.
  useEffect(() => {
    if (matches.length > 0 && !matches.includes(previewId)) {
      setPreviewId(matches[0]);
    }
  }, [matches, previewId]);

  useEffect(() => {
    focusBefore.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    inputRef.current?.focus();
    return () => focusBefore.current?.focus();
  }, []);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
    ) ?? []);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  async function copyReference() {
    if (!selected) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(formatModelReferenceBrief(selected));
      setCopyStatus("Reference brief copied");
    } catch {
      setCopyStatus("Clipboard unavailable in this browser");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center p-0 sm:items-center sm:p-5">
      <div className="absolute inset-0 bg-[#02070c]/90 backdrop-blur-[4px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="uld-explorer-title"
        onKeyDown={onDialogKeyDown}
        className="relative flex h-full max-h-full w-full max-w-[1160px] flex-col overflow-hidden border border-[#4b7e95] bg-[#07141e] shadow-[0_30px_100px_rgba(0,0,0,.75)] sm:h-[min(840px,95dvh)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#35596d] bg-[#0c2331] px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[.23em] text-[#9bcfe1]">
              YASLOGIST / ULD360 / REFERENCE CATALOGUE
            </div>
            <h2 id="uld-explorer-title" className="mt-1 font-display text-[22px] font-bold tracking-wide text-white sm:text-[30px]">
              Model Explorer
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-[#a6c4d0]">
              Find a ULD · examine its technical references · open it in 3D
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Model Explorer"
            className="min-h-11 min-w-11 shrink-0 border border-[#577f91] bg-[#153747] text-[24px] leading-none text-white hover:bg-[#27536a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9ce4f4]">
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden">
          <section aria-label="ULD model catalogue" className="flex min-h-0 flex-col border-b border-[#2d5061] bg-[#0a1b27] lg:border-b-0 lg:border-r">
            <div className="shrink-0 space-y-3 p-3 sm:p-4">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[#9bd3e7]">Search models</span>
                <input ref={inputRef} type="search" value={query} onChange={e => { setQuery(e.target.value); setCopyStatus(""); }}
                  aria-label="Search ULD models by code, family, or aircraft"
                  placeholder="AKE, LD-3, A320, Boeing..."
                  className="h-11 w-full min-w-0 border border-[#517c90] bg-[#06131d] px-3 text-[13px] text-white outline-none placeholder:text-[#6d8b9a] focus:border-[#a6e8f8]" />
              </label>
              <div role="group" aria-label="Filter ULD catalogue by nominal category"
                className="flex gap-1 overflow-x-auto pb-1 lg:flex-wrap">
                {MODEL_CATALOG_FILTERS.map(item => (
                  <button type="button" key={item.id} aria-pressed={category === item.id}
                    onClick={() => { setCategory(item.id); setCopyStatus(""); }}
                    className={category === item.id
                      ? "min-h-9 shrink-0 border border-[#99dcee] bg-[#245568] px-2.5 font-mono text-[10px] text-white"
                      : "min-h-9 shrink-0 border border-[#365668] px-2.5 font-mono text-[10px] text-[#a6c3d0] hover:bg-[#1b3644]"}>
                    {item.label}
                  </button>
                ))}
              </div>
              <div role="status" className="font-mono text-[10px] text-[#a9c8d3]">
                {matches.length} of {Object.keys(MODELS).length} registry models
              </div>
            </div>
            <div className="max-h-[186px] min-h-0 space-y-1 overflow-y-auto px-3 pb-3 lg:max-h-none lg:flex-1 lg:px-4 lg:pb-4">
              {matches.map(id => {
                const model = MODELS[id];
                const selectedHere = id === selectedId;
                return (
                  <button key={id} type="button" aria-pressed={selectedHere}
                    aria-label={"Preview " + model.name + " specifications"}
                    onClick={() => { setPreviewId(id); setCopyStatus(""); }}
                    className={selectedHere
                      ? "flex min-h-[64px] w-full items-center justify-between gap-2 border border-[#91d5ec] bg-[#193c4c] px-3 py-2 text-left"
                      : "flex min-h-[64px] w-full items-center justify-between gap-2 border border-[#2f4b59] bg-[#101f29] px-3 py-2 text-left hover:border-[#6aa7be] hover:bg-[#19313e]"}>
                    <div className="min-w-0">
                      <div className="font-display text-[17px] font-bold text-white">
                        {model.code}
                        {id === activeModel && <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-[#e9c78b]">On canvas</span>}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[#a8c9d7]">{model.name.split("·")[1]?.trim() || model.family}</div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[10px] text-[#bce3f1]">
                      <div>{model.ratings.volumeM3.toFixed(1)} m³</div>
                      <div className="mt-1 text-[#8fb5c5]">{model.ratings.payloadKg.toLocaleString("en-US")} kg</div>
                    </div>
                  </button>
                );
              })}
              {matches.length === 0 && (
                <div className="border border-[#3d5f6f] bg-[#102938] p-3">
                  <p className="text-[12px] text-[#bed8e2]">No ULD matches that search and filter.</p>
                  <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}
                    className="mt-2 min-h-10 border border-[#6c9bae] px-3 font-mono text-[10px] uppercase text-white">
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </section>

          <section aria-label="Selected ULD technical references" className="min-h-0 min-w-0 overflow-y-auto p-3 sm:p-5 lg:p-6">
            {selected ? (
              <div className="mx-auto max-w-[750px] space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-[.20em] text-[#9bd5e8]">
                      Nominal engineering reference
                    </div>
                    <h3 className="mt-1 font-display text-[32px] font-bold leading-none text-white sm:text-[42px]">{selected.name}</h3>
                    <p className="mt-2 text-[12px] text-[#b1d0db]">{selected.family}</p>
                  </div>
                  <span className="border border-[#47778a] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#bce2ec]">
                    {selected.palletOption ? "Pallet" : selected.reeferOption ? "Reefer" : "Container"}
                  </span>
                </div>

                <CrossSection model={selected} />

                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[.15em] text-[#a8dbea]">Reference ratings</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric name="Volume" value={selected.ratings.volumeM3.toFixed(2) + " m³"} />
                    <Metric name="Net payload" value={selected.ratings.payloadKg.toLocaleString("en-US") + " kg"} />
                    <Metric name="Max gross" value={selected.ratings.maxGrossKg.toLocaleString("en-US") + " kg"} />
                    <Metric name="Tare" value={selected.ratings.tareKg.toLocaleString("en-US") + " kg"} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[.15em] text-[#a8dbea]">Nominal envelope</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric name="Base width" value={selected.dims.width.toFixed(3) + " m"} />
                    <Metric name="Depth" value={selected.dims.depth.toFixed(3) + " m"} />
                    <Metric name={selected.palletOption ? "Pallet thickness" : "Height"}
                      value={selected.dims.height.toFixed(3) + " m"} />
                    <Metric name="Top width" value={selected.dims.topWidth.toFixed(3) + " m"} />
                  </div>
                  {selected.dims.contourHeight !== undefined && (
                    <p className="mt-1.5 font-mono text-[10px] text-[#a9c9d4]">
                      Illustrative cargo contour height: {selected.dims.contourHeight.toFixed(3)} m
                    </p>
                  )}
                </div>

                <div className="border border-[#31566a] bg-[#0e2634] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#a8dbea]">Engineering details</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#c2dce6]">{selected.featureLabel}</p>
                  <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {selected.specs.filter(row =>
                      !["reference volume", "tare mass", "max gross", "net payload"].includes(row.k.toLowerCase())
                    ).map(row => (
                      <div key={row.k} className="flex items-start justify-between gap-2 border-b border-[#345266]/60 py-1.5">
                        <span className="text-[10px] text-[#9dbdca]">{row.k}</span>
                        <span className="text-right font-mono text-[10px] text-white">{row.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-[#9ccbdc]">Aircraft references</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#c2dce6]">{selected.aircraft}</p>
                </div>

                {selectedId !== activeModel && (
                  <div className="border border-[#49687b] bg-[#102536] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[.14em] text-[#9bd5e8]">
                      Reference comparison · {selected.code} vs {active.code}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Metric name="Volume difference"
                        value={(selected.ratings.volumeM3 - active.ratings.volumeM3 >= 0 ? "+" : "") +
                          (selected.ratings.volumeM3 - active.ratings.volumeM3).toFixed(2) + " m³"} />
                      <Metric name="Payload difference"
                        value={(selected.ratings.payloadKg - active.ratings.payloadKg >= 0 ? "+" : "") +
                          (selected.ratings.payloadKg - active.ratings.payloadKg).toLocaleString("en-US") + " kg"} />
                    </div>
                    <p className="mt-2 text-[10px] text-[#9ebac6]">
                      Reference differences only; they do not establish compatibility, safe loading or floor limits.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onInspect(selectedId)}
                    className="min-h-11 flex-1 border border-[#a6e3f3] bg-[#8bcde2] px-4 font-mono text-[11px] font-bold uppercase tracking-wide text-[#071721] hover:bg-[#beeef6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {selectedId === activeModel ? "Return to 3D model" : "Open model in 3D"}
                  </button>
                  {selectedId !== activeModel && (
                    <button type="button" onClick={() => onCompare(selectedId)}
                      className="min-h-11 flex-1 border border-[#638fa5] bg-[#183749] px-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-[#2b5368] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                      Compare with {active.code}
                    </button>
                  )}
                  <button type="button" onClick={() => void copyReference()}
                    className="min-h-11 border border-[#527b91] px-3 font-mono text-[10px] font-semibold uppercase text-[#bee0ed] hover:bg-[#244353] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    Copy specs
                  </button>
                </div>
                <p role="status" aria-live="polite" className="min-h-[16px] font-mono text-[10px] text-[#b1d4df]">{copyStatus}</p>
                <p className="border-t border-[#325064] pt-3 text-[10px] leading-relaxed text-[#9bb6c2]">
                  ULD360 is an engineering visualization prototype. Registry dimensions and ratings
                  are reference figures, not OEM certification, approved aircraft fit, a loading
                  plan or structural restraint analysis. Verify the actual unit and aircraft documentation.
                </p>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-[#b3ced9]">
                Adjust your search to view a ULD technical reference.
              </div>
            )}
          </section>
        </div>
        <footer className="shrink-0 border-t border-[#365768] bg-[#081c29] px-4 py-2 font-mono text-[9px] leading-snug text-[#96bac9] sm:px-6">
          17 registry models · schematic silhouettes · reference ratings only · no certified flight-loading decisions
        </footer>
      </div>
    </div>
  );
}
