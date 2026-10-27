import { contentRepo } from '@/infrastructure/content/repository';
import { CollectionControl } from './renderers/CollectionControl';
import { AnswerReview } from './AnswerReview';
import { questionRegistry, difficultyLabels } from '@/domain/content/question-registry';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Question, Answer } from '@/domain/content/types';
import { GradeResult, StudentResponse } from '@/domain/assessment/types';
import { gradeResponse } from '@/domain/assessment/graders';
import { MarkdownView } from '@/components/MarkdownView';
import { SingleChoiceControl } from './renderers/SingleChoiceControl';
import { PropositionCheckControl } from './renderers/PropositionCheckControl';
import { TranslationControl } from './renderers/TranslationControl';
import { TruthTableControl } from './renderers/TruthTableControl';
import { EquivalenceControl } from './renderers/EquivalenceControl';
import { SatControl } from './renderers/SatControl';
import { EntailmentControl } from './renderers/EntailmentControl';
import { ShortAnswerControl } from './renderers/ShortAnswerControl';
import { db } from '@/infrastructure/persistence/db';
import {
  BookOpenIcon,
  LightbulbIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
  XCircleIcon,
  InfoIcon,
} from '@/components/icons/Icons';

interface QuestionCardProps {
  question: Question;
  answer?: Answer;
  onAttemptSaved?: (result: GradeResult) => void;
  showLessonLink?: boolean;
  topicTitle?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  answer,
  onAttemptSaved,
  showLessonLink = true,
  topicTitle,
}) => {
  const [collectionResponse, setCollectionResponse] = useState<StudentResponse>();
  // Student state per type
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [isProposition, setIsProposition] = useState<boolean | null>(null);
  const [formula, setFormula] = useState('');
  const [cells, setCells] = useState<Record<string, boolean | null>>({});
  const [classification, setClassification] = useState('');
  const [equivalent, setEquivalent] = useState<boolean | null>(null);
  const [equivCE, setEquivCE] = useState<Record<string, boolean>>({});
  const [satisfiable, setSatisfiable] = useState<boolean | null>(null);
  const [satModel, setSatModel] = useState<Record<string, boolean>>({});
  const [entailed, setEntailed] = useState<boolean | null>(null);
  const [entailmentCE, setEntailmentCE] = useState<Record<string, boolean>>({});
  const [studentText, setStudentText] = useState('');
  const [criteriaScores, setCriteriaScores] = useState<Record<number, number>>({});

  // Assistance, hints & feedback
  const [assisted, setAssisted] = useState(false);
  const [visibleHints, setVisibleHints] = useState(0);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [rubricVisible, setRubricVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const hints = question.hints || [];

  const handleShowHint = () => {
    setAssisted(true);
    setVisibleHints((prev) => Math.min(prev + 1, hints.length));
  };

  const getStudentResponse = (): StudentResponse => {
    switch (question.type) {
      case 'multiple_choice': return collectionResponse || { type: 'multiple_choice', selectedOptionIds: [] };
      case 'matching': return collectionResponse || { type: 'matching', pairs: {} };
      case 'ordering': return collectionResponse || { type: 'ordering', orderedIds: [] };
      case 'single_choice':
        return { type: 'single_choice', selectedOptionId };
      case 'proposition_check':
        return { type: 'proposition_check', isProposition: isProposition ?? false };
      case 'translation':
        return { type: 'translation', formula };
      case 'truth_table':
        return { type: 'truth_table', cells, classification };
      case 'equivalence':
        return { type: 'equivalence', equivalent: equivalent ?? false, counterexample: equivCE };
      case 'sat':
        return { type: 'sat', satisfiable: satisfiable ?? false, model: satModel };
      case 'entailment':
        return { type: 'entailment', entailed: entailed ?? false, counterexample: entailmentCE };
      case 'short_answer':
        return { type: 'short_answer', studentText, criteriaScores };
    }
  };

  const handleSubmit = async () => {
    if (!answer || saving) return;
    const needsChoice = (question.type === 'proposition_check' && isProposition === null) ||
      (question.type === 'equivalence' && equivalent === null) ||
      (question.type === 'sat' && satisfiable === null) ||
      (question.type === 'entailment' && entailed === null) ||
      (question.type === 'single_choice' && !selectedOptionId) ||
      (question.type === 'multiple_choice' && (!collectionResponse || collectionResponse.type !== 'multiple_choice' || collectionResponse.selectedOptionIds.length === 0));
    if (needsChoice) { setSaveError('Selecciona una respuesta antes de comprobar.'); return; }
    if (question.type === 'translation' && !formula.trim()) { setSaveError('Escribe una fórmula antes de comprobar.'); return; }
    if (question.type === 'short_answer' && !studentText.trim()) { setSaveError('Escribe tu respuesta antes de ver la rúbrica.'); return; }
    if (question.type === 'ordering' && !collectionResponse) { setSaveError('Ordena los elementos o confirma el orden actual.'); return; }
    if (question.type === 'short_answer' && !rubricVisible) { setRubricVisible(true); return; }
    setSaving(true);
    setSaveError('');
    const response = getStudentResponse();
    const result = gradeResponse(question, answer, response);
    setGradeResult(result);


    // Save attempt to IndexedDB
    try {
      const attemptId = crypto.randomUUID ? crypto.randomUUID() : `att_${Date.now()}_${Math.random()}`;
      const unit = await contentRepo.getUnit(question.subject_id, question.unit_id);
      await db.transaction('rw', db.attempts, db.reviewItems, async () => {
        await db.attempts.add({
          id: attemptId,
          subjectId: question.subject_id,
          unitId: question.unit_id,
          questionId: question.id,
          contentRevision: unit?.revision ?? 1,
          snapshot: { question, answer },
          type: question.type,
          submittedResponse: response,
          score: result.score,
          maxScore: result.maxScore,
          assisted,
          submittedAt: new Date().toISOString(),
          feedback: result.feedback,
        });

        // Update Spaced Repetition Review rule:
        // error -> today (0 days)
        // assisted correct -> tomorrow (1 day)
        // 1st unassisted correct -> 3 days
        // 2nd consecutive unassisted correct -> 7 days
        // subsequent -> 14 days
        // new error resets sequence
        const reviewKey = `${question.subject_id}:${question.unit_id}:${question.id}`;
        const existingReview = await db.reviewItems.get(reviewKey);

        let consecutive = existingReview?.consecutiveUnassisted || 0;
        let intervalDays = 0;
        const isFullCorrect = result.isCorrect;

        if (!isFullCorrect) {
          consecutive = 0;
          intervalDays = 0;
        } else if (assisted) {
          consecutive = 0;
          intervalDays = 1;
        } else {
          // Unassisted correct
          if (consecutive === 0) {
            consecutive = 1;
            intervalDays = 3;
          } else if (consecutive === 1) {
            consecutive = 2;
            intervalDays = 7;
          } else {
            consecutive += 1;
            intervalDays = 14;
          }
        }

        const due = new Date();
        due.setDate(due.getDate() + intervalDays);

        await db.reviewItems.put({
          id: reviewKey,
          subjectId: question.subject_id,
          unitId: question.unit_id,
          questionId: question.id,
          dueDate: due.toISOString(),
          intervalDays,
          consecutiveUnassisted: consecutive,
          lastAttemptId: attemptId,
          lastScore: result.score,
          updatedAt: new Date().toISOString(),
        });

      });
      setIsSubmitted(true);
      if (onAttemptSaved) {
        onAttemptSaved(result);
      }
    } catch (e) {
      setSaveError('No se guardó el intento. Vuelve a pulsar comprobar para intentarlo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setIsSubmitted(false);
    setGradeResult(null);
    setRubricVisible(false);
    setAssisted(true);
  };

  return (
    <div className="card" style={{ marginBottom: '1.75rem', padding: '1.75rem' }}>
      {/* Question Header */}
      <div className="question-header">
        <div className="question-metadata">
          <span className="badge badge-info">{questionRegistry[question.type].label}</span>
          <span className="badge badge-neutral">{difficultyLabels[question.difficulty]}</span>
        </div>

        {showLessonLink && (
          <Link
            to={`/subjects/${question.subject_id}/units/${question.unit_id}/study/${question.topic_id}`}
            className="question-lesson-link"
          >
            <BookOpenIcon size={14} />
            <span>Ver lección: {topicTitle || question.topic_id.replaceAll('-', ' ')}</span>
          </Link>
        )}
      </div>

      <details className="question-reference"><summary>Referencia del ejercicio</summary><code>{question.id}</code></details>

      {/* Prompt */}
      <div style={{ fontSize: '1.05rem', margin: '1rem 0', lineHeight: 1.6 }}>
        <MarkdownView content={question.prompt} />
      </div>

      {['multiple_choice', 'matching', 'ordering'].includes(question.type) && <CollectionControl question={question} response={collectionResponse} onChange={setCollectionResponse} disabled={isSubmitted || saving} />}
      {/* Render input control depending on question type */}
      {question.type === 'single_choice' && (
        <SingleChoiceControl
          question={question}
          value={selectedOptionId}
          onChange={setSelectedOptionId}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'proposition_check' && (
        <PropositionCheckControl
          question={question}
          value={isProposition}
          onChange={setIsProposition}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'translation' && (
        <TranslationControl
          question={question}
          value={formula}
          onChange={setFormula}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'truth_table' && (
        <TruthTableControl
          question={question}
          cells={cells}
          classification={classification}
          onCellsChange={setCells}
          onClassificationChange={setClassification}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'equivalence' && (
        <EquivalenceControl
          question={question}
          equivalent={equivalent}
          counterexample={equivCE}
          onEquivalentChange={setEquivalent}
          onCounterexampleChange={setEquivCE}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'sat' && (
        <SatControl
          question={question}
          satisfiable={satisfiable}
          model={satModel}
          onSatisfiableChange={setSatisfiable}
          onModelChange={setSatModel}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'entailment' && (
        <EntailmentControl
          question={question}
          entailed={entailed}
          counterexample={entailmentCE}
          onEntailedChange={setEntailed}
          onCounterexampleChange={setEntailmentCE}
          disabled={isSubmitted || saving}
        />
      )}

      {question.type === 'short_answer' && (
        <ShortAnswerControl
          question={question}
          answer={answer}
          studentText={studentText}
          criteriaScores={criteriaScores}
          isSubmitted={isSubmitted || rubricVisible}
          disabled={isSubmitted || saving}
          onStudentTextChange={setStudentText}
          onCriteriaScoresChange={setCriteriaScores}
        />
      )}

      {/* Hints */}
      {hints.length > 0 && !isSubmitted && (
        <div style={{ margin: '1.25rem 0' }}>
          {visibleHints > 0 && (
            <div className="callout callout-info" style={{ marginBottom: '0.75rem' }}>
              <InfoIcon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--info-text)' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Pistas consultadas (intento asistido):</strong>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', fontSize: '0.875rem' }}>
                  {hints.slice(0, visibleHints).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {visibleHints < hints.length && (
            <button type="button" onClick={handleShowHint} className="btn-outline btn-sm">
              <LightbulbIcon size={15} />
              <span>Ver pista ({visibleHints + 1}/{hints.length})</span>
            </button>
          )}
        </div>
      )}

      {saveError && <p role="alert" className="callout callout-error">{saveError}</p>}
      {/* Submit / Retry Actions */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {!isSubmitted ? (
          <button type="button" onClick={handleSubmit} disabled={saving || !answer} className="btn-primary">
            {saving ? 'Guardando…' : question.type === 'short_answer' ? rubricVisible ? 'Guardar autoevaluación' : 'Comparar con la rúbrica' : 'Comprobar respuesta'}
          </button>
        ) : (
          <button type="button" onClick={handleRetry} className="btn-secondary">
            <RotateCcwIcon size={15} />
            <span>Reintentar ejercicio</span>
          </button>
        )}

        {assisted && (
          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
            Asistencia activada (repaso a 1 día)
          </span>
        )}
      </div>

      {/* Reasoned Feedback Result */}
      {isSubmitted && gradeResult && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className={gradeResult.isCorrect ? 'callout callout-success' : 'callout callout-error'}>
            {gradeResult.isCorrect ? (
              <CheckCircle2Icon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
            ) : (
              <XCircleIcon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                {gradeResult.isCorrect ? '¡Respuesta correcta!' : 'Necesita revisión'}
                {gradeResult.isAutograded && ` (Puntuación: ${Math.round(gradeResult.score * 100)}%)`}
              </div>
              <p style={{ fontSize: '0.925rem', lineHeight: 1.5 }}>{gradeResult.feedback}</p>
            </div>
          </div>

          {answer && <AnswerReview question={question} answer={answer} />}
        </div>
      )}
    </div>
  );
};
