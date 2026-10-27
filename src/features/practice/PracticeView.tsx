import { db } from '@/infrastructure/persistence/db';
import { failedQuestionIds } from '@/domain/progress/performance';
import { LoadError } from '@/components/LoadError';
import { UnitContentNotice, UnitUnavailable } from '@/components/UnitContentNotice';
import { getUnitCapabilities, topicTitle } from '@/domain/content/unit-capabilities';
import { questionRegistry } from '@/domain/content/question-registry';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { contentRepo } from '@/infrastructure/content/repository';
import { Question, Answer, UnitManifest, Subject } from '@/domain/content/types';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { QuestionCard } from './QuestionCard';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from '@/components/icons/Icons';

export const PracticeView: React.FC = () => {
  const { subjectId = '', unitId = '' } = useParams<{ subjectId: string; unitId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [unit, setUnit] = useState<UnitManifest | null>(null);
  const [topicTitles, setTopicTitles] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answersMap, setAnswersMap] = useState<Map<string, Answer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [historyError, setHistoryError] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const statusFilter = searchParams.get('status') || '';

  const loadHistory = useCallback(async (items: Question[]) => {
    setRefreshingHistory(true);
    try {
      const attempts = await db.attempts.where('subjectId').equals(subjectId).filter(item => item.unitId === unitId).toArray();
      setFailedIds(failedQuestionIds(items, attempts));
      setHistoryError(false);
    } catch { setHistoryError(true); }
    finally { setRefreshingHistory(false); }
  }, [subjectId, unitId]);

  useEffect(() => {
    if (questions.length) loadHistory(questions);
  }, [questions, statusFilter, loadHistory]);

  // Filters
  const topicFilter = searchParams.get('topic') || '';
  const typeFilter = searchParams.get('type') || '';
  const difficultyFilter = searchParams.get('difficulty') || '';

  // Pagination / current index
  const [currentIndex, setCurrentIndex] = useState(0);

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
        setTopicTitles(Object.fromEntries(lessons.map(l => [l.frontmatter.topic_id, l.frontmatter.title])));
        setSubject(s || null);
        setUnit(u || null);
        setQuestions(qList);
        setAnswersMap(new Map(aList.map((a) => [a.question_id, a])));
      } catch (err) {
        setLoadError(true);
        console.error('Error loading practice data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [subjectId, unitId, loadAttempt]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (statusFilter === 'incorrect' && !failedIds.has(q.id)) return false;
      if (topicFilter && q.topic_id !== topicFilter) return false;
      if (typeFilter && q.type !== typeFilter) return false;
      if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [questions, topicFilter, typeFilter, difficultyFilter, statusFilter, failedIds]);

  // Reset index if out of bounds
  useEffect(() => {
    if (currentIndex >= filteredQuestions.length) {
      setCurrentIndex(0);
    }
  }, [filteredQuestions.length, currentIndex]);

  const handleFilterChange = (key: string, val: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (val) {
      nextParams.set(key, val);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams);
    setCurrentIndex(0);
  };

  if (loading || (statusFilter === 'incorrect' && refreshingHistory)) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Cargando banco de ejercicios...</p>
      </div>
    );
  }

  if (loadError) return <LoadError message="No pudimos cargar la práctica. Tus datos no se han modificado." onRetry={() => setLoadAttempt(n => n + 1)} />;

  if (!subject || !unit) {
    return <UnitUnavailable />;
  }

  const currentQuestion = filteredQuestions[currentIndex];
  if (questions.length === 0) return <UnitContentNotice unit={unit} capabilities={getUnitCapabilities(unit, unit.lessons.length, questions)} section="practice" />;
  const currentAnswer = currentQuestion ? answersMap.get(currentQuestion.id) : undefined;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: subject.title, to: `/` },
          { label: unit.title, to: `/subjects/${subjectId}/units/${unitId}` },
          { label: 'Práctica' },
        ]}
      />

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.85rem', letterSpacing: '-0.025em' }}>
          Práctica interactiva
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '0.2rem' }}>
          {unit.title} · Resuelve, comprueba y aprende.
        </p>
      </div>

      <details className="practice-filters"><summary>Filtrar ejercicios{typeFilter && ` · ${questionRegistry[typeFilter as keyof typeof questionRegistry]?.label || typeFilter}`}</summary>
      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-end',
          padding: '1.15rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 200px' }}>
          <label htmlFor="filter-topic" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Tema del programa:
          </label>
          <select
            id="filter-topic"
            value={topicFilter}
            onChange={(e) => handleFilterChange('topic', e.target.value)}
            style={{ fontSize: '0.9rem', width: '100%' }}
          >
            <option value="">Todos los temas ({questions.length})</option>
            {unit.topic_ids.map((t) => (
              <option key={t} value={t}>
                {topicTitle(t, unit.topic_ids, topicTitles)} ({questions.filter((q) => q.topic_id === t).length})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 220px' }}>
          <label htmlFor="filter-type" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Tipo de ejercicio:
          </label>
          <select
            id="filter-type"
            value={typeFilter}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            style={{ fontSize: '0.9rem', width: '100%' }}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(questionRegistry).map(([type, entry]) => <option key={type} value={type}>{entry.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 150px' }}>
          <label htmlFor="filter-diff" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Dificultad:
          </label>
          <select
            id="filter-diff"
            value={difficultyFilter}
            onChange={(e) => handleFilterChange('difficulty', e.target.value)}
            style={{ fontSize: '0.9rem', width: '100%' }}
          >
            <option value="">Todas</option>
            <option value="basic">Básica (basic)</option>
            <option value="intermediate">Intermedia (intermediate)</option>
            <option value="advanced">Avanzada (advanced)</option>
          </select>
        </div>

        <div className="practice-status-filter">
          <label htmlFor="filter-status">Último intento:</label>
          <select id="filter-status" value={statusFilter} onChange={event => handleFilterChange('status', event.target.value)}>
            <option value="">Todos los ejercicios</option><option value="incorrect">Por corregir ({failedIds.size})</option>
          </select>
        </div>
        {(topicFilter || typeFilter || difficultyFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchParams(new URLSearchParams());
              setCurrentIndex(0);
            }}
            className="btn-outline btn-sm"
            style={{ height: '40px' }}
          >
            <RotateCcwIcon size={14} />
            <span>Limpiar filtros</span>
          </button>
        )}
      </div>

      </details>
      {historyError && <p role="alert" className="callout callout-warning">No pudimos leer tus errores anteriores. <button className="btn-outline" onClick={() => loadHistory(questions)}>Reintentar historial</button></p>}
      {statusFilter === 'incorrect' && <div className="practice-history"><p>Errores de tu último intento objetivo, incluidos los aciertos parciales. La lista se mantiene durante esta sesión para que puedas revisar la explicación.</p><button className="btn-outline btn-sm" disabled={refreshingHistory} onClick={() => { setCurrentIndex(0); loadHistory(questions); }}>Actualizar pendientes</button></div>}
      {/* Questions list / Navigator */}
      {historyError && statusFilter === 'incorrect' ? null : filteredQuestions.length > 0 ? (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Ejercicio <span style={{ color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{currentIndex + 1}</span> de <span style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredQuestions.length}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="btn-secondary btn-sm"
              >
                <ChevronLeftIcon size={14} />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1))}
                disabled={currentIndex === filteredQuestions.length - 1}
                className="btn-secondary btn-sm"
              >
                <span>Siguiente</span>
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </div>

          {currentQuestion && (
            <QuestionCard
              topicTitle={topicTitle(currentQuestion.topic_id, unit.topic_ids, topicTitles)}
              showLessonLink={Boolean(topicTitles[currentQuestion.topic_id])}
              key={currentQuestion.id}
              question={currentQuestion}
              answer={currentAnswer}
            />
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>{statusFilter === 'incorrect' ? 'No hay errores pendientes con estos filtros. Prueba otros temas o sigue practicando.' : 'No se encontraron ejercicios con los filtros seleccionados.'}</p>
          <button
            type="button"
            onClick={() => setSearchParams(new URLSearchParams())}
            className="btn-primary btn-sm"
            style={{ marginTop: '1rem' }}
          >
            Mostrar todos los ejercicios
          </button>
        </div>
      )}
    </div>
  );
};
