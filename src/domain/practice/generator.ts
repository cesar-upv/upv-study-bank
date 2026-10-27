import { Mulberry32 } from './prng';
import { ASTNode, BinaryNode, serializeToAscii, serializeToUnicode } from '@/domain/logic/ast';
import {
  buildTruthTable,
  checkEquivalence,
  solveSat,
} from '@/domain/logic';
import { Question, Answer } from '@/domain/content/types';
import generatorsConfig from './generators.json';
import { generatorFallback } from './fallbacks';

export interface GeneratedResult {
  question: Question;
  answer: Answer;
  meta: {
    generatorId: string;
    generatorVersion: number;
    seed: number;
    isFallback: boolean;
  };
}

const VAR_POOL = ['p', 'q', 'r', 's'];

/**
 * Generates a random valid bounded AST deterministically using PRNG.
 */
function generateRandomAST(
  prng: Mulberry32,
  vars: string[],
  maxDepth: number,
  allowedOperators: string[],
  currentDepth = 0
): ASTNode {
  // If at max depth or with 40% probability when depth > 0, return a variable
  if (currentDepth >= maxDepth || (currentDepth > 0 && prng.next() < 0.4)) {
    return {
      type: 'variable',
      name: prng.choice(vars),
    };
  }

  const op = prng.choice(allowedOperators);

  if (op === 'not') {
    return {
      type: 'not',
      child: generateRandomAST(prng, vars, maxDepth, allowedOperators, currentDepth + 1),
    };
  }

  const binaryType = op as 'and' | 'or' | 'xor' | 'implies' | 'iff';
  return {
    type: binaryType,
    left: generateRandomAST(prng, vars, maxDepth, allowedOperators, currentDepth + 1),
    right: generateRandomAST(prng, vars, maxDepth, allowedOperators, currentDepth + 1),
  };
}

/**
 * Applies an equivalence rewrite law to an AST to produce a semantically equivalent formula.
 */
function applyEquivalenceLaw(_prng: Mulberry32, ast: ASTNode, law: string): ASTNode {
  switch (law) {
    case 'double_negation':
      // Wrap in double not
      return { type: 'not', child: { type: 'not', child: ast } };
    case 'contraposition':
      if (ast.type === 'implies') {
        return {
          type: 'implies',
          left: { type: 'not', child: ast.right },
          right: { type: 'not', child: ast.left },
        };
      }
      return { type: 'not', child: { type: 'not', child: ast } };
    case 'implication':
      if (ast.type === 'implies') {
        return {
          type: 'or',
          left: { type: 'not', child: ast.left },
          right: ast.right,
        };
      }
      return { type: 'not', child: { type: 'not', child: ast } };
    case 'de_morgan':
      if (ast.type === 'and') {
        return {
          type: 'not',
          child: {
            type: 'or',
            left: { type: 'not', child: ast.left },
            right: { type: 'not', child: ast.right },
          },
        };
      } else if (ast.type === 'or') {
        return {
          type: 'not',
          child: {
            type: 'and',
            left: { type: 'not', child: ast.left },
            right: { type: 'not', child: ast.right },
          },
        };
      }
      return { type: 'not', child: { type: 'not', child: ast } };
    default:
      return { type: 'not', child: { type: 'not', child: ast } };
  }
}

/**
 * Mutates an AST slightly so it likely becomes non-equivalent.
 */
function mutateAST(prng: Mulberry32, ast: ASTNode, vars: string[]): ASTNode {
  if (ast.type === 'variable') {
    // Pick another variable if available
    const other = vars.filter((v) => v !== ast.name);
    return {
      type: 'variable',
      name: other.length > 0 ? prng.choice(other) : ast.name,
    };
  }
  if (ast.type === 'constant') {
    return { type: 'constant', value: !ast.value };
  }
  if (ast.type === 'not') {
    return ast.child; // Remove not
  }
  // Change binary operator or mutate child
  const binaryNode = ast as BinaryNode;
  const altOps: Array<'and' | 'or' | 'xor' | 'implies' | 'iff'> = ['and', 'or', 'xor', 'implies', 'iff'].filter(
    (o) => o !== binaryNode.type
  ) as any;
  if (prng.next() < 0.5) {
    return {
      type: prng.choice(altOps),
      left: binaryNode.left,
      right: binaryNode.right,
    };
  }
  return {
    type: binaryNode.type,
    left: mutateAST(prng, binaryNode.left, vars),
    right: binaryNode.right,
  };
}

