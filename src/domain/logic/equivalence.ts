import { ASTNode } from './ast';
import { collectVariables, enumerateAssignments, evaluate } from './evaluator';

export interface EquivalenceResult {
  equivalent: boolean;
  domain: string[];
  counterexamples: Record<string, boolean>[];
}

/**
 * Checks semantic equivalence of two ASTs over their common union domain or a specified domain.
 */
export function checkEquivalence(
  left: ASTNode,
  right: ASTNode,
  declaredDomain?: string[]
): EquivalenceResult {
  const domain = declaredDomain && declaredDomain.length > 0
    ? Array.from(new Set([...declaredDomain, ...collectVariables(left), ...collectVariables(right)])).sort()
    : Array.from(new Set([...collectVariables(left), ...collectVariables(right)])).sort();

  const assignments = enumerateAssignments(domain);
  const counterexamples: Record<string, boolean>[] = [];

  for (const a of assignments) {
    const leftVal = evaluate(left, a);
    const rightVal = evaluate(right, a);
    if (leftVal !== rightVal) {
      counterexamples.push({ ...a });
    }
  }

  return {
    equivalent: counterexamples.length === 0,
    domain,
    counterexamples,
  };
}
