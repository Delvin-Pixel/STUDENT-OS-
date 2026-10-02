export type WorkflowType = 'research' | 'create' | 'build' | 'analyze' | 'plan' | 'general';
export type WorkflowStepKind = 'understand' | 'research' | 'execute' | 'verify' | 'deliver';

export type WorkflowPlanStep = { order: number; title: string; kind: WorkflowStepKind };

export function detectWorkflowType(request: string): WorkflowType {
  const text = request.toLowerCase();
  if (/\b(research|investigate|find out|look up|latest|recent|compare|sources|evidence)\b/.test(text)) return 'research';
  if (/\b(build|code|app|website|software|implement|develop|debug|feature)\b/.test(text)) return 'build';
  if (/\b(create|write|draft|make|generate|document|report|file|csv|json|plan document)\b/.test(text)) return 'create';
  if (/\b(analy[sz]e|analysis|diagnose|audit|evaluate|break down|investigate data)\b/.test(text)) return 'analyze';
  if (/\b(plan|roadmap|strategy|schedule|organize|steps|workflow)\b/.test(text)) return 'plan';
  return 'general';
}

export function shouldCreateWorkflow(request: string) {
  const text = request.trim();
  if (text.length >= 180) return true;
  const type = detectWorkflowType(text);
  if (type !== 'general') return true;
  return /\b(and then|then|step by step|end to end|from scratch|multiple|all of|whole|complete)\b/i.test(text);
}

export function buildWorkflowPlan(request: string) {
  const type = detectWorkflowType(request);
  const plan: WorkflowPlanStep[] = [
    { order: 1, title: 'Understand the request', kind: 'understand' },
  ];
  if (type === 'research' || type === 'analyze' || /\b(current|latest|recent|sources)\b/i.test(request)) {
    plan.push({ order: plan.length + 1, title: 'Gather and inspect relevant evidence', kind: 'research' });
  }
  plan.push({ order: plan.length + 1, title: 'Execute the work', kind: 'execute' });
  plan.push({ order: plan.length + 1, title: 'Verify the result', kind: 'verify' });
  plan.push({ order: plan.length + 1, title: 'Deliver the result', kind: 'deliver' });
  return { type, plan };
}
