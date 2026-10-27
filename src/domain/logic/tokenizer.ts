export type TokenType =
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'IMPLIES'
  | 'IFF'
  | 'LPAREN'
  | 'RPAREN'
  | 'CONSTANT'
  | 'IDENTIFIER'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  boolValue?: boolean;
  position: number;
}

export class LogicTokenizerError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(`Error léxico en posición ${position}: ${message}`);
    this.name = 'LogicTokenizerError';
    this.position = position;
  }
}

export function tokenize(source: string): Token[] {
  if (source.length > 2048) {
    throw new LogicTokenizerError('La fórmula excede el límite máximo de 2.048 caracteres', 2048);
  }

  const tokens: Token[] = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    // Skip whitespace
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }

    const startPos = i;

    // Check multi-char operator symbols first
    if (source.startsWith('<->', i)) {
      tokens.push({ type: 'IFF', value: '<->', position: startPos });
      i += 3;
      continue;
    }
    if (source.startsWith('->', i)) {
      tokens.push({ type: 'IMPLIES', value: '->', position: startPos });
      i += 2;
      continue;
    }

    // Single char operators / symbols
    const ch = source[i];
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: startPos });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: startPos });
      i++;
      continue;
    }
    if (ch === '¬' || ch === '~') {
      tokens.push({ type: 'NOT', value: 'not', position: startPos });
      i++;
      continue;
    }
    if (ch === '∧' || ch === '&') {
      tokens.push({ type: 'AND', value: 'and', position: startPos });
      i++;
      continue;
    }
    if (ch === '∨' || ch === '|') {
      tokens.push({ type: 'OR', value: 'or', position: startPos });
      i++;
      continue;
    }
    if (ch === '⊕' || ch === '^') {
      tokens.push({ type: 'XOR', value: 'xor', position: startPos });
      i++;
      continue;
    }
    if (ch === '→') {
      tokens.push({ type: 'IMPLIES', value: '->', position: startPos });
      i++;
      continue;
    }
    if (ch === '↔') {
      tokens.push({ type: 'IFF', value: '<->', position: startPos });
      i++;
      continue;
    }

    // Word tokens: identifiers, keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let word = '';
      while (i < len && /[a-zA-Z0-9_]/.test(source[i])) {
        word += source[i];
        i++;
      }
      const lower = word.toLowerCase();

      if (lower === 'not') {
        tokens.push({ type: 'NOT', value: 'not', position: startPos });
      } else if (lower === 'and') {
        tokens.push({ type: 'AND', value: 'and', position: startPos });
      } else if (lower === 'or') {
        tokens.push({ type: 'OR', value: 'or', position: startPos });
      } else if (lower === 'xor') {
        tokens.push({ type: 'XOR', value: 'xor', position: startPos });
      } else if (lower === 'implies') {
        tokens.push({ type: 'IMPLIES', value: '->', position: startPos });
      } else if (lower === 'iff') {
        tokens.push({ type: 'IFF', value: '<->', position: startPos });
      } else if (lower === 'true') {
        tokens.push({ type: 'CONSTANT', value: 'true', boolValue: true, position: startPos });
      } else if (lower === 'false') {
        tokens.push({ type: 'CONSTANT', value: 'false', boolValue: false, position: startPos });
      } else {
        // Must start with lowercase [a-z]
        if (!/^[a-z][a-z0-9_]*$/.test(word)) {
          throw new LogicTokenizerError(
            `Identificador inválido "${word}". Las variables deben comenzar con letra minúscula [a-z].`,
            startPos
          );
        }
        tokens.push({ type: 'IDENTIFIER', value: word, position: startPos });
      }
      continue;
    }

    throw new LogicTokenizerError(`Carácter inesperado "${ch}"`, startPos);
  }

  tokens.push({ type: 'EOF', value: '', position: source.length });
  return tokens;
}
