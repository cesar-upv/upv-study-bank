import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, type StoredAttempt } from '@/infrastructure/persistence/db';
import type { Lesson, UnitPackage } from '@/domain/content/types';
import { topicPerformance } from '@/domain/progress/performance';
import { topicTitle } from '@/domain/content/unit-capabilities';

export function TopicPerformance({ pkg, lessons }: { pkg: UnitPackage; lessons: Lesson[] }) {
  const [attempts, setAttempts] = useState<StoredAttempt[]>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    db.attempts.where('subjectId').equals(pkg.subject.id).filter(attempt => attempt.unitId === pkg.unit.id).toArray()
      .then(records => { if (active) setAttempts(records); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [pkg.subject.id, pkg.unit.id, retry]);
  const titles = Object.fromEntries(lessons.map(lesson => [lesson.frontmatter.topic_id, lesson.frontmatter.title]));
  const title = (id: string) => topicTitle(id, pkg.unit.topic_ids, titles);
  const base = `/subjects/${pkg.subject.id}/units/${pkg.unit.id}`;
  const topics = topicPerformance(pkg.questions, attempts || [], pkg.unit.topic_ids);
  const weak = topics.filter(topic => topic.failed > 0).sort((a, b) => (a.average ?? 1) - (b.average ?? 1))[0];
  const hasProgress = topics.some(topic => topic.attempted > 0 || topic.selfAssessed > 0);
  return <section className="topic-performance" aria-labelledby="performance-title">
    <div className="section-heading"><h2 id="performance-title">Tu rendimiento por tema</h2><span>Datos locales</span></div>
    <p>Último intento de cada ejercicio actual, de práctica o simulacro. El porcentaje refleja puntuación; la cobertura indica cuánto has practicado. Las autoevaluaciones se cuentan por separado.</p>
    {error ? <div role="alert"><p>No pudimos leer tu historial.</p><button className="btn-secondary" onClick={() => setRetry(value => value + 1)}>Reintentar historial</button></div>
      : !attempts ? <p role="status">Cargando historial…</p> : !hasProgress ? <div className="performance-empty"><p>Aún no hay intentos de esta unidad. Completa un simulacro o practica para ver tu rendimiento por tema.</p><Link className="text-link" to={`${base}/practice`}>Empezar a practicar</Link></div> : <>
        {weak && <p className="callout callout-info">Puedes reforzar {title(weak.topicId)}. <Link to={`${base}/practice?topic=${weak.topicId}&status=incorrect`}>Practicar sus errores ({weak.failed})</Link></p>}
        <ul className="performance-list">{topics.map(topic => <li key={topic.topicId}>
          <div><Link to={`${base}/practice?topic=${topic.topicId}`}>{title(topic.topicId)}</Link><small>{topic.attempted} de {topic.total} ejercicios objetivos · {topic.unassistedCorrect} correctos sin ayuda{topic.selfAssessed ? ` · ${topic.selfAssessed} autoevaluados` : ''}</small></div>
          <div className="performance-measure">{topic.average === null ? <span>Sin intentos objetivos</span> : <><strong>{Math.round(topic.average * 100)}%</strong><progress max={100} value={Math.round(topic.average * 100)} aria-label={`Puntuación de ${title(topic.topicId)}`} /></>}</div>
        </li>)}</ul>
      </>}
  </section>;
}
