import { ASTNode, areASTsEqual } from './ast';
import { collectVariables, enumerateAssignments, evaluate, classifyVector } from './evaluator';

export interface TruthTableColumn {
  id: string;
  header: string;
  ast?: ASTNode;
  isVariable: boolean;
  isRoot: boolean;
}

export interface TruthTableRow {
  assignment: Record<string, boolean>;
  values: Record<string, boolean>; // colId -> boolean
}

export interface TruthTableResult {
  variables: string[];
  columns: TruthTableColumn[];
  intermediateSteps: ASTNode[];
  rootAst: ASTNode;
  rows: TruthTableRow[];
  vector: boolean[];
  classification: 'tautology' | 'contradiction' | 'contingency';
  satisfiable: boolean;
  models: Record<string, boolean>[];
}

/**
 * Collects subexpressions in postorder, deduplicating structurally identical nodes.
 * Matches `collect_steps` from Python reference.
 */
export function collectSubexpressions(tree: ASTNode): ASTNode[] {
  if (tree.type === 'variable' || tree.type === 'constant') {
    return [];
  }

  const result: ASTNode[] = [];

  function postorder(node: ASTNode) {
    if (node.type === 'variable' || node.type === 'constant') {
      return;
    }
    if (node.type === 'not') {
      postorder(node.child);
    } else {
      postorder(node.left);
      postorder(node.right);
    }

    // Add node if not already in result structurally
    const exists = result.some((existing) => areASTsEqual(existing, node));
    if (!exists) {
      result.push(node);
    }
  }

  postorder(tree);
  return result;
}

/**
 * Builds a complete truth table for an AST.
 */
export function buildTruthTable(ast: ASTNode, declaredVariables?: string[]): TruthTableResult {
  const extractedVars = collectVariables(ast);
  const vars = declaredVariables && declaredVariables.length > 0
    ? Array.from(new Set([...declaredVariables, ...extractedVars])).sort()
    : extractedVars;

  const steps = collectSubexpressions(ast);
  const assignments = enumerateAssignments(vars);

  const columns: TruthTableColumn[] = [];

  // Variable columns
  for (const v of vars) {
    columns.push({
      id: `var_${v}`,
      header: v,
      isVariable: true,
      isRoot: false,
    });
  }

  // Intermediate step columns (all steps in postorder)
  for (let i = 0; i < steps.length; i++) {
    const stepAst = steps[i];
    const isRoot = areASTsEqual(stepAst, ast);
    columns.push({
      id: `step_${i}`,
      header: isRoot ? 'Resultado' : `Paso ${i + 1}`,
      ast: stepAst,
      isVariable: false,
      isRoot,
    });
  }

  // If the AST is just a variable or constant, it has no intermediate steps
  if (steps.length === 0) {
    columns.push({
      id: 'step_root',
      header: 'Resultado',
      ast,
      isVariable: false,
      isRoot: true,
    });
  }

  const rows: TruthTableRow[] = [];
  const vector: boolean[] = [];
  const models: Record<string, boolean>[] = [];

  for (const assignment of assignments) {
    const rowValues: Record<string, boolean> = {};

    // Variable values
    for (const v of vars) {
      rowValues[`var_${v}`] = assignment[v] ?? false;
    }

    // Intermediate step values
    for (let i = 0; i < steps.length; i++) {
      const stepVal = evaluate(steps[i], assignment);
      rowValues[`step_${i}`] = stepVal;
    }

    if (steps.length === 0) {
      const rootVal = evaluate(ast, assignment);
      rowValues['step_root'] = rootVal;
    }

    const rootVal = evaluate(ast, assignment);
    vector.push(rootVal);
    if (rootVal) {
      models.push({ ...assignment });
    }

    rows.push({
      assignment,
      values: rowValues,
    });
  }

  const classification = classifyVector(vector);
  const satisfiable = models.length > 0;

  return {
    variables: vars,
    columns,
    intermediateSteps: steps,
    rootAst: ast,
    rows,
    vector,
    classification,
    satisfiable,
    models,
  };
}