export function generateQuestion(
  generatorId: string,
  level: 'basic' | 'intermediate' | 'advanced',
  seed: number
): GeneratedResult {
  const prng = new Mulberry32(seed);
  const levelConfig = generatorsConfig.levels[level];
  const genConfig = generatorsConfig.generators.find((g) => g.id === generatorId);

  if (!genConfig) {
    throw new Error(`Unknown generator ID: "${generatorId}"`);
  }

  const vars = VAR_POOL.slice(0, levelConfig.max_variables);
  const maxDepth = levelConfig.max_depth;
  const operators = levelConfig.operators;

  // 1. Truth Table Generator
  if (generatorId === 'truth-table-v1') {
    let attempts = 0;
    while (attempts < generatorsConfig.max_rejections) {
      attempts++;
      try {
        const ast = generateRandomAST(prng, vars, maxDepth, operators);
        const formulaAscii = serializeToAscii(ast);
        const table = buildTruthTable(ast, vars);

        // Discard trivial formulas (vector all true or all false in intermediate/advanced)
        if (level !== 'basic' && (table.classification === 'tautology' || table.classification === 'contradiction')) {
          continue;
        }

        const qId = `gen-${generatorId}-${seed}`;
        const question: Question = {
          schema_version: 1,
          id: qId,
          subject_id: 'laboratorio',
          unit_id: 'generados',
          topic_id: 'tablas',
          type: 'truth_table',
          difficulty: level,
          exam_scope: 'optional',
          prompt: `Construye la tabla de verdad paso a paso y clasifica la fórmula $${serializeToUnicode(ast)}$:`,
          payload: {
            formula: formulaAscii,
            variables: vars,
            row_order: 'false_first_lexicographic',
          },
          hints: ['Calcula primero las subexpresiones más internas antes del operador principal.'],
          source_ids: ['original-kit'],
        };

        const answer: Answer = {
          question_id: qId,
          solution: {
            vector: table.vector,
            classification: table.classification,
            satisfiable: table.satisfiable,
            models: table.models,
          },
          explanation: `La tabla de verdad tiene ${table.rows.length} filas. Su vector resultante es ${table.vector.map((v) => (v ? 'V' : 'F')).join('')}, clasificándose como ${table.classification}.`,
        };

        return {
          question,
          answer,
          meta: { generatorId, generatorVersion: 1, seed, isFallback: false },
        };
      } catch {
        continue;
      }
    }

    const fb = generatorFallback(genConfig.type);
    return {
      question: fb.question,
      answer: fb.answer,
      meta: { generatorId, generatorVersion: 1, seed, isFallback: true },
    };
  }

  // 2. Equivalence Generator
  if (generatorId === 'equivalence-v1') {
    const isPositive = prng.next() < 0.5;
    let attempts = 0;

    while (attempts < generatorsConfig.max_rejections) {
      attempts++;
      try {
        const leftAst = generateRandomAST(prng, vars, maxDepth, operators);
        let rightAst: ASTNode;

        if (isPositive) {
          const laws = genConfig.positive_laws || ['double_negation'];
          const law = prng.choice(laws);
          rightAst = applyEquivalenceLaw(prng, leftAst, law);
          const eqCheck = checkEquivalence(leftAst, rightAst, vars);
          if (!eqCheck.equivalent) continue;
        } else {
          rightAst = mutateAST(prng, leftAst, vars);
          const eqCheck = checkEquivalence(leftAst, rightAst, vars);
          if (eqCheck.equivalent) continue; // Must have counterexample!
        }

        const leftAscii = serializeToAscii(leftAst);
        const rightAscii = serializeToAscii(rightAst);
        const eqCheck = checkEquivalence(leftAst, rightAst, vars);

        const qId = `gen-${generatorId}-${seed}`;
        const question: Question = {
          schema_version: 1,
          id: qId,
          subject_id: 'laboratorio',
          unit_id: 'generados',
          topic_id: 'equivalencias-sat',
          type: 'equivalence',
          difficulty: level,
          exam_scope: 'optional',
          prompt: `Determina si las fórmulas $${serializeToUnicode(leftAst)}$ y $${serializeToUnicode(rightAst)}$ son lógicamente equivalentes:`,
          payload: {
            left: leftAscii,
            right: rightAscii,
            variables: vars,
          },
          hints: ['Compara sus vectores de verdad o aplica leyes lógicas reconocidas.'],
          source_ids: ['original-kit'],
        };

        const answer: Answer = {
          question_id: qId,
          solution: {
            equivalent: eqCheck.equivalent,
            counterexamples: eqCheck.counterexamples,
          },
          explanation: eqCheck.equivalent
            ? 'Las dos fórmulas son lógicamente equivalentes en todas las asignaciones.'
            : `Las dos fórmulas no son equivalentes. Un contraejemplo es: ${JSON.stringify(eqCheck.counterexamples[0])}.`,
        };

        return {
          question,
          answer,
          meta: { generatorId, generatorVersion: 1, seed, isFallback: false },
        };
      } catch {
        continue;
      }
    }

    const fb = generatorFallback(genConfig.type);
    return {
      question: fb.question,
      answer: fb.answer,
      meta: { generatorId, generatorVersion: 1, seed, isFallback: true },
    };
  }

  // 3. SAT Generator
  if (generatorId === 'sat-v1') {
    const targetClasses = genConfig.target_classes || ['satisfiable', 'unsatisfiable'];
    const targetClass = prng.choice(targetClasses);
    let attempts = 0;

    while (attempts < generatorsConfig.max_rejections) {
      attempts++;
      try {
        const ast = generateRandomAST(prng, vars, maxDepth, operators);
        const satResult = solveSat(ast, vars);

        const isSat = satResult.satisfiable;
        if (targetClass === 'satisfiable' && !isSat) continue;
        if (targetClass === 'unsatisfiable' && isSat) continue;

        const formulaAscii = serializeToAscii(ast);
        const qId = `gen-${generatorId}-${seed}`;

        const question: Question = {
          schema_version: 1,
          id: qId,
          subject_id: 'laboratorio',
          unit_id: 'generados',
          topic_id: 'equivalencias-sat',
          type: 'sat',
          difficulty: level,
          exam_scope: 'optional',
          prompt: `Determina si la fórmula $${serializeToUnicode(ast)}$ es satisfacible (SAT):`,
          payload: {
            formula: formulaAscii,
            variables: vars,
          },
          hints: ['Una fórmula es satisfacible si existe al menos una asignación de verdad que la hace verdadera.'],
          source_ids: ['original-kit'],
        };

        const answer: Answer = {
          question_id: qId,
          solution: {
            vector: satResult.vector,
            classification: satResult.classification,
            satisfiable: satResult.satisfiable,
            models: satResult.models,
          },
          explanation: satResult.satisfiable
            ? `La fórmula es satisfacible. Un modelo testigo es: ${JSON.stringify(satResult.models[0])}.`
            : 'La fórmula es insatisfacible (contradictoria), pues evalúa a Falso en todas las filas.',
        };

        return {
          question,
          answer,
          meta: { generatorId, generatorVersion: 1, seed, isFallback: false },
        };
      } catch {
        continue;
      }
    }

    const fb = generatorFallback(genConfig.type);
    return {
      question: fb.question,
      answer: fb.answer,
      meta: { generatorId, generatorVersion: 1, seed, isFallback: true },
    };
  }

  // 4. Translation Generator (from reviewed language templates)
  if (generatorId === 'translation-v1') {
    const contextSets = generatorsConfig.context_sets || [];
    const chosenContext = prng.choice(contextSets);
    const chosenTemplateId = prng.choice(chosenContext.templates);
    const template = generatorsConfig.language_templates.find((t) => t.id === chosenTemplateId);

    if (template) {
      const bindings: Record<string, string> = {
        p: chosenContext.p,
        q: chosenContext.q,
      };

      // Construct prompt using the context clauses
      let promptText = '';
      if (chosenTemplateId === 'sentence-only-if') {
        promptText = `${chosenContext.p.charAt(0).toUpperCase() + chosenContext.p.slice(1)} solo si ${chosenContext.q}.`;
      } else if (chosenTemplateId === 'sentence-if') {
        promptText = `${chosenContext.p.charAt(0).toUpperCase() + chosenContext.p.slice(1)} si ${chosenContext.q}.`;
      } else if (chosenTemplateId === 'sentence-sufficient') {
        promptText = `${chosenContext.q.charAt(0).toUpperCase() + chosenContext.q.slice(1)} es suficiente para ${chosenContext.p}.`;
      } else if (chosenTemplateId === 'sentence-necessary') {
        promptText = `${chosenContext.q.charAt(0).toUpperCase() + chosenContext.q.slice(1)} es necesario para ${chosenContext.p}.`;
      } else if (chosenTemplateId === 'sentence-not-and') {
        promptText = `No es cierto que ${chosenContext.p} y ${chosenContext.q}.`;
      } else {
        promptText = `${chosenContext.p.charAt(0).toUpperCase() + chosenContext.p.slice(1)} o ${chosenContext.q}, pero no ambas.`;
      }

      const qId = `gen-${generatorId}-${seed}`;
      const question: Question = {
        schema_version: 1,
        id: qId,
        subject_id: 'laboratorio',
        unit_id: 'generados',
        topic_id: 'operadores',
        type: 'translation',
        difficulty: level,
        exam_scope: 'optional',
        prompt: `Traduce la siguiente afirmación al lenguaje de la lógica proposicional:\n\n> "${promptText}"`,
        payload: {
          bindings,
          variables: ['p', 'q'],
        },
        hints: ['Identifica la condición antecedente y consecuente según el conectivo condicional.'],
        source_ids: ['original-kit'],
      };

      const answer: Answer = {
        question_id: qId,
        solution: {
          formula: template.formula,
        },
        explanation: `La forma proposicional correcta es ${template.formula}.`,
      };

      return {
        question,
        answer,
        meta: { generatorId, generatorVersion: 1, seed, isFallback: false },
      };
    }

    const fb = generatorFallback(genConfig.type);
    return {
      question: fb.question,
      answer: fb.answer,
      meta: { generatorId, generatorVersion: 1, seed, isFallback: true },
    };
  }

  throw new Error(`Unsupported generator: ${generatorId}`);
}
