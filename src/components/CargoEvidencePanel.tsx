import type { CargoEvidenceReport, EvidenceStatus } from "@/lib/cargoEvidence";

const STATUS: Record<EvidenceStatus, { label: string; tone: string }> = {
  "within-reference": { label: "WITHIN REFERENCE", tone: "text-[#c7e5f2]" },
  "exceeds-reference": { label: "EXCEEDS REFERENCE", tone: "text-[#f4ac9a]" },
  "preview-placed": { label: "PLACED IN PREVIEW", tone: "text-[#c7e5f2]" },
  "preview-rejected": { label: "PREVIEW REJECTED", tone: "text-[#f4ac9a]" },
  "not-run": { label: "NOT RUN", tone: "text-[#a1b8c5]" },
  "not-evaluated": { label: "NOT EVALUATED", tone: "text-[#f4ac9a]" },
  "not-verified": { label: "NOT VERIFIED", tone: "text-[#e2c38c]" },
};

/** Technical readout which cannot visually imply an operational approval. */
export function CargoEvidencePanel({ report }: { report: CargoEvidenceReport }) {
  const unresolved = report.checks.filter(c => c.status === "not-verified").length;
  const rejected = report.rejectedCartons > 0;
  return (
    <section aria-label="Cargo validation boundaries" className="border border-[#587b8c] bg-[#0b1c27]/90 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#80cce2]">
            Cargo evidence / {report.model.toUpperCase()}
          </div>
          <h3 className="mt-1 font-display text-[13px] font-bold text-white">
            Preview checks, not loading approval
          </h3>
        </div>
        <span className="border border-[#b28a51]/70 px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#e7c18b]">
          NOT CERTIFIED
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="border border-[#365565] bg-[#112c3a] p-2">
          <div className="text-[9px] uppercase tracking-wider text-[#a9c7d3]">Submitted / placed</div>
          <div className="mt-1 text-[14px] font-semibold text-white">{report.submittedCartons} / {report.placedCartons}</div>
        </div>
        <div className="border border-[#365565] bg-[#112c3a] p-2">
          <div className="text-[9px] uppercase tracking-wider text-[#a9c7d3]">Nominal reference payload</div>
          <div className="mt-1 text-[14px] font-semibold text-white">{report.nominalPayloadKg.toFixed(0)} kg</div>
        </div>
      </div>
      <p aria-live="polite" className="mt-2 text-[10px] leading-relaxed text-[#bfd9e5]">
        {rejected ? `${report.rejectedCartons} carton(s) rejected by the preview. ` : ""}
        {report.requestedMassKg == null ? "Submitted cargo mass cannot be evaluated. " :
          `${report.requestedMassKg.toFixed(1)} kg requested; ${report.acceptedMassKg.toFixed(1)} kg placed. `}
        {unresolved} operational checks remain NOT VERIFIED.
      </p>
      <details className="mt-2 border-t border-[#3c5869] pt-2">
        <summary className="min-h-9 cursor-pointer select-none font-mono text-[10px] font-bold uppercase tracking-[.08em] text-[#9bd5e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          View checks and evidence ({report.checks.length})
        </summary>
        <div className="space-y-2 pb-2 pt-1">
          {report.checks.map(c => (
            <div key={c.id} className="border border-[#375363] bg-[#0d2431] p-2">
              <div className="flex flex-wrap items-start justify-between gap-1">
                <div className="text-[10px] font-semibold text-[#e4f4fa]">{c.name}</div>
                <span className={`font-mono text-[9px] font-bold ${STATUS[c.status].tone}`}>
                  {STATUS[c.status].label}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-[#b3cbd7]">{c.explanation}</p>
              <p className="mt-1 text-[9px] leading-relaxed text-[#91abb9]">Basis: {c.evidence}</p>
            </div>
          ))}
        </div>
      </details>
      <p className="mt-2 text-[9px] leading-relaxed text-[#b7a080]">
        Aircraft loading, ULD structural limits, restraint certification and airline approval require independent manufacturer/operator evidence.
      </p>
    </section>
  );
}
