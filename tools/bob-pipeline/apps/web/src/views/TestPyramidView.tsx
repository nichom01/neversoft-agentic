import { useMemo, useState } from "react";
import { traceability } from "@bob-pipeline/shared";
import { PlanView, type StageViewProps } from "./base";

type Layer = "smoke" | "bdd" | "component" | "unit";
const LAYERS: Layer[] = ["smoke", "bdd", "component", "unit"];
const META: Record<Layer, { label: string; color: string; text: string; blurb: string }> = {
  smoke: { label: "Smoke", color: "#c2410c", text: "text-orange-700", blurb: "Is it alive after deploy?" },
  bdd: { label: "BDD", color: "#6d28d9", text: "text-violet-700", blurb: "Does it meet each acceptance criterion?" },
  component: { label: "Component", color: "#1d4ed8", text: "text-blue-700", blurb: "Do the changed boundaries keep their contracts?" },
  unit: { label: "Unit", color: "#0f766e", text: "text-brand-700", blurb: "Is the logic right, edge cases included?" },
};

interface PlannedTest {
  id: string;
  layer: Layer;
  title: string;
  gherkin?: string;
  target?: string;
  rationale: string;
  traces_to: string[];
}
interface TestsDoc {
  tests: PlannedTest[];
  gaps?: string[];
}
interface PlanDoc {
  acceptance_criteria?: { id: string; criterion: string }[];
  risks?: { risk: string; severity?: string }[];
}

