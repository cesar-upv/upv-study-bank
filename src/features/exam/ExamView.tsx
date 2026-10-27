import { LoadError } from '@/components/LoadError';
import { useConfirmation } from '@/components/use-confirmation';
import { UnitContentNotice, UnitUnavailable } from '@/components/UnitContentNotice';
import { getUnitCapabilities, topicTitle } from '@/domain/content/unit-capabilities';
import { CollectionControl } from '@/features/practice/renderers/CollectionControl';
import { AnswerReview } from '@/features/practice/AnswerReview';
import { questionRegistry } from '@/domain/content/question-registry';
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db, StoredSession } from '@/infrastructure/persistence/db';
import { contentRepo } from '@/infrastructure/content/repository';
import { Question, Answer, Subject, UnitManifest } from '@/domain/content/types';
import { StudentResponse } from '@/domain/assessment/types';
import { sampleExamQuestions, evaluateExam, hasExamResponse, ExamScoringResult } from '@/domain/exam/exam-service';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MarkdownView } from '@/components/MarkdownView';
import { SingleChoiceControl } from '@/features/practice/renderers/SingleChoiceControl';
import { PropositionCheckControl } from '@/features/practice/renderers/PropositionCheckControl';
import { TranslationControl } from '@/features/practice/renderers/TranslationControl';
import { TruthTableControl } from '@/features/practice/renderers/TruthTableControl';
import { EquivalenceControl } from '@/features/practice/renderers/EquivalenceControl';
import { SatControl } from '@/features/practice/renderers/SatControl';
import { EntailmentControl } from '@/features/practice/renderers/EntailmentControl';
import { ShortAnswerControl } from '@/features/practice/renderers/ShortAnswerControl';
import {
  TimerIcon,
  CheckCircle2Icon,
  XCircleIcon,
  RotateCcwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from '@/components/icons/Icons';

export const ExamView: React.FC = () => {
  const { subjectId = '', unitId = '' } = useParams<{ subjectId: string; unitId: string }>();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [unit, setUnit] = useState<UnitManifest | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [topicTitles, setTopicTitles] = useState<Record<string, string>>({});
  const [answersMap, setAnswersMap] = useState<Map<string, Answer>>(new Map());
  const [activeSession, setActiveSession] = useState<StoredSession | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersState, setAnswersState] = useState<Record<string, StudentResponse>>({});
  const [scoringResult, setScoringResult] = useState<ExamScoringResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect'>('all');
  const submitting = useRef(false);
  const latestAnswers = useRef<Record<string, StudentResponse>>({});
  const { confirm, cancel: cancelConfirmation, dialog: confirmationDialog } = useConfirmation();
  // Lobby config
  const [useTimer, setUseTimer] = useState(true);

  // Timer interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing session or setup
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError(false);
      try {
        const s = await contentRepo.getSubject(subjectId);
        const u = await contentRepo.getUnit(subjectId, unitId);
        const qList = await contentRepo.getQuestions(subjectId, unitId);
        const aList = await contentRepo.getAnswers(subjectId, unitId);
        const lessons = await contentRepo.getLessons(subjectId, unitId);
        setTopicTitles(Object.fromEntries(lessons.map(lesson => [lesson.frontmatter.topic_id, lesson.frontmatter.title])));

        setSubject(s || null);
        setUnit(u || null);
        setAllQuestions(qList);
        const aMap = new Map(aList.map((a) => [a.question_id, a]));
        setAnswersMap(aMap);

        // Check for existing in_progress session in IndexedDB
        const sessions = await db.sessions.where('[subjectId+unitId+status+mode]').anyOf([
          [subjectId, unitId, 'in_progress', 'exam'],
          [subjectId, unitId, 'submitted', 'exam'],
        ]).toArray();
        const existingSession = sessions.find(s => s.status === 'in_progress') || sessions.filter(s => s.status === 'submitted').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

        if (existingSession) {
          setActiveSession(existingSession);
          // Restore selected questions
          const qMap = new Map(qList.map((q) => [q.id, q]));
          const restoredQuestions = existingSession.questionSnapshot || existingSession.questionIds.map((id) => qMap.get(id)!).filter(Boolean);
          const restoredAnswers = existingSession.answerSnapshot ? new Map(existingSession.answerSnapshot.map(a => [a.question_id, a])) : aMap;
          setAnswersMap(restoredAnswers);
          latestAnswers.current = existingSession.answers || {};
          if (existingSession.status === 'submitted') setScoringResult(evaluateExam(restoredQuestions, restoredAnswers, existingSession.answers));
          setExamQuestions(restoredQuestions);
          setAnswersState(existingSession.answers || {});

          // Check deadline
          if (existingSession.deadline && existingSession.status === 'in_progress') {
            const remaining = Math.max(0, Math.floor((new Date(existingSession.deadline).getTime() - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining === 0) {
              // Automatically submit expired exam
              await submitExam(existingSession, restoredQuestions, existingSession.answers, restoredAnswers);
            }
          }
        }
      } catch (e) {
        setLoadError(true);
        console.error('Error loading exam data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [subjectId, unitId, loadAttempt]);

  // Countdown timer tick
  useEffect(() => {
    if (activeSession && activeSession.status === 'in_progress' && timeLeft !== null) {
      if (timeLeft <= 0) {
        // Time expired! Auto submit
        handleAutoSubmitOnExpiry();
        return;
      }
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return Math.max(0, Math.ceil((new Date(activeSession.deadline!).getTime() - Date.now()) / 1000));
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [activeSession, timeLeft]);

  const handleAutoSubmitOnExpiry = async () => {
    if (!activeSession || activeSession.status !== 'in_progress') return;
    cancelConfirmation();
    await submitExam(activeSession, examQuestions, latestAnswers.current, answersMap);
  };

  const startNewExam = async () => {
    if (allQuestions.length === 0 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSaveError('');
    try {
      // Sample the configured number of questions without replacement
      const sampled = sampleExamQuestions(allQuestions, unit?.exam?.quotas, unit?.exam?.question_count ?? 30);
      if (sampled.length === 0) return;
      const freshAnswers = await contentRepo.getAnswers(subjectId, unitId);
      const sessionId = crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`;
      const startedAt = new Date().toISOString();
      let deadline: string | null = null;
      let initialTimeLeft: number | null = null;

      if (useTimer) {
        const d = new Date(Date.now() + (unit?.exam?.duration_minutes ?? 45) * 60 * 1000); // 45 minutes
        deadline = d.toISOString();
        initialTimeLeft = (unit?.exam?.duration_minutes ?? 45) * 60;
      }

      const newSession: StoredSession = {
        id: sessionId,
        subjectId,
        unitId,
        status: 'in_progress',
        mode: 'exam',
        questionIds: sampled.map((q) => q.id),
        questionSnapshot: sampled,
        answerSnapshot: freshAnswers.filter(a => sampled.some(q => q.id === a.question_id)),
        contentRevision: unit?.revision ?? 1,
        answers: {},
        startedAt,
        deadline,
      };

      await db.sessions.put(newSession);
      setAnswersMap(new Map(freshAnswers.map(a => [a.question_id, a])));
      latestAnswers.current = {};
      setExamQuestions(sampled);
      setAnswersState({});
      setCurrentIndex(0);
      setScoringResult(null);

      setActiveSession(newSession);
      setTimeLeft(initialTimeLeft);
    } catch { setSaveError('No se pudo iniciar el simulacro. Vuelve a intentarlo.'); }
    finally { submitting.current = false; setBusy(false); }
  };

  const handleAnswerChange = async (questionId: string, response: StudentResponse) => {
    if (submitting.current || activeSession?.status !== 'in_progress' || (activeSession.deadline && Date.now() >= new Date(activeSession.deadline).getTime())) return;
    const updated = { ...latestAnswers.current, [questionId]: response };
    latestAnswers.current = updated;
    setAnswersState(updated);
    if (activeSession && activeSession.status === 'in_progress') {
      try {
        await db.sessions.update(activeSession.id, { answers: updated });
        setSaveError('');
      } catch { setSaveError('No se pudo guardar tu respuesta. Mantén esta página abierta e intenta entregar de nuevo.'); }
    }
  };

  const submitExam = async (
    session: StoredSession,
    questions: Question[],
    responses: Record<string, StudentResponse>,
    answers: Map<string, Answer>
  ) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const result = evaluateExam(questions, answers, responses);
      const completedSession: StoredSession = {
        ...session, status: 'submitted', submittedAt: new Date().toISOString(),
        autogradedScore: result.autogradedTotalScore, autogradedCount: result.autogradedCount,
        answers: responses,
      };
      await db.transaction('rw', db.sessions, db.attempts, async () => {
        await db.sessions.put(completedSession);
        for (const q of questions) {
          const resp = responses[q.id];
          const g = result.questionGrades[q.id];
          if (!resp || !g) continue;
          await db.attempts.put({
            id: `${session.id}:${q.id}`, subjectId: session.subjectId, unitId: session.unitId,
            questionId: q.id, contentRevision: session.contentRevision ?? 1, type: q.type,
            submittedResponse: resp, score: g.score, maxScore: g.maxScore, assisted: false,
            submittedAt: completedSession.submittedAt!, feedback: g.feedback,
          });
        }
      });
      setScoringResult(result);
      setActiveSession(completedSession);
      setSaveError('');
    } catch {
      setSaveError('No se pudo guardar el simulacro completo. Mantén esta página abierta e intenta entregarlo de nuevo.');
    } finally { submitting.current = false; setBusy(false); }
  };

  const handleManualSubmit = async () => {
    if (!activeSession || activeSession.status !== 'in_progress' || submitting.current) return;
    const unanswered = examQuestions.filter(q => !hasExamResponse(latestAnswers.current[q.id])).length;
    if (await confirm({
      title: '¿Entregar el simulacro?',
      description: unanswered > 0 ? `Quedan ${unanswered} ${unanswered === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}. Las preguntas objetivas omitidas se calificarán con cero.` : 'Se guardarán tus respuestas y se mostrará la calificación del intento.',
      detail: 'Después de entregar podrás consultar tus respuestas y las soluciones explicadas.',
      confirmLabel: 'Entregar simulacro', cancelLabel: 'Seguir respondiendo',
    })) {
      await submitExam(activeSession, examQuestions, latestAnswers.current, answersMap);
    }
  };

  const handleAbandon = async () => {
    if (!activeSession || submitting.current) return;
    if (await confirm({ title: '¿Abandonar el simulacro?', description: 'Se descartará este intento en curso. Puedes cancelar para seguir respondiendo.', confirmLabel: 'Abandonar simulacro', cancelLabel: 'Seguir respondiendo', tone: 'danger' })) {
      if (submitting.current) return;
      submitting.current = true;
      setBusy(true);
      try {
        await db.sessions.put({
          ...activeSession,
          answers: latestAnswers.current,
          status: 'abandoned',
        });
        setActiveSession(null);
        setExamQuestions([]);
        setAnswersState({});
        setTimeLeft(null);
        setSaveError('');
      } catch { setSaveError('No se pudo abandonar el simulacro. Tu sesión sigue abierta; vuelve a intentarlo.'); }
      finally { submitting.current = false; setBusy(false); }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Cargando simulacro de examen...</p>
      </div>
    );
  }

  if (loadError) return <LoadError message="No pudimos cargar el simulacro guardado. Tus datos no se han modificado." onRetry={() => setLoadAttempt(n => n + 1)} />;

  if (!subject || !unit) {
    return <UnitUnavailable />;
  }

  // Format time mm:ss
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // State 1: Lobby / Setup
  if (!activeSession || activeSession.status === 'abandoned') {
    const capabilities = getUnitCapabilities(unit, unit.lessons.length, allQuestions);
    if (!capabilities.canExam) return <UnitContentNotice unit={unit} capabilities={capabilities} section="exam" />;
    return (
      <div>
        {saveError && <p role="alert" className="callout callout-error">{saveError}</p>}
        <Breadcrumbs
          items={[
            { label: subject.title, to: `/` },
            { label: unit.title, to: `/subjects/${subjectId}/units/${unitId}` },
            { label: 'Simulacro' },
          ]}
        />

        <div className="card" style={{ maxWidth: '820px', margin: '0 auto', padding: '2.25rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: '2.1rem', letterSpacing: '-0.025em', marginBottom: '0.4rem' }}>
              {capabilities.isExamOnly ? unit.title : `Simulacro de Examen: ${unit.title}`}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Simula las condiciones formales del examen con una selección de preguntas de esta unidad sin reemplazo, orden aleatorio y retroalimentación completa al finalizar.
            </p>
          </div>

          <p className="exam-summary">{capabilities.examQuestionCount} {capabilities.examQuestionCount === 1 ? 'pregunta' : 'preguntas'} · {unit.exam?.duration_minutes ?? 45} minutos · Soluciones al entregar</p>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}>
              <input
                type="checkbox"
                checked={useTimer}
                onChange={(e) => setUseTimer(e.target.checked)}
                style={{
                  margin: 0,
                  width: '18px',
                  height: '18px',
                  flexShrink: 0,
                  accentColor: 'var(--accent-primary)',
                  cursor: 'pointer',
                }}
              />
              <span>Activar temporizador ({unit.exam?.duration_minutes ?? 45} minutos)</span>
            </label>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1.75rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
              Puedes recargar la página y continuar con el tiempo restante. Al expirar, las respuestas guardadas se entregan automáticamente.
            </p>
          </div>

          <div>
            {!allQuestions.some(q => q.exam_scope === 'required') && <p>Esta unidad no tiene preguntas incluidas en simulacros.</p>}
            <button type="button" onClick={startNewExam} disabled={busy || !allQuestions.some(q => q.exam_scope === 'required')} className="btn-primary" style={{ padding: '0.75rem 1.75rem', fontSize: '1.05rem', gap: '0.6rem' }}>
              <TimerIcon size={18} />
              <span>Iniciar Simulacro de Examen</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Submitted Results View
  if (activeSession.status === 'submitted' && scoringResult) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: subject.title, to: `/` },
            { label: unit.title, to: `/subjects/${subjectId}/units/${unitId}` },
            { label: 'Resultados del Simulacro' },
          ]}
        />

        <div className="card" style={{ marginBottom: '2rem', padding: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <span className="badge badge-success" style={{ marginBottom: '0.4rem' }}>Examen calificado</span>
              <h1 style={{ fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>
                Resultados del Simulacro
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
                Compara tus respuestas y repasa los conceptos que necesitas reforzar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setScoringResult(null);
              }}
              className="btn-primary"
            >
              <RotateCcwIcon size={15} />
              <span>Nuevo Simulacro</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="stat-card">
              <span className="stat-label">Nota automática promedio</span>
              <div className="stat-value" style={{ color: scoringResult.autogradedAverage >= 0.7 ? 'var(--success-text)' : 'var(--accent-primary)' }}>
                {Math.round(scoringResult.autogradedAverage * 100)}%
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {scoringResult.autogradedTotalScore.toFixed(1)} / {scoringResult.autogradedCount} puntos autocalificados
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Preguntas autocalificadas</span>
              <div className="stat-value">
                {scoringResult.autogradedCount}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {scoringResult.unansweredCount} omitidas (puntuación 0)
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Respuestas abiertas</span>
              <div className="stat-value">
                {scoringResult.selfAssessedCount}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Autoevaluación con rúbrica independiente
              </span>
            </div>
          </div>
        </div>

        <label className="review-filter">Mostrar <select value={reviewFilter} onChange={e => setReviewFilter(e.target.value as 'all' | 'incorrect')}><option value="all">Todas las preguntas</option><option value="incorrect">Pendientes de revisar</option></select></label>
        {/* Breakdown of each question */}
        <section aria-labelledby="review-results-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 id="review-results-title" style={{ fontSize: '1.4rem' }}>
              Revisión de las {examQuestions.length} preguntas
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Análisis razonado por ejercicio
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {examQuestions.map((q, idx) => {
              if (reviewFilter === 'incorrect' && scoringResult.questionGrades[q.id]?.isCorrect) return null;
              const g = scoringResult.questionGrades[q.id];
              const a = answersMap.get(q.id);
              const isPass = g?.isCorrect ?? false;

              return (
                <div key={q.id} className="card" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{idx + 1}.</span>
                      <span className="badge badge-info">{topicTitle(q.topic_id, unit.topic_ids, topicTitles)}</span>
                      <span className="badge badge-neutral">{questionRegistry[q.type].label}</span>
                    </div>

                    <span className={`badge ${isPass ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.8rem' }}>
                      {g ? `${Math.round(g.score / g.maxScore * 100)}%` : '0%'}
                    </span>
                  </div>

                  <div style={{ margin: '0.75rem 0', lineHeight: 1.6 }}>
                    <MarkdownView content={q.prompt} />
                  </div>

                  {g && (
                    <div className={isPass ? 'callout callout-success' : 'callout callout-error'} style={{ marginTop: '0.85rem' }}>
                      {isPass ? (
                        <CheckCircle2Icon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
                      ) : (
                        <XCircleIcon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
                      )}
                      <div>
                        <strong>{q.type === 'short_answer' ? 'Autoevaluación' : isPass ? 'Correcto' : 'Por revisar'}</strong>: {g.feedback}
                      </div>
                    </div>
                  )}

                  {a && <AnswerReview question={q} answer={a} response={answersState[q.id]} showResponse />}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // State 3: Exam In Progress
  const currentQ = examQuestions[currentIndex];
  const currentResp = currentQ ? answersState[currentQ.id] : undefined;

  return (
    <div>
      {confirmationDialog}
      {saveError && <p role="alert" className="callout callout-error">{saveError}</p>}
      {/* Exam Header HUD */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          position: 'sticky',
          top: '1rem',
          zIndex: 40,
          boxShadow: 'var(--shadow-md)',
          padding: '1rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.2rem', letterSpacing: '-0.02em', margin: 0 }}>
            Simulacro ({currentIndex + 1}/{examQuestions.length})
          </h2>

          {timeLeft !== null && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.15rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: timeLeft < 300 ? 'var(--error-text)' : 'var(--text-primary)',
                padding: '0.35rem 0.75rem',
                backgroundColor: timeLeft < 300 ? 'var(--error-bg)' : 'var(--bg-surface-elevated)',
                border: `1px solid ${timeLeft < 300 ? 'var(--error-border)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Tiempo restante"
              aria-label={`Tiempo restante: ${formatTimer(timeLeft)}`}
            >
              <TimerIcon size={18} />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" onClick={handleAbandon} disabled={busy} className="btn-outline btn-sm">
            Abandonar
          </button>
          <button type="button" onClick={handleManualSubmit} disabled={busy} className="btn-primary btn-sm">
            <CheckIcon size={14} />
            <span>Entregar examen</span>
          </button>
        </div>
      </div>

      {/* Question Selector Strip (30 questions matrix) */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          padding: '0.75rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xs)',
        }}
        aria-label="Matriz de navegación de preguntas"
      >
        {examQuestions.map((q, idx) => {
          const isAnswered = hasExamResponse(answersState[q.id]);
          const isCurrent = idx === currentIndex;

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: '44px',
                height: '44px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: isCurrent ? 700 : 500,
                backgroundColor: isCurrent
                  ? 'var(--accent-primary)'
                  : isAnswered
                  ? 'var(--info-bg)'
                  : 'var(--bg-surface)',
                color: isCurrent
                  ? 'var(--accent-text)'
                  : isAnswered
                  ? 'var(--info-text)'
                  : 'var(--text-secondary)',
                border: `1px solid ${
                  isCurrent
                    ? 'var(--accent-primary)'
                    : isAnswered
                    ? 'var(--info-border)'
                    : 'var(--border-color)'
                }`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Pregunta ${idx + 1}${isAnswered ? ' (respondida)' : ' (sin responder)'}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current Question Display */}
      {currentQ && (
        <div className="card" style={{ padding: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge badge-info">{topicTitle(currentQ.topic_id, unit.topic_ids, topicTitles)}</span>
              <span className="badge badge-neutral">{questionRegistry[currentQ.type].label}</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pregunta <strong style={{ color: 'var(--text-primary)' }}>{currentIndex + 1}</strong> de {examQuestions.length}
            </span>
          </div>

          <div style={{ fontSize: '1.05rem', margin: '1rem 0', lineHeight: 1.6 }}>
            <MarkdownView content={currentQ.prompt} />
          </div>

          <fieldset className="exam-answer-fields" disabled={busy || timeLeft === 0}>
          {['multiple_choice', 'matching', 'ordering'].includes(currentQ.type) && <CollectionControl question={currentQ} response={currentResp} onChange={value => handleAnswerChange(currentQ.id, value)} />}
          {/* Render inputs during exam without showing answers */}
          {currentQ.type === 'single_choice' && (
            <SingleChoiceControl
              question={currentQ}
              value={(currentResp as any)?.selectedOptionId || ''}
              onChange={(val) => handleAnswerChange(currentQ.id, { type: 'single_choice', selectedOptionId: val })}
            />
          )}

          {currentQ.type === 'proposition_check' && (
            <PropositionCheckControl
              question={currentQ}
              value={(currentResp as any)?.isProposition ?? null}
              onChange={(val) => handleAnswerChange(currentQ.id, { type: 'proposition_check', isProposition: val })}
            />
          )}

          {currentQ.type === 'translation' && (
            <TranslationControl
              question={currentQ}
              value={(currentResp as any)?.formula || ''}
              onChange={(val) => handleAnswerChange(currentQ.id, { type: 'translation', formula: val })}
            />
          )}

          {currentQ.type === 'truth_table' && (
            <TruthTableControl
              question={currentQ}
              cells={(currentResp as any)?.cells || {}}
              classification={(currentResp as any)?.classification || ''}
              onCellsChange={(newCells) =>
                handleAnswerChange(currentQ.id, {
                  type: 'truth_table',
                  cells: newCells,
                  classification: (currentResp as any)?.classification || '',
                })
              }
              onClassificationChange={(newClass) =>
                handleAnswerChange(currentQ.id, {
                  type: 'truth_table',
                  cells: (currentResp as any)?.cells || {},
                  classification: newClass,
                })
              }
            />
          )}

          {currentQ.type === 'equivalence' && (
            <EquivalenceControl
              question={currentQ}
              equivalent={(currentResp as any)?.equivalent ?? null}
              counterexample={(currentResp as any)?.counterexample || {}}
              onEquivalentChange={(eq) =>
                handleAnswerChange(currentQ.id, {
                  type: 'equivalence',
                  equivalent: eq,
                  counterexample: (currentResp as any)?.counterexample || {},
                })
              }
              onCounterexampleChange={(ce) =>
                handleAnswerChange(currentQ.id, {
                  type: 'equivalence',
                  equivalent: (currentResp as any)?.equivalent ?? false,
                  counterexample: ce,
                })
              }
            />
          )}

          {currentQ.type === 'sat' && (
            <SatControl
              question={currentQ}
              satisfiable={(currentResp as any)?.satisfiable ?? null}
              model={(currentResp as any)?.model || {}}
              onSatisfiableChange={(sat) =>
                handleAnswerChange(currentQ.id, {
                  type: 'sat',
                  satisfiable: sat,
                  model: (currentResp as any)?.model || {},
                })
              }
              onModelChange={(m) =>
                handleAnswerChange(currentQ.id, {
                  type: 'sat',
                  satisfiable: (currentResp as any)?.satisfiable ?? true,
                  model: m,
                })
              }
            />
          )}

          {currentQ.type === 'entailment' && (
            <EntailmentControl
              question={currentQ}
              entailed={(currentResp as any)?.entailed ?? null}
              counterexample={(currentResp as any)?.counterexample || {}}
              onEntailedChange={(ent) =>
                handleAnswerChange(currentQ.id, {
                  type: 'entailment',
                  entailed: ent,
                  counterexample: (currentResp as any)?.counterexample || {},
                })
              }
              onCounterexampleChange={(ce) =>
                handleAnswerChange(currentQ.id, {
                  type: 'entailment',
                  entailed: (currentResp as any)?.entailed ?? false,
                  counterexample: ce,
                })
              }
            />
          )}

          {currentQ.type === 'short_answer' && (
            <ShortAnswerControl
              question={currentQ}
              studentText={(currentResp as any)?.studentText || ''}
              criteriaScores={{}}
              isSubmitted={false}
              onStudentTextChange={(text) =>
                handleAnswerChange(currentQ.id, {
                  type: 'short_answer',
                  studentText: text,
                  criteriaScores: {},
                })
              }
              onCriteriaScoresChange={() => {}}
            />
          )}

          </fieldset>
          {/* Bottom Navigation Controls */}
          <div
            style={{
              marginTop: '2.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="btn-secondary"
            >
              <ChevronLeftIcon size={14} />
              <span>Anterior</span>
            </button>

            {currentIndex < examQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
                className="btn-primary"
              >
                <span>Siguiente</span>
                <ChevronRightIcon size={14} />
              </button>
            ) : (
              <button type="button" onClick={handleManualSubmit} disabled={busy} className="btn-primary">
                <CheckIcon size={15} />
                <span>Finalizar y Entregar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
