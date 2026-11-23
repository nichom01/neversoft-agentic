import type { ComponentType } from "react";
import { DiffStageView, PlanView, RawView, type StageViewProps } from "./base";
import { DependencyView } from "./DependencyView";
import { TestPyramidView } from "./TestPyramidView";

export type { StageViewProps } from "./base";
export { UnifiedDiff } from "./base";

/**
 * Stage views. A stage's `view:` in pipeline.yaml picks one of these.
 * To add a view, write a component taking StageViewProps and register it
 * here. Unknown names fall back to the plan view.
 */
export const views: Record<string, ComponentType<StageViewProps>> = {
  plan: PlanView,
  raw: RawView,
  diff: DiffStageView,
  "dependency-graph": DependencyView,
  "test-pyramid": TestPyramidView,
};

export function StageView(props: StageViewProps) {
  const View = views[props.stage.view] ?? PlanView;
  return <View {...props} />;
}
