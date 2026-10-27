export type NodeType =
  | 'variable'
  | 'constant'
  | 'not'
  | 'and'
  | 'or'
  | 'xor'
  | 'implies'
  | 'iff';

export interface VariableNode {
  type: 'variable';
  name: string;
}

export interface ConstantNode {
  type: 'constant';
  value: boolean;
}

export interface NotNode {
  type: 'not';
  child: ASTNode;
}

export interface BinaryNode {
  type: 'and' | 'or' | 'xor' | 'implies' | 'iff';
  left: ASTNode;
  right: ASTNode;
}

export type ASTNode = VariableNode | ConstantNode | NotNode | BinaryNode;

/**
 * Checks structural equality of two ASTs.
 */
export function areASTsEqual(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'variable':
      return a.name === (b as VariableNode).name;
    case 'constant':
      return a.value === (b as ConstantNode).value;
    case 'not':
      return areASTsEqual(a.child, (b as NotNode).child);
    case 'and':
    case 'or':
    case 'xor':
    case 'implies':
    case 'iff':
      return (
        areASTsEqual(a.left, (b as BinaryNode).left) &&
        areASTsEqual(a.right, (b as BinaryNode).right)
      );
  }
}

/**
 * Serializes an AST into canonical fully-parenthesized ASCII string
 * matching Python reference (e.g. "(p -> q)", "(not p)", "((p and q) -> r)").
 */
export function serializeToAscii(node: ASTNode): string {
  switch (node.type) {
    case 'variable':
      return node.name;
    case 'constant':
      return node.value ? 'true' : 'false';
    case 'not':
      return `(not ${serializeToAscii(node.child)})`;
    case 'and':
      return `(${serializeToAscii(node.left)} and ${serializeToAscii(node.right)})`;
    case 'or':
      return `(${serializeToAscii(node.left)} or ${serializeToAscii(node.right)})`;
    case 'xor':
      return `(${serializeToAscii(node.left)} xor ${serializeToAscii(node.right)})`;
    case 'implies':
      return `(${serializeToAscii(node.left)} -> ${serializeToAscii(node.right)})`;
    case 'iff':
      return `(${serializeToAscii(node.left)} <-> ${serializeToAscii(node.right)})`;
  }
}

/**
 * Serializes an AST into Unicode mathematical representation.
 */
export function serializeToUnicode(node: ASTNode): string {
  switch (node.type) {
    case 'variable':
      return node.name;
    case 'constant':
      return node.value ? 'V' : 'F';
    case 'not':
      return `¬${serializeToUnicode(node.child)}`;
    case 'and':
      return `(${serializeToUnicode(node.left)} ∧ ${serializeToUnicode(node.right)})`;
    case 'or':
      return `(${serializeToUnicode(node.left)} ∨ ${serializeToUnicode(node.right)})`;
    case 'xor':
      return `(${serializeToUnicode(node.left)} ⊕ ${serializeToUnicode(node.right)})`;
    case 'implies':
      return `(${serializeToUnicode(node.left)} → ${serializeToUnicode(node.right)})`;
    case 'iff':
      return `(${serializeToUnicode(node.left)} ↔ ${serializeToUnicode(node.right)})`;
  }
}

/**
 * Serializes an AST to LaTeX math representation.
 */
export function serializeToLatex(node: ASTNode): string {
  switch (node.type) {
    case 'variable':
      return node.name;
    case 'constant':
      return node.value ? '\\top' : '\\bot';
    case 'not':
      return `\\neg ${serializeToLatex(node.child)}`;
    case 'and':
      return `(${serializeToLatex(node.left)} \\land ${serializeToLatex(node.right)})`;
    case 'or':
      return `(${serializeToLatex(node.left)} \\lor ${serializeToLatex(node.right)})`;
    case 'xor':
      return `(${serializeToLatex(node.left)} \\oplus ${serializeToLatex(node.right)})`;
    case 'implies':
      return `(${serializeToLatex(node.left)} \\rightarrow ${serializeToLatex(node.right)})`;
    case 'iff':
      return `(${serializeToLatex(node.left)} \\leftrightarrow ${serializeToLatex(node.right)})`;
  }
}