function parse<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** The test-plan stage: pyramid by layer, coverage of criteria and risks, and each test's reason. */
export function TestPyramidView(props: StageViewProps) {
  const [tab, setTab] = useState<"pyramid" | "document">("pyramid");
  const [layer, setLayer] = useState<Layer | null>(null);

  const testsFile = props.files.find((f) => f.file.endsWith(".json") && f.exists);
  const tests = parse<TestsDoc>(testsFile?.content);
  // Acceptance criteria and risks come from whichever earlier stage output has them (hlp.json by default).
  const plan = useMemo(() => {
    for (const o of props.issue.outputs) {
      for (const f of o.files) {
        if (!f.file.endsWith(".json")) continue;
        const d = parse<PlanDoc>(f.content);
        if (d?.acceptance_criteria) return d;
      }
    }
    return {} as PlanDoc;
  }, [props.issue.outputs]);

  if (!tests?.tests) {
    return testsFile ? (
      <div className="space-y-3">
        <p className="text-sm text-red-700">tests.json couldn't be read as a test plan.</p>
        <PlanView {...props} />
      </div>
    ) : (
      <p className="text-sm text-muted">No test plan yet.</p>
    );
  }

  const report = traceability(plan, tests);
  const byLayer = Object.fromEntries(LAYERS.map((l) => [l, tests.tests.filter((t) => t.layer === l)])) as Record<Layer, PlannedTest[]>;
  const shown = layer ? byLayer[layer] : tests.tests;
  const acs = plan.acceptance_criteria ?? [];
  const risks = plan.risks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm">
        {(["pyramid", "document"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-control px-3 py-1 ${tab === t ? "bg-brand-700 text-white" : "bg-subtle text-ink"}`}
          >
            {t === "pyramid" ? "Pyramid and coverage" : "Plan document"}
          </button>
        ))}
      </div>

      {tab === "document" ? (
        <PlanView {...props} />
      ) : (
        <>
          <div className="grid items-center gap-6 md:grid-cols-[minmax(260px,1fr)_1fr]">
            <Pyramid counts={byLayer} selected={layer} onSelect={(l) => setLayer(layer === l ? null : l)} />
            <div className="space-y-3 text-sm">
              <div className="text-2xl font-bold">
                {tests.tests.length} <span className="text-base font-normal text-muted">planned tests</span>
              </div>
              <Stat ok={!report.uncoveredCriteria.length} label={`Acceptance criteria covered: ${acs.length - report.uncoveredCriteria.length}/${acs.length}`} />
              <Stat ok={!report.uncoveredRisks.length} label={`Risks covered: ${risks.length - report.uncoveredRisks.length}/${risks.length}`} />
              {report.unknownRefs.length > 0 && (
                <Stat ok={false} label={`Unknown references: ${report.unknownRefs.map((r) => `${r.test} → ${r.ref}`).join(", ")}`} />
              )}
              {tests.gaps?.length ? (
                <div className="rounded-control bg-canvas p-3">
                  <div className="mb-1 text-xs font-semibold text-muted">Deliberately not tested</div>
                  <ul className="list-disc pl-5 text-xs">
                    {tests.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-muted">Click a layer to filter the tests below.</p>
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Coverage</h3>
            <div className="overflow-auto rounded-control border border-line bg-surface">
              <table className="w-full text-xs">
                <thead className="bg-canvas text-left text-muted">
                  <tr>
                    <th className="px-3 py-2">Criterion / risk</th>
                    {LAYERS.map((l) => (
                      <th key={l} className={`px-3 py-2 ${META[l].text}`}>
                        {META[l].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {acs.map((ac) => (
                    <CoverageRow
                      key={ac.id}
                      label={<><b>{ac.id}</b> {ac.criterion}</>}
                      tests={tests.tests.filter((t) => t.traces_to.some((r) => r.trim().toUpperCase() === ac.id.toUpperCase()))}
                      uncovered={report.uncoveredCriteria.includes(ac.id)}
                    />
                  ))}
                  {risks.map((r) => (
                    <CoverageRow
                      key={r.risk}
                      label={<><span className="text-muted">Risk{r.severity ? ` (${r.severity})` : ""}:</span> {r.risk}</>}
                      tests={tests.tests.filter((t) => t.traces_to.some((x) => /^risk/i.test(x) && x.toLowerCase().includes(r.risk.toLowerCase().slice(0, 30))))}
                      uncovered={report.uncoveredRisks.includes(r.risk)}
                    />
                  ))}
                  {!acs.length && !risks.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-muted">
                        No acceptance criteria or risks found in the earlier plan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">
              {layer ? `${META[layer].label} tests` : "All tests, top down"} ({shown.length})
            </h3>
            <div className="space-y-3">
              {LAYERS.filter((l) => !layer || l === layer).flatMap((l) =>
                byLayer[l].map((t) => <TestCard key={t.id} t={t} />),
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Pyramid({ counts, selected, onSelect }: { counts: Record<Layer, PlannedTest[]>; selected: Layer | null; onSelect: (l: Layer) => void }) {
  const w = 300;
  const bandH = 52;
  const gap = 4;
  return (
    <svg viewBox={`0 0 ${w} ${LAYERS.length * (bandH + gap)}`} className="w-full max-w-sm" role="img" aria-label="Test pyramid">
      {LAYERS.map((l, i) => {
        // Each band's top edge matches the band above's bottom edge; smoke's top is wide enough for its label.
        const step = w / 2 / (LAYERS.length + 1);
        const topHalf = step * (i + 1);
        const botHalf = step * (i + 2);
        const y = i * (bandH + gap);
        const cx = w / 2;
        const pts = `${cx - topHalf},${y} ${cx + topHalf},${y} ${cx + botHalf},${y + bandH} ${cx - botHalf},${y + bandH}`;
        const dim = selected && selected !== l;
        return (
          <g key={l} onClick={() => onSelect(l)} style={{ cursor: "pointer" }} opacity={dim ? 0.35 : 1}>
            <polygon points={pts} fill={META[l].color} />
            <text x={cx} y={y + bandH / 2 - 3} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
              {META[l].label}
            </text>
            <text x={cx} y={y + bandH / 2 + 13} textAnchor="middle" fill="white" fontSize="12">
              {counts[l].length} test{counts[l].length === 1 ? "" : "s"}
            </text>
            <title>{META[l].blurb}</title>
          </g>
        );
      })}
    </svg>
  );
}

function Stat({ ok, label }: { ok: boolean; label: string }) {
  return <div className={ok ? "text-emerald-700" : "text-red-700"}>{ok ? "✓" : "✗"} {label}</div>;
}

function CoverageRow({ label, tests, uncovered }: { label: React.ReactNode; tests: PlannedTest[]; uncovered: boolean }) {
  return (
    <tr className={uncovered ? "bg-red-50" : ""}>
      <td className="px-3 py-2">
        {label}
        {uncovered && <span className="ml-2 text-red-700">not covered</span>}
      </td>
      {LAYERS.map((l) => (
        <td key={l} className="px-3 py-2">
          {tests
            .filter((t) => t.layer === l)
            .map((t) => (
              <span key={t.id} className="mr-1 inline-block rounded px-1.5 py-0.5 font-mono text-[11px] text-white" style={{ background: META[l].color }} title={t.title}>
                {t.id}
              </span>
            ))}
        </td>
      ))}
    </tr>
  );
}

function TestCard({ t }: { t: PlannedTest }) {
  const m = META[t.layer] ?? META.unit;
  return (
    <div className="rounded-control border border-line p-3" style={{ borderLeft: `4px solid ${m.color}` }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-xs text-muted">{t.id}</span>
        <span className={`text-xs font-semibold uppercase ${m.text}`}>{m.label}</span>
        <span className="font-medium">{t.title}</span>
      </div>
      {t.target && <div className="mt-1 font-mono text-xs text-muted">{t.target}</div>}
      <p className="mt-2 text-sm">
        <span className="font-semibold text-muted">Why this layer: </span>
        {t.rationale}
      </p>
      {t.gherkin && <pre className="mt-2 overflow-auto rounded bg-canvas p-2 text-xs">{t.gherkin}</pre>}
      <div className="mt-2 flex flex-wrap gap-1">
        {t.traces_to.map((r) => (
          <span key={r} className="rounded bg-subtle px-1.5 py-0.5 text-[11px] text-ink">
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
