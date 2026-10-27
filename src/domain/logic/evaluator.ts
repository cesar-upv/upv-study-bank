import { ASTNode } from './ast';

export class LogicEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogicEvaluationError';
  }
}

/**
 * Collects all unique variable identifiers from an AST, sorted alphabetically.
 */
export function collectVariables(ast: ASTNode): string[] {
  const vars = new Set<string>();

  function walk(node: ASTNode) {
    switch (node.type) {
      case 'variable':
        vars.add(node.name);
        break;
      case 'constant':
        break;
      case 'not':
        walk(node.child);
        break;
      case 'and':
      case 'or':
      case 'xor':
      case 'implies':
      case 'iff':
        walk(node.left);
        walk(node.right);
        break;
    }
  }

  walk(ast);
  return Array.from(vars).sort();
}

/**
 * Pure evaluator: evaluates an AST against a boolean variable assignment.
 */
export function evaluate(ast: ASTNode, assignment: Record<string, boolean>): boolean {
  switch (ast.type) {
    case 'variable': {
      if (!(ast.name in assignment)) {
        throw new LogicEvaluationError(`Variable "${ast.name}" no está presente en la asignación`);
      }
      const val = assignment[ast.name];
      if (typeof val !== 'boolean') {
        throw new LogicEvaluationError(`El valor de la variable "${ast.name}" debe ser booleano`);
      }
      return val;
    }
    case 'constant':
      return ast.value;
    case 'not':
      return !evaluate(ast.child, assignment);
    case 'and':
      return evaluate(ast.left, assignment) && evaluate(ast.right, assignment);
    case 'or':
      return evaluate(ast.left, assignment) || evaluate(ast.right, assignment);
    case 'xor':
      return evaluate(ast.left, assignment) !== evaluate(ast.right, assignment);
    case 'implies': {
      const left = evaluate(ast.left, assignment);
      const right = evaluate(ast.right, assignment);
      return !left || right;
    }
    case 'iff':
      return evaluate(ast.left, assignment) === evaluate(ast.right, assignment);
  }
}

/**
 * Generates truth table assignments in 'false_first_lexicographic' order.
 * E.g. for ['p', 'q']:
 * row 0: { p: false, q: false }
 * row 1: { p: false, q: true }
 * row 2: { p: true, q: false }
 * row 3: { p: true, q: true }
 * For 0 variables: returns [{}] (1 row for constant formulas).
 */
export function enumerateAssignments(
  variables: string[],
  _rowOrder: 'false_first_lexicographic' = 'false_first_lexicographic'
): Record<string, boolean>[] {
  const uniqueVars = Array.from(new Set(variables));
  if (uniqueVars.length > 6) {
    throw new LogicEvaluationError('Se admiten como máximo 6 variables en la tabla de verdad');
  }

  const n = uniqueVars.length;
  if (n === 0) {
    return [{}];
  }

  const totalRows = 1 << n; // 2^n
  const rows: Record<string, boolean>[] = [];

  for (let i = 0; i < totalRows; i++) {
    const assignment: Record<string, boolean> = {};
    for (let j = 0; j < n; j++) {
      // Bit shift from most significant variable to least significant:
      // index n - 1 - j toggles faster or slower?
      // In Cartesian product product((False, True), repeat=n):
      // variable 0 has bit (i >> (n - 1 - 0)) & 1
      // variable n-1 has bit (i >> 0) & 1 (toggles fastest!)
      const varName = uniqueVars[j];
      const bit = (i >> (n - 1 - j)) & 1;
      assignment[varName] = bit === 1;
    }
    rows.push(assignment);
  }

  return rows;
}

/**
 * Computes truth vector for formula over the specified variables domain.
 */
export function computeVector(ast: ASTNode, variables: string[]): boolean[] {
  const rows = enumerateAssignments(variables);
  return rows.map((r) => evaluate(ast, r));
}

/**
 * Classifies truth vector as tautology, contradiction, or contingency.
 */
export function classifyVector(vector: boolean[]): 'tautology' | 'contradiction' | 'contingency' {
  if (vector.length === 0) {
    throw new LogicEvaluationError('El vector de verdad no puede estar vacío');
  }
  const allTrue = vector.every(Boolean);
  if (allTrue) return 'tautology';
  const allFalse = vector.every((v) => !v);
  if (allFalse) return 'contradiction';
  return 'contingency';
}
