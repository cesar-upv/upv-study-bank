import { LoadError } from '@/components/LoadError';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { contentRepo } from '@/infrastructure/content/repository';
import { Lesson, Subject, UnitManifest, Question } from '@/domain/content/types';
import { getUnitCapabilities } from '@/domain/content/unit-capabilities';
import { UnitContentNotice, UnitUnavailable } from '@/components/UnitContentNotice';
import { MarkdownView } from '@/components/MarkdownView';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { db } from '@/infrastructure/persistence/db';
import {
  TargetIcon,
  TimerIcon,
  StarIcon,
  CheckIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookOpenIcon,
} from '@/components/icons/Icons';

export const StudyView: React.FC = () => {
  const { subjectId = '', unitId = '', topicId } = useParams<{
    subjectId: string;
    unitId: string;
    topicId?: string;
  }>();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [unit, setUnit] = useState<UnitManifest | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const previousTopic = useRef(topicId);
  const [searchQuery, setSearchQuery] = useState('');
  const [readLessonIds, setReadLessonIds] = useState<Set<string>>(new Set());
  const [bookmarkedLessonIds, setBookmarkedLessonIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Load lessons and unit info
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError(false);
      try {
        const s = await contentRepo.getSubject(subjectId);
        const u = await contentRepo.getUnit(subjectId, unitId);
        const l = await contentRepo.getLessons(subjectId, unitId);
        const q = await contentRepo.getQuestions(subjectId, unitId);

        setSubject(s || null);
        setUnit(u || null);
        setLessons(l);
        setQuestions(q);

        // Load progress & bookmarks
        const readRecords = await db.lessonProgress
          .where('[subjectId+unitId]')
          .equals([subjectId, unitId])
          .filter((rec) => rec.completed)
          .toArray();
        setReadLessonIds(new Set(readRecords.map((r) => r.lessonId)));
        const selected = topicId ? l.find(item => item.frontmatter.topic_id === topicId) || null : l.find(item => !readRecords.some(r => r.lessonId === item.frontmatter.id)) || l[0] || null;
        setActiveLesson(selected);
        if (!topicId && selected) navigate(`/subjects/${subjectId}/units/${unitId}/study/${selected.frontmatter.topic_id}`, { replace: true });

        const bmRecords = await db.bookmarks
          .where('[subjectId+unitId]')
          .equals([subjectId, unitId])
          .filter((bm) => bm.itemType === 'lesson')
          .toArray();
        setBookmarkedLessonIds(new Set(bmRecords.map((b) => b.itemId)));
      } catch (err) {
        setLoadError(true);
        console.error('Error loading study data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [subjectId, unitId, loadAttempt]);

  // Update active lesson when topicId changes
  useEffect(() => {
    if (topicId && lessons.length > 0) {
      const match = lessons.find((item) => item.frontmatter.topic_id === topicId);
      if (match) setActiveLesson(match);
    }
  }, [topicId, lessons]);

  useEffect(() => {
    if (previousTopic.current !== topicId && activeLesson?.frontmatter.topic_id === topicId) {
      previousTopic.current = topicId;
      articleRef.current?.focus();
      articleRef.current?.scrollIntoView({ block: 'start' });
      setSaveError('');
    }
  }, [topicId, activeLesson]);

  // Toggle read status
  const handleToggleRead = async () => {
    if (!activeLesson || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const lessonId = activeLesson.frontmatter.id;
      const isCurrentlyRead = readLessonIds.has(lessonId);
      const newStatus = !isCurrentlyRead;

      const id = `${subjectId}:${unitId}:${lessonId}`;
      if (newStatus) {
        await db.lessonProgress.put({
          id,
          subjectId,
          unitId,
          lessonId,
          completed: true,
          readAt: new Date().toISOString(),
        });
        setReadLessonIds((prev) => new Set(prev).add(lessonId));
      } else {
        await db.lessonProgress.delete(id);
        setReadLessonIds((prev) => {
          const next = new Set(prev);
          next.delete(lessonId);
          return next;
        });
      }
    } catch {
      setSaveError('No se pudo guardar el cambio. Vuelve a intentarlo con el mismo botón.');
    } finally { setSaving(false); }
  };

  // Toggle bookmark status
  const handleToggleBookmark = async () => {
    if (!activeLesson || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const lessonId = activeLesson.frontmatter.id;
      const isCurrentlyBookmarked = bookmarkedLessonIds.has(lessonId);
      const newStatus = !isCurrentlyBookmarked;

      const id = `${subjectId}:${unitId}:lesson:${lessonId}`;
      if (newStatus) {
        await db.bookmarks.put({
          id,
          subjectId,
          unitId,
          itemType: 'lesson',
          itemId: lessonId,
          createdAt: new Date().toISOString(),
        });
        setBookmarkedLessonIds((prev) => new Set(prev).add(lessonId));
      } else {
        await db.bookmarks.delete(id);
        setBookmarkedLessonIds((prev) => {
          const next = new Set(prev);
          next.delete(lessonId);
          return next;
        });
      }
    } catch {
      setSaveError('No se pudo guardar el cambio. Vuelve a intentarlo con el mismo botón.');
    } finally { setSaving(false); }
  };

  // Filter lessons based on search query
  const filteredLessons = useMemo(() => {
    if (!searchQuery.trim()) return lessons;
    const q = searchQuery.toLowerCase();
    return lessons.filter(
      (l) =>
        l.frontmatter.title.toLowerCase().includes(q) ||
        l.frontmatter.topic_id.toLowerCase().includes(q) ||
        l.content.toLowerCase().includes(q)
    );
  }, [lessons, searchQuery]);

  // Navigation: prev & next topic
  const currentIndex = activeLesson ? lessons.findIndex((l) => l.frontmatter.id === activeLesson.frontmatter.id) : -1;
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Cargando guía de estudio formal...</p>
      </div>
    );
  }

  if (loadError) return <LoadError message="No pudimos cargar la guía y tu progreso. Tus datos no se han modificado." onRetry={() => setLoadAttempt(n => n + 1)} />;

  if (!subject || !unit) {
    return <UnitUnavailable />;
  }

  const capabilities = getUnitCapabilities(unit, lessons.length, questions);
  if (!lessons.length || !activeLesson) return <UnitContentNotice unit={unit} capabilities={capabilities} section="study" missingTopic={lessons.length > 0} />;

  const isCurrentRead = activeLesson ? readLessonIds.has(activeLesson.frontmatter.id) : false;
  const isCurrentBookmarked = activeLesson ? bookmarkedLessonIds.has(activeLesson.frontmatter.id) : false;
  const readCount = lessons.filter(lesson => readLessonIds.has(lesson.frontmatter.id)).length;
  const readPct = Math.round((readCount / lessons.length) * 100);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: subject.title, to: `/` },
          { label: unit.title, to: `/subjects/${subjectId}/units/${unitId}` },
          { label: 'Guía de estudio' },
        ]}
      />

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', letterSpacing: '-0.025em' }}>
            Guía de examen: {unit.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Progreso: <strong style={{ color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{readCount} de {lessons.length} temas</strong> leídos ({readPct}%)
          </p>
        </div>
        <div className="unit-actions">
          {capabilities.hasQuestions && <Link to={`/subjects/${subjectId}/units/${unitId}/practice`} className="btn-secondary btn-sm">
            <TargetIcon size={16} />
            <span>Ir a Práctica</span>
          </Link>}
          {capabilities.canExam && <Link to={`/subjects/${subjectId}/units/${unitId}/exam`} className="btn-primary btn-sm">
            <TimerIcon size={16} />
            <span>Simulacro</span>
          </Link>}
        </div>
      </div>

      <div className="study-display-controls">
        <button type="button" className="btn-secondary topics-toggle" aria-expanded={topicsOpen} aria-controls="study-topics" onClick={() => setTopicsOpen(!topicsOpen)}>Temario · {activeLesson?.frontmatter.title || 'Ver temas'}</button>
        <button type="button" className="btn-outline" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Mostrar temario lateral' : 'Ampliar lectura'}</button>
      </div>
      <div className={`study-layout${expanded ? ' study-expanded' : ''}`}>
        {/* Sidebar Navigation */}
        <aside id="study-topics" className={`sidebar-nav${topicsOpen ? " topics-open" : ""}`} aria-label="Temario de la guía">
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                id="search-topics"
                type="search"
                placeholder="Buscar concepto o tema..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', fontSize: '0.875rem', paddingLeft: '2rem' }}
                aria-label="Buscar en la guía"
              />
              <SearchIcon
                size={14}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
              Temas ({filteredLessons.length})
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {readCount}/{lessons.length} leídos
            </span>
          </div>

          <ul role="list">
            {filteredLessons.length === 0 && <li role="status">No encontramos temas. Prueba otra búsqueda.</li>}
            {filteredLessons.map((lesson) => {
              const isActive = activeLesson?.frontmatter.id === lesson.frontmatter.id;
              const isRead = readLessonIds.has(lesson.frontmatter.id);
              const isBm = bookmarkedLessonIds.has(lesson.frontmatter.id);

              return (
                <li key={lesson.frontmatter.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeLesson?.frontmatter.id === lesson.frontmatter.id) {
                        setTopicsOpen(false);
                        articleRef.current?.focus();
                        articleRef.current?.scrollIntoView({ block: 'start' });
                        return;
                      }
                      setActiveLesson(lesson);
                      navigate(`/subjects/${subjectId}/units/${unitId}/study/${lesson.frontmatter.topic_id}`);
                      setTopicsOpen(false);
                    }}
                    className="topic-link"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', minWidth: 0 }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0,
                          backgroundColor: isRead ? 'var(--success-bg)' : 'var(--bg-surface-elevated)',
                          color: isRead ? 'var(--success-text)' : 'var(--text-muted)',
                          border: `1px solid ${isRead ? 'var(--success-border)' : 'var(--border-color)'}`,
                        }}
                        title={isRead ? 'Leído' : 'Pendiente'}
                      >
                        {isRead ? <CheckIcon size={12} /> : lesson.frontmatter.order}
                      </span>
                      <span className="topic-title">
                        {lesson.frontmatter.title}
                      </span>
                    </span>
                    {isBm && (
                      <StarIcon size={14} filled={true} style={{ color: 'var(--warning-border)', flexShrink: 0 }} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main Content Area */}
        <section aria-label={activeLesson?.frontmatter.title || "Lección"} style={{ minWidth: 0 }}>
          {activeLesson ? (
            <article className="card study-article">
              {/* Active lesson header toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-info">
                    Tema {activeLesson.frontmatter.order} de {lessons.length}
                  </span>
                  <span className="badge badge-neutral">
                    Alcance: {activeLesson.frontmatter.exam_scope === 'required' ? 'Examen obligatorio' : 'Opcional'}
                  </span>
                </div>

                <div className="unit-actions">
                  <button
                    type="button"
                    onClick={handleToggleBookmark}
                    disabled={saving}
                    aria-pressed={isCurrentBookmarked}
                    className="btn-outline btn-sm"
                    title={isCurrentBookmarked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    aria-label={isCurrentBookmarked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  >
                    <StarIcon size={15} filled={isCurrentBookmarked} style={{ color: isCurrentBookmarked ? 'var(--warning-border)' : 'inherit' }} />
                    <span>{isCurrentBookmarked ? 'Favorito' : 'Añadir favorito'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleRead}
                    disabled={saving}
                    className={isCurrentRead ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                    aria-pressed={isCurrentRead}
                  >
                    {isCurrentRead ? (
                      <>
                        <CheckIcon size={15} style={{ color: 'var(--success-text)' }} />
                        <span>Leído</span>
                      </>
                    ) : (
                      <><CheckIcon size={15} /><span>Marcar como leído</span></>
                    )}
                  </button>
                </div>
              </div>

              {saveError && <p role="alert" className="callout callout-error">{saveError}</p>}
              {/* Lesson Markdown & KaTeX formulas */}
              <div id="active-lesson-heading" ref={articleRef} tabIndex={-1}>
                <MarkdownView showToc content={activeLesson.content} className="markdown-body study-markdown" />
              </div>

              {/* Lesson Footer Navigation */}
              <div
                style={{
                  marginTop: '3rem',
                  paddingTop: '1.75rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  {prevLesson ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveLesson(prevLesson);
                        navigate(`/subjects/${subjectId}/units/${unitId}/study/${prevLesson.frontmatter.topic_id}`);
                      }}
                      className="btn-secondary btn-sm"
                    >
                      <ChevronLeftIcon size={14} />
                      <span>Anterior: {prevLesson.frontmatter.title}</span>
                    </button>
                  ) : (
                    <span />
                  )}
                </div>

                {questions.some(question => question.topic_id === activeLesson.frontmatter.topic_id) && <Link
                  to={`/subjects/${subjectId}/units/${unitId}/practice?topic=${activeLesson.frontmatter.topic_id}`}
                  className="btn-outline btn-sm"
                >
                  <TargetIcon size={16} />
                  <span>Practicar este tema</span>
                </Link>}

                <div>
                  {nextLesson ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveLesson(nextLesson);
                        navigate(`/subjects/${subjectId}/units/${unitId}/study/${nextLesson.frontmatter.topic_id}`);
                      }}
                      className="btn-primary btn-sm"
                    >
                      <span>Siguiente: {nextLesson.frontmatter.title}</span>
                      <ChevronRightIcon size={14} />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              </div>
            </article>
          ) : (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <BookOpenIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Esta unidad todavía no tiene lecciones.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
