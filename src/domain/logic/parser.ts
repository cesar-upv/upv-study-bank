import { ASTNode, BinaryNode, ConstantNode, NotNode, VariableNode } from './ast';
import { Token, tokenize } from './tokenizer';

export class LogicParseError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(`Error sintáctico en posición ${position}: ${message}`);
    this.name = 'LogicParseError';
    this.position = position;
  }
}

export class LogicParser {
  private tokens: Token[] = [];
  private current = 0;
  private depth = 0;
  private maxDepth = 32;

  constructor(source: string) {
    this.tokens = tokenize(source);
    this.current = 0;
    this.depth = 0;
  }

  public parse(): ASTNode {
    if (this.isAtEnd() || this.peek().type === 'EOF') {
      throw new LogicParseError('La fórmula está vacía', 0);
    }
    const ast = this.parseIff();
    if (!this.isAtEnd() && this.peek().type !== 'EOF') {
      const tok = this.peek();
      throw new LogicParseError(`Tokens adicionales no esperados: "${tok.value}"`, tok.position);
    }
    return ast;
  }

  private parseIff(): ASTNode {
    let expr = this.parseImplies();

    if (this.match('IFF')) {
      const right = this.parseImplies();

      // Check for chained IFF: p <-> q <-> r without parentheses
      if (this.peek().type === 'IFF') {
        throw new LogicParseError(
          'Cadenas de doble implicación (<->) requieren paréntesis explícitos: por ejemplo (p <-> q) <-> r',
          this.peek().position
        );
      }

      expr = {
        type: 'iff',
        left: expr,
        right,
      } as BinaryNode;
    }

    return expr;
  }

  private parseImplies(): ASTNode {
    let expr = this.parseOrXor();

    if (this.match('IMPLIES')) {
      const right = this.parseOrXor();

      // Check for chained IMPLIES: p -> q -> r without parentheses
      if (this.peek().type === 'IMPLIES') {
        throw new LogicParseError(
          'Cadenas de implicación (->) requieren paréntesis explícitos: por ejemplo (p -> q) -> r o p -> (q -> r)',
          this.peek().position
        );
      }

      expr = {
        type: 'implies',
        left: expr,
        right,
      } as BinaryNode;
    }

    return expr;
  }

  private parseOrXor(): ASTNode {
    let expr = this.parseAnd();

    let hasOr = false;
    let hasXor = false;

    while (this.peek().type === 'OR' || this.peek().type === 'XOR') {
      const isOr = this.peek().type === 'OR';
      const isXor = this.peek().type === 'XOR';
      const opTok = this.advance();

      if (isOr) {
        if (hasXor) {
          throw new LogicParseError(
            'XOR mezclado con OR requiere paréntesis explícitos para resolver la ambigüedad',
            opTok.position
          );
        }
        hasOr = true;
        const right = this.parseAnd();
        expr = {
          type: 'or',
          left: expr,
          right,
        } as BinaryNode;
      } else if (isXor) {
        if (hasOr) {
          throw new LogicParseError(
            'XOR mezclado con OR requiere paréntesis explícitos para resolver la ambigüedad',
            opTok.position
          );
        }
        if (hasXor) {
          throw new LogicParseError(
            'Cadenas de XOR requieren paréntesis explícitos: por ejemplo (p xor q) xor r',
            opTok.position
          );
        }
        hasXor = true;
        const right = this.parseAnd();
        expr = {
          type: 'xor',
          left: expr,
          right,
        } as BinaryNode;
      }
    }

    return expr;
  }

  private parseAnd(): ASTNode {
    let expr = this.parseNot();

    while (this.match('AND')) {
      const right = this.parseNot();
      expr = {
        type: 'and',
        left: expr,
        right,
      } as BinaryNode;
    }

    return expr;
  }

  private parseNot(): ASTNode {
    if (this.match('NOT')) {
      this.checkDepth();
      this.depth++;
      const child = this.parseNot();
      this.depth--;
      return {
        type: 'not',
        child,
      } as NotNode;
    }

    return this.parseAtom();
  }

  private parseAtom(): ASTNode {
    if (this.isAtEnd()) {
      throw new LogicParseError('Fin inesperado de la fórmula', this.previous()?.position ?? 0);
    }

    const tok = this.peek();

    if (tok.type === 'IDENTIFIER') {
      this.advance();
      return {
        type: 'variable',
        name: tok.value,
      } as VariableNode;
    }

    if (tok.type === 'CONSTANT') {
      this.advance();
      return {
        type: 'constant',
        value: !!tok.boolValue,
      } as ConstantNode;
    }

    if (this.match('LPAREN')) {
      this.checkDepth();
      this.depth++;
      const inner = this.parseIff();
      this.depth--;

      if (!this.match('RPAREN')) {
        throw new LogicParseError(
          'Se esperaba paréntesis de cierre ")"',
          this.peek()?.position ?? this.previous()?.position ?? 0
        );
      }
      return inner;
    }

    throw new LogicParseError(`Token inesperado "${tok.value}"`, tok.position);
  }

  private checkDepth() {
    if (this.depth > this.maxDepth) {
      throw new LogicParseError('La fórmula excede el límite máximo de profundidad (32)', this.peek().position);
    }
  }

  private match(...types: Token['type'][]): boolean {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: Token['type']): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.tokens[this.current].type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}

/**
 * Parses any valid propositional formula into an ASTNode.
 */
export function parseFormula(source: string): ASTNode {
  return new LogicParser(source).parse();
}
