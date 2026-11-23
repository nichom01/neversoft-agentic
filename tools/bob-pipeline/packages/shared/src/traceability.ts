/**
 * Test-plan traceability (phase 3), shared by the check_traceability action
 * and the test pyramid view.
 */
export interface TracePlan {
  acceptance_criteria?: { id: string; criterion?: string }[];
  risks?: { risk: string; severity?: string }[];
}

export interface TraceTests {
  tests: { id: string; layer: string; traces_to: string[] }[];
  gaps?: string[];
}

export function traceability(
  plan: TracePlan,
  tests: TraceTests,
) {
  const acIds = (plan.acceptance_criteria ?? []).map((a) => a.id);
  const refs = tests.tests.flatMap((t) => t.traces_to.map((ref) => ({ test: t.id, ref: ref.trim() })));
  const gaps = (tests.gaps ?? []).join("\n").toLowerCase();
  const traced = new Set(refs.map((r) => r.ref.toUpperCase()));
  const riskRefs = refs.filter((r) => /^risk\b/i.test(r.ref)).map((r) => r.ref.replace(/^risk:?\s*/i, "").toLowerCase());
  const unknownRefs = refs.filter((r) => /^AC-\d+$/i.test(r.ref) && !acIds.includes(r.ref.toUpperCase()));
  const uncoveredCriteria = acIds.filter((id) => !traced.has(id) && !gaps.includes(id.toLowerCase()));
  const uncoveredRisks = (plan.risks ?? [])
    .map((r) => r.risk)
    .filter((risk) => {
      const key = risk.toLowerCase().slice(0, 30);
      return !riskRefs.some((r) => r.includes(key) || key.includes(r.slice(0, 30))) && !gaps.includes(key);
    });
  const layers = ["smoke", "bdd", "component", "unit"].map((l) => `${l}: ${tests.tests.filter((t) => t.layer === l).length}`);
  return {
    unknownRefs,
    uncoveredCriteria,
    uncoveredRisks,
    summary: [`Test plan: ${tests.tests.length} tests (${layers.join(", ")})`, `Criteria covered: ${acIds.length - uncoveredCriteria.length}/${acIds.length}`],
  };
}
