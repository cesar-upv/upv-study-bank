import { Question, Answer } from '@/domain/content/types';
import { GradeResult, StudentResponse } from './types';
import {
  parseFormula,
  collectVariables,
  computeVector,
  buildTruthTable,
  evaluate,
} from '@/domain/logic';

const objectiveGrade = (score: number): GradeResult => ({ score, maxScore: 1, isAutograded: true, isCorrect: score === 1, feedback: score === 1 ? 'Respuesta correcta.' : 'Revisa la solución y vuelve a intentarlo.' });

export const graders = {
  multiple_choice(_q: Question, answer: Answer, response: Extract<StudentResponse, { type: 'multiple_choice' }>): GradeResult {
    const expected: string[] = answer.solution.correct_option_ids;
    const selected = new Set(response.selectedOptionIds);
    return objectiveGrade(selected.size === expected.length && expected.every(id => selected.has(id)) ? 1 : 0);
  },
  matching(question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'matching' }>): GradeResult {
    const items: { id: string }[] = question.payload.left;
    return objectiveGrade(items.filter(item => response.pairs[item.id] === answer.solution.pairs[item.id]).length / items.length);
  },
  ordering(_q: Question, answer: Answer, response: Extract<StudentResponse, { type: 'ordering' }>): GradeResult {
    const expected: string[] = answer.solution.ordered_ids;
    return objectiveGrade(response.orderedIds.length === expected.length && expected.every((id, i) => response.orderedIds[i] === id) ? 1 : 0);
  },
  single_choice(_question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'single_choice' }>): GradeResult {
    const correctId = answer.solution.correct_option_id;
    const isCorrect = response.selectedOptionId === correctId;
    return {
      score: isCorrect ? 1 : 0,
      maxScore: 1,
      isAutograded: true,
      isCorrect,
      feedback: isCorrect
        ? '¡Respuesta correcta!'
        : `Opción incorrecta. La opción correcta es la ${correctId.toUpperCase()}.`,
    };
  },

  proposition_check(
    _question: Question,
    answer: Answer,
    response: Extract<StudentResponse, { type: 'proposition_check' }>
  ): GradeResult {
    const expected = answer.solution.is_proposition;
    const isCorrect = response.isProposition === expected;
    return {
      score: isCorrect ? 1 : 0,
      maxScore: 1,
      isAutograded: true,
      isCorrect,
      feedback: isCorrect
        ? `¡Correcto! ${expected ? 'Es una proposición con valor de verdad bien definido.' : 'No es una proposición (oración interrogativa, imperativa o ambigua).'}`
        : `Incorrecto. ${expected ? 'Sí es una proposición.' : 'No es una proposición.'}`,
    };
  },

  translation(question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'translation' }>): GradeResult {
    const rawFormula = (response.formula || '').trim();
    if (!rawFormula) {
      return {
        score: 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: false,
        feedback: 'No se ingresó ninguna fórmula.',
      };
    }

    try {
      const studentAst = parseFormula(rawFormula);
      const studentVars = collectVariables(studentAst);
      const allowedVars: string[] = question.payload.variables || [];

      // Check for undeclared variables
      const undeclared = studentVars.filter((v) => !allowedVars.includes(v));
      if (undeclared.length > 0) {
        return {
          score: 0,
          maxScore: 1,
          isAutograded: true,
          isCorrect: false,
          feedback: `Variable no declarada: "${undeclared.join(', ')}". Solo se permiten las variables del dominio: ${allowedVars.join(', ')}.`,
        };
      }

      // Check equivalence with reference formula
      const refAst = parseFormula(answer.solution.formula);
      const studentVector = computeVector(studentAst, allowedVars);
      const refVector = computeVector(refAst, allowedVars);

      const isEquivalent = studentVector.every((val, idx) => val === refVector[idx]);

      return {
        score: isEquivalent ? 1 : 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: isEquivalent,
        feedback: isEquivalent
          ? '¡Correcto! Tu fórmula es semánticamente equivalente a la referencia.'
          : 'La fórmula ingresada no expresa correctamente la proposición en el dominio dado.',
      };
    } catch (err: any) {
      return {
        score: 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: false,
        feedback: `Error en la fórmula: ${err.message}`,
      };
    }
  },

  truth_table(question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'truth_table' }>): GradeResult {
    try {
      const ast = parseFormula(question.payload.formula);
      const table = buildTruthTable(ast, question.payload.variables);

      let totalCells = 0;
      let correctCells = 0;
      const cellErrors: string[] = [];

      // Check step columns and root column
      const stepCols = table.columns.filter((c) => !c.isVariable);

      for (let rIdx = 0; rIdx < table.rows.length; rIdx++) {
        const row = table.rows[rIdx];
        for (const col of stepCols) {
          totalCells++;
          const cellKey = `${rIdx}_${col.id}`;
          const studentVal = response.cells[cellKey];
          const expectedVal = row.values[col.id];

          if (studentVal === expectedVal) {
            correctCells++;
          } else {
            cellErrors.push(
              `Fila ${rIdx + 1}, columna "${col.header}": esperado ${expectedVal ? 'V' : 'F'}, recibido ${studentVal === null || studentVal === undefined ? 'Vacío' : studentVal ? 'V' : 'F'}`
            );
          }
        }
      }

      const cellRatio = totalCells > 0 ? correctCells / totalCells : 0;
      const expectsClassification = !!answer.solution.classification;

      let score = cellRatio;
      let isCorrect = cellRatio === 1;

      if (expectsClassification) {
        const classCorrect = response.classification === answer.solution.classification;
        score = 0.5 * cellRatio + (classCorrect ? 0.5 : 0);
        isCorrect = cellRatio === 1 && classCorrect;
      }

      return {
        score: Math.round(score * 100) / 100,
        maxScore: 1,
        isAutograded: true,
        isCorrect,
        feedback: isCorrect
          ? '¡Tabla de verdad completada con éxito!'
          : `Aciertos en tabla: ${correctCells} de ${totalCells} celdas correctas.${expectsClassification ? ` Clasificación: ${response.classification === answer.solution.classification ? 'Correcta' : 'Incorrecta'}.` : ''}`,
        details: { cellErrors: cellErrors.slice(0, 5), totalCells, correctCells },
      };
    } catch (err: any) {
      return {
        score: 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: false,
        feedback: `Error al evaluar la tabla: ${err.message}`,
      };
    }
  },

  equivalence(question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'equivalence' }>): GradeResult {
    const expectedEquiv = answer.solution.equivalent;
    const decisionCorrect = response.equivalent === expectedEquiv;

    if (expectedEquiv) {
      // Both are equivalent, no counterexample required
      return {
        score: decisionCorrect ? 1 : 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: decisionCorrect,
        feedback: decisionCorrect
          ? '¡Correcto! Las dos expresiones son equivalentes en todas las interpretaciones.'
          : 'Incorrecto: las dos expresiones son lógicamente equivalentes.',
      };
    }

    // Not equivalent: decision weighs 50%, counterexample weighs 50%
    let counterexampleValid = false;
    let ceFeedback = '';

    if (response.counterexample) {
      try {
        const leftAst = parseFormula(question.payload.left);
        const rightAst = parseFormula(question.payload.right);
        const leftVal = evaluate(leftAst, response.counterexample);
        const rightVal = evaluate(rightAst, response.counterexample);
        counterexampleValid = leftVal !== rightVal;
        ceFeedback = counterexampleValid
          ? 'Contraejemplo válido comprobado.'
          : 'La asignación no hace discrepar a las dos fórmulas.';
      } catch (e: any) {
        ceFeedback = `Error al comprobar contraejemplo: ${e.message}`;
      }
    } else {
      ceFeedback = 'No se proporcionó contraejemplo.';
    }

    const score = (decisionCorrect ? 0.5 : 0) + (counterexampleValid ? 0.5 : 0);

    return {
      score,
      maxScore: 1,
      isAutograded: true,
      isCorrect: score === 1,
      feedback: `${decisionCorrect ? 'Decisión correcta (no son equivalentes).' : 'Decisión incorrecta.'} ${ceFeedback}`,
    };
  },

  sat(question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'sat' }>): GradeResult {
    const expectedSat = answer.solution.satisfiable;
    const decisionCorrect = response.satisfiable === expectedSat;

    if (!expectedSat) {
      // Unsatisfiable: no model needed
      return {
        score: decisionCorrect ? 1 : 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: decisionCorrect,
        feedback: decisionCorrect
          ? '¡Correcto! La fórmula es insatisfacible (contradicción).'
          : 'Incorrecto: la fórmula no tiene ningún modelo satisfacible.',
      };
    }

    // Satisfiable: decision 50%, witness model 50%
    let modelValid = false;
    let modelFeedback = '';

    if (response.model) {
      try {
        const ast = parseFormula(question.payload.formula);
        const val = evaluate(ast, response.model);
        modelValid = val === true;
        modelFeedback = modelValid ? 'Modelo testigo válido verificado.' : 'La asignación no satisface la fórmula.';
      } catch (e: any) {
        modelFeedback = `Error al validar modelo: ${e.message}`;
      }
    } else {
      modelFeedback = 'No se proporcionó modelo testigo.';
    }

    const score = (decisionCorrect ? 0.5 : 0) + (modelValid ? 0.5 : 0);

    return {
      score,
      maxScore: 1,
      isAutograded: true,
      isCorrect: score === 1,
      feedback: `${decisionCorrect ? 'Decisión correcta (es satisfacible).' : 'Decisión incorrecta.'} ${modelFeedback}`,
    };
  },

  entailment(question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'entailment' }>): GradeResult {
    const expectedEntailed = answer.solution.entailed;
    const decisionCorrect = response.entailed === expectedEntailed;

    if (expectedEntailed) {
      return {
        score: decisionCorrect ? 1 : 0,
        maxScore: 1,
        isAutograded: true,
        isCorrect: decisionCorrect,
        feedback: decisionCorrect
          ? '¡Correcto! La base de conocimiento implica lógicamente la conclusión.'
          : 'Incorrecto: la conclusión sí se deduce de las premisas en todo modelo.',
      };
    }

    // Not entailed: decision 50%, counterexample 50%
    let counterexampleValid = false;
    let ceFeedback = '';

    if (response.counterexample) {
      try {
        const premisesAst = question.payload.premises.map((p: string) => parseFormula(p));
        const conclusionAst = parseFormula(question.payload.conclusion);
        const premisesTrue = premisesAst.every((p: any) => evaluate(p, response.counterexample!));
        const conclusionFalse = !evaluate(conclusionAst, response.counterexample!);
        counterexampleValid = premisesTrue && conclusionFalse;
        ceFeedback = counterexampleValid
          ? 'Contraejemplo válido: satisface todas las premisas y hace falsa la conclusión.'
          : 'La asignación no cumple la condición de contraejemplo (debe hacer V las premisas y F la conclusión).';
      } catch (e: any) {
        ceFeedback = `Error al verificar contraejemplo: ${e.message}`;
      }
    } else {
      ceFeedback = 'No se proporcionó contraejemplo.';
    }

    const score = (decisionCorrect ? 0.5 : 0) + (counterexampleValid ? 0.5 : 0);

    return {
      score,
      maxScore: 1,
      isAutograded: true,
      isCorrect: score === 1,
      feedback: `${decisionCorrect ? 'Decisión correcta (no hay consecuencia lógica).' : 'Decisión incorrecta.'} ${ceFeedback}`,
    };
  },

  short_answer(_question: Question, answer: Answer, response: Extract<StudentResponse, { type: 'short_answer' }>): GradeResult {
    const rubric = answer.solution.rubric || [];
    const totalMax = rubric.reduce((sum: number, r: any) => sum + r.points, 0);

    const criteriaScores = response.criteriaScores || {};
    let studentScore = 0;
    for (let i = 0; i < rubric.length; i++) {
      const pts = criteriaScores[i] ?? 0;
      studentScore += Math.min(rubric[i].points, Math.max(0, pts));
    }

    return {
      score: studentScore,
      maxScore: totalMax,
      isAutograded: false,
      isCorrect: studentScore === totalMax,
      feedback: 'Respuesta evaluada según la rúbrica de autoevaluación.',
      details: { modelAnswer: answer.solution.model_answer, rubric },
    };
  },
};

/**
 * Universal dispatcher to grade any student response.
 */
export function gradeResponse(question: Question, answer: Answer, response: StudentResponse): GradeResult {
  if (response.type !== question.type) throw new Error('El tipo de respuesta no coincide con la pregunta.');
  const grader = graders[question.type as keyof typeof graders];
  if (!grader) {
    throw new Error(`No existe calificador para el tipo "${question.type}"`);
  }
  return grader(question, answer, response as any);
}
