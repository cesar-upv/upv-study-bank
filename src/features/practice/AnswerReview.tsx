import type { Answer, Question } from '@/domain/content/types';
import type { StudentResponse } from '@/domain/assessment/types';
import { MarkdownView } from '@/components/MarkdownView';
import { buildTruthTable, parseFormula } from '@/domain/logic';

const bool = (value: boolean) => value ? 'Verdadero' : 'Falso';
const assignment = (values: Record<string, boolean>) => Object.entries(values).map(([key, value]) => `${key} = ${value ? 'V' : 'F'}`).join(', ');
export function solutionText(q: Question, a: Answer): string {
  const s = a.solution;
  const option = (id: string) => q.payload.options.find((o: { id: string }) => o.id === id)?.text || id;
  switch (q.type) {
    case 'single_choice': return option(s.correct_option_id);
    case 'multiple_choice': return s.correct_option_ids.map(option).join('\n\n');
    case 'matching': return q.payload.left.map((l: { id: string; text: string }) => `${l.text} → ${q.payload.right.find((r: { id: string }) => r.id === s.pairs[l.id])?.text}`).join('\n\n');
    case 'ordering': return s.ordered_ids.map((id: string, i: number) => `${i + 1}. ${q.payload.items.find((item: { id: string }) => item.id === id)?.text}`).join('\n');
    case 'proposition_check': return s.is_proposition ? 'Sí, es una proposición.' : 'No es una proposición.';
    case 'translation': return `\`${s.formula}\``;
    case 'truth_table': return `Clasificación: ${{ tautology: 'tautología', contradiction: 'contradicción', contingency: 'contingencia' }[s.classification as string]}.`;
    case 'equivalence': return s.equivalent ? 'Son equivalentes.' : `No son equivalentes. Contraejemplo: ${assignment(s.counterexamples[0] || {})}`;
    case 'sat': return s.satisfiable ? `Es satisfacible. Modelo: ${assignment(s.models[0] || {})}` : 'Es insatisfacible.';
    case 'entailment': return s.entailed ? 'La conclusión se deduce de las premisas.' : `La conclusión no se deduce. Contraejemplo: ${assignment(s.counterexamples[0] || {})}`;
    case 'short_answer': return s.model_answer;
  }
}
export function responseText(q: Question, r?: StudentResponse): string {
  if (!r) return 'Sin responder.';
  switch (r.type) {
    case 'single_choice': return q.payload.options.find((o: { id: string }) => o.id === r.selectedOptionId)?.text || 'Sin responder.';
    case 'multiple_choice': return r.selectedOptionIds.map(id => q.payload.options.find((o: { id: string }) => o.id === id)?.text).join('\n\n') || 'Sin responder.';
    case 'matching': return q.payload.left.map((l: { id: string; text: string }) => `${l.text} → ${q.payload.right.find((v: { id: string }) => v.id === r.pairs[l.id])?.text || 'Sin responder'}`).join('\n\n');
    case 'ordering': return r.orderedIds.map((id, i) => `${i + 1}. ${q.payload.items.find((v: { id: string }) => v.id === id)?.text}`).join('\n');
    case 'proposition_check': return r.isProposition ? 'Sí es una proposición.' : 'No es una proposición.';
    case 'translation': return `\`${r.formula}\``;
    case 'truth_table': return Object.entries(r.cells).map(([key, value]) => `${key}: ${value === null ? 'Vacío' : bool(value)}`).join('; ') + ` · ${r.classification || 'Sin clasificación'}`;
    case 'equivalence': return `${r.equivalent ? 'Equivalentes' : 'No equivalentes'}. ${assignment(r.counterexample || {})}`;
    case 'sat': return `${r.satisfiable ? 'Satisfacible' : 'Insatisfacible'}. ${assignment(r.model || {})}`;
    case 'entailment': return `${r.entailed ? 'Sí se deduce' : 'No se deduce'}. ${assignment(r.counterexample || {})}`;
    case 'short_answer': return r.studentText || 'Sin responder.';
  }
}
export function AnswerReview({ question, answer, response, showResponse = false }: { question: Question; answer: Answer; response?: StudentResponse; showResponse?: boolean }) {
  const table = question.type === 'truth_table' ? buildTruthTable(parseFormula(question.payload.formula), question.payload.variables) : null;
  return <div className="answer-review">{showResponse && <section><h3>Tu respuesta</h3><MarkdownView content={responseText(question, response)} /></section>}<section><h3>{question.type === 'short_answer' ? 'Respuesta modelo' : 'Solución correcta'}</h3><MarkdownView content={solutionText(question, answer)} />{table && <div className="table-scroll"><table><thead><tr>{table.columns.map(c => <th key={c.id}>{c.header}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}>{table.columns.map(c => <td key={c.id}>{row.values[c.id] ? 'V' : 'F'}</td>)}</tr>)}</tbody></table></div>}{question.type === 'short_answer' && <ul>{answer.solution.rubric.map((r: { criterion: string; points: number }) => <li key={r.criterion}>{r.criterion} ({r.points} puntos)</li>)}</ul>}</section><section><h3>Por qué</h3><MarkdownView content={answer.explanation} /></section></div>;
}
