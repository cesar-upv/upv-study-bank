import { ASTNode } from './ast';
import { collectVariables, enumerateAssignments, evaluate, classifyVector } from './evaluator';

export interface SatResult {
  satisfiable: boolean;
  domain: string[];
  models: Record<string, boolean>[];
  counterexamples: Record<string, boolean>[];
  vector: boolean[];
  classification: 'tautology' | 'contradiction' | 'contingency';
}

/**
 * Solves SAT on an AST over a declared or extracted domain.
 */
export function solveSat(ast: ASTNode, declaredDomain?: string[]): SatResult {
  const domain = declaredDomain && declaredDomain.length > 0
    ? Array.from(new Set([...declaredDomain, ...collectVariables(ast)])).sort()
    : collectVariables(ast);

  const assignments = enumerateAssignments(domain);
  const models: Record<string, boolean>[] = [];
  const counterexamples: Record<string, boolean>[] = [];
  const vector: boolean[] = [];

  for (const a of assignments) {
    const val = evaluate(ast, a);
    vector.push(val);
    if (val) {
      models.push({ ...a });
    } else {
      counterexamples.push({ ...a });
    }
  }

  return {
    satisfiable: models.length > 0,
    domain,
    models,
    counterexamples,
    vector,
    classification: classifyVector(vector),
  };
}
