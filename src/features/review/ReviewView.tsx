import { LoadError } from '@/components/LoadError';
import { UnitContentNotice, UnitUnavailable } from '@/components/UnitContentNotice';
import { getUnitCapabilities, topicTitle } from '@/domain/content/unit-capabilities';
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, StoredReviewItem, StoredAttempt } from '@/infrastructure/persistence/db';
import { contentRepo } from '@/infrastructure/content/repository';
import { Question, Answer, Subject, UnitManifest } from '@/domain/content/types';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { QuestionCard } from '@/features/practice/QuestionCard';
import {
  RotateCcwIcon,
  CheckCircle2Icon,
  BookOpenIcon,
  LightbulbIcon,
} from '@/components/icons/Icons';

export const ReviewView: React.FC = () => {
  const { subjectId = '', unitId = '' } = useParams<{ subjectId: string; unitId: string }>();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [unit, setUnit] = useState<UnitManifest | null>(null);
  const [reviewItems, setReviewItems] = useState<StoredReviewItem[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<StoredAttempt[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Map<string, Question>>(new Map());
  const [topicTitles, setTopicTitles] = useState<Record<string, string>>({});
  const [answersMap, setAnswersMap] = useState<Map<string, Answer>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Active question to solve in review
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const loadData = async () => {
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
      setQuestionsMap(new Map(qList.map((q) => [q.id, q])));
      setAnswersMap(new Map(aList.map((a) => [a.question_id, a])));

      const rItems = await db.reviewItems
        .where('[subjectId+unitId]')
        .equals([subjectId, unitId])
        .toArray();
      setReviewItems(rItems);

      const attempts = await db.attempts
        .where('[subjectId+unitId]')
        .equals([subjectId, unitId])
        .reverse()
        .sortBy('submittedAt');
      setRecentAttempts(attempts.slice(0, 30));
      setAttemptCount(attempts.length);
    } catch (e) {
      setLoadError(true);
      console.error('Error loading review data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId, unitId]);

  if (loading) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Cargando datos de repaso y control de errores...</p>
      </div>
    );
  }

  if (loadError) return <LoadError message="No pudimos cargar tu repaso. Vuelve a intentarlo." onRetry={loadData} />;

  if (!subject || !unit) {
    return <UnitUnavailable />;
  }

  if (questionsMap.size === 0) return <UnitContentNotice unit={unit} capabilities={getUnitCapabilities(unit, unit.lessons.length, [])} section="review" />;

  const nowISO = new Date().toISOString();
  const dueItems = reviewItems.filter((item) => item.dueDate <= nowISO);
  const upcomingItems = reviewItems.filter((item) => item.dueDate > nowISO);

  const activeQuestion = activeQuestionId ? questionsMap.get(activeQuestionId) : undefined;
  const activeAnswer = activeQuestionId ? answersMap.get(activeQuestionId) : undefined;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: subject.title, to: `/` },
          { label: unit.title, to: `/subjects/${subjectId}/units/${unitId}` },
          { label: 'Repaso y Errores' },
        ]}
      />

      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span className="badge badge-info">{unit.id}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{subject.title}</span>
        </div>
        <h1 style={{ fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '0.35rem' }}>
          Repaso Espaciado y Control de Errores
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
          Próximo repaso: error (hoy) · acierto asistido (1 día) · 1.º acierto sin ayuda (3 días) · 2.º consecutivo (7 días) · siguientes (14 días).
        </p>
      </div>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <span className="stat-label">Pendientes hoy</span>
          <div className="stat-value" style={{ color: dueItems.length > 0 ? 'var(--error-text)' : 'var(--success-text)' }}>
            {dueItems.length}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Requieren repaso inmediato</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">En seguimiento</span>
          <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
            {reviewItems.length}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ejercicios con historial de repaso</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Próximos días</span>
          <div className="stat-value">
            {upcomingItems.length}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Programados para fechas futuras</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Intentos totales</span>
          <div className="stat-value">
            {attemptCount}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registrados en historial local</span>
        </div>
      </div>

      {/* Active Question Solver */}
      {activeQuestion && activeAnswer && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Resolviendo ejercicio de repaso:</h2>
            <button type="button" onClick={() => setActiveQuestionId(null)} className="btn-outline btn-sm">
              Cerrar ejercicio
            </button>
          </div>
          <QuestionCard
            topicTitle={topicTitle(activeQuestion.topic_id, unit.topic_ids, topicTitles)}
            showLessonLink={Boolean(topicTitles[activeQuestion.topic_id])}
            key={activeQuestion.id}
            question={activeQuestion}
            answer={activeAnswer}
            onAttemptSaved={() => {
              loadData();
            }}
          />
        </div>
      )}

      {/* Pending Items List */}
      <section aria-labelledby="due-heading" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="due-heading" style={{ fontSize: '1.35rem' }}>
            Ejercicios pendientes de repaso ({dueItems.length})
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Prioridad inmediata</span>
        </div>

        {dueItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {dueItems.map((item) => {
              const q = questionsMap.get(item.questionId);
              if (!q) return null;

              return (
                <div
                  key={item.id}
                  className="card card-interactive"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    padding: '1.15rem 1.35rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span className="badge badge-error">Vencido</span>
                      <span className="badge badge-info">{topicTitle(q.topic_id, unit.topic_ids, topicTitles)}</span>
                      <span className="badge badge-neutral">{q.type}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{q.id}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Racha no asistida: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{item.consecutiveUnassisted}</strong> · Vence: {new Date(item.dueDate).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQuestionId(item.questionId);
                        window.scrollTo({ top: 150, behavior: 'smooth' });
                      }}
                      className="btn-primary btn-sm"
                    >
                      <RotateCcwIcon size={14} />
                      <span>Resolver ahora</span>
                    </button>
                    {topicTitles[q.topic_id] && <Link
                      to={`/subjects/${subjectId}/units/${unitId}/study/${q.topic_id}`}
                      className="btn-outline btn-sm"
                    >
                      <BookOpenIcon size={14} />
                      <span>Ver tema</span>
                    </Link>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <CheckCircle2Icon size={32} style={{ color: 'var(--success-border)', marginBottom: '0.5rem' }} />
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              ¡No tienes ejercicios pendientes de repaso por hoy!
            </p>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              El plan de estudio está al día.
            </span>
          </div>
        )}
      </section>

      {/* Recent Attempts History */}
      <section aria-labelledby="history-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="history-heading" style={{ fontSize: '1.35rem' }}>
            Historial de intentos recientes ({recentAttempts.length})
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Últimos registros</span>
        </div>

        {recentAttempts.length > 0 ? (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pregunta</th>
                  <th>Tipo</th>
                  <th>Asistido</th>
                  <th>Resultado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.map((att) => {
                  const isPass = att.score === 1;
                  return (
                    <tr key={att.id}>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(att.submittedAt).toLocaleTimeString()} · {new Date(att.submittedAt).toLocaleDateString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{att.questionId}</td>
                      <td>
                        <span className="badge badge-info">{att.type}</span>
                      </td>
                      <td>
                        {att.assisted ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--warning-text)', fontSize: '0.85rem' }}>
                            <LightbulbIcon size={14} />
                            <span>Con pista</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin ayuda</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isPass ? 'badge-success' : 'badge-error'}`}>
                          {isPass ? '100%' : `${Math.round(att.score * 100)}%`}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuestionId(att.questionId);
                            window.scrollTo({ top: 150, behavior: 'smooth' });
                          }}
                          className="btn-outline btn-sm"
                        >
                          <RotateCcwIcon size={13} />
                          <span>Reintentar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay intentos registrados aún. Completa ejercicios en la sección de Práctica.
          </div>
        )}
      </section>
    </div>
  );
};
