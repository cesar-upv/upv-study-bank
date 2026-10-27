import { ASTNode } from './ast';
import { collectVariables, enumerateAssignments, evaluate } from './evaluator';

export interface EntailmentResult {
  entailed: boolean;
  domain: string[];
  counterexamples: Record<string, boolean>[];
}

/**
 * Checks logical entailment: premises |= conclusion.
 * A counterexample is an assignment where ALL premises evaluate to true
 * but the conclusion evaluates to false.
 */
export function checkEntailment(
  premises: ASTNode[],
  conclusion: ASTNode,
  declaredDomain?: string[]
): EntailmentResult {
  const allVars = new Set<string>();
  for (const p of premises) {
    for (const v of collectVariables(p)) allVars.add(v);
  }
  for (const v of collectVariables(conclusion)) allVars.add(v);

  const domain = declaredDomain && declaredDomain.length > 0
    ? Array.from(new Set([...declaredDomain, ...allVars])).sort()
    : Array.from(allVars).sort();

  const assignments = enumerateAssignments(domain);
  const counterexamples: Record<string, boolean>[] = [];

  for (const a of assignments) {
    const premisesHold = premises.every((p) => evaluate(p, a));
    if (premisesHold) {
      const conclusionHolds = evaluate(conclusion, a);
      if (!conclusionHolds) {
        counterexamples.push({ ...a });
      }
    }
  }

  return {
    entailed: counterexamples.length === 0,
    domain,
    counterexamples,
  };
}
