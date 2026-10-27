import { TopicPerformance } from './TopicPerformance';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contentRepo } from '@/infrastructure/content/repository';
import type { UnitPackage, Lesson } from '@/domain/content/types';
import { getUnitCapabilities, unitBasePath, unitKindLabels } from '@/domain/content/unit-capabilities';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LoadError } from '@/components/LoadError';
import { UnitUnavailable } from '@/components/UnitContentNotice';
import { db } from '@/infrastructure/persistence/db';
import { CheckIcon, ChevronRightIcon, DownloadIcon } from '@/components/icons/Icons';
import { questionRegistry } from '@/domain/content/question-registry';

export function UnitView() {
  const { subjectId = '', unitId = '' } = useParams();
  const [pkg, setPkg] = useState<UnitPackage>();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [progressError, setProgressError] = useState(false);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState('');
  const [exportError, setExportError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const [data, contents] = await Promise.all([contentRepo.getUnitPackage(subjectId, unitId), contentRepo.getLessons(subjectId, unitId)]);
        if (active) { setPkg(data); setLessons(contents); }
        try {
          const progress = await db.lessonProgress.where('[subjectId+unitId]').equals([subjectId, unitId]).filter(r => r.completed).toArray();
          if (active) { setRead(progress.map(r => r.lessonId)); setProgressError(false); }
        } catch { if (active) setProgressError(true); }
      } catch { if (active) setLoadError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [subjectId, unitId, reload]);
  if (loading) return <p role="status">Cargando unidad…</p>;
  if (loadError) return <LoadError message="No pudimos cargar la unidad. Vuelve a intentarlo para abrir el material." onRetry={() => setReload(value => value + 1)} />;
  if (!pkg) return <UnitUnavailable />;
  const base = unitBasePath(pkg.unit);
  const capabilities = getUnitCapabilities(pkg.unit, lessons.length, pkg.questions);
  const readCount = lessons.filter(lesson => read.includes(lesson.frontmatter.id)).length;
  const primaryPath = capabilities.hasLessons ? `${base}/study` : capabilities.canExam ? `${base}/exam` : `${base}/practice`;
  const exportPackage = () => {
    setExportError(false);
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }));
      try {
        const a = document.createElement('a'); a.href = url; a.download = `${subjectId}-${unitId}.unit-package.json`; a.click();
      } finally { URL.revokeObjectURL(url); }
      setMessage('Paquete exportado. Incluye el material de estudio, sin tu historial personal.');
    } catch { setExportError(true); }
  };
  return <div>
    <Breadcrumbs items={[{ label: 'Biblioteca', to: '/' }, { label: pkg.subject.title }]} />
    <header className="page-heading"><div><h1>{pkg.unit.title}</h1><p>{pkg.subject.title} · {unitKindLabels[capabilities.kind]}</p></div><button className="btn-outline" onClick={exportPackage}><DownloadIcon size={17} />Compartir material</button></header>
    {message && <p role="status" className="callout callout-info">{message}</p>}{exportError && <p role="alert" className="callout callout-error">No pudimos exportar el material. Vuelve a intentarlo con Compartir material.</p>}
    {!capabilities.hasLessons && !capabilities.hasQuestions ? <section className="empty-state"><h2>Esta unidad todavía no tiene contenido</h2><p>El paquete no incluye lecciones ni ejercicios. Puedes añadir una versión con material desde Gestionar materias.</p><Link className="btn-primary" to="/content">Gestionar materias</Link></section>
      : <div className={`unit-overview${capabilities.hasLessons ? '' : ' unit-overview-standalone'}`}>
        <section className="study-actions" aria-label="Acciones de la unidad"><h2>{capabilities.isExamOnly ? 'Prepara tu próximo intento' : capabilities.hasLessons ? 'Empieza por donde lo necesitas' : 'Resuelve y comprueba'}</h2>
          <p>{capabilities.isExamOnly ? 'Responde el examen y consulta las soluciones explicadas al entregar. También puedes practicar cada pregunta por separado.' : capabilities.hasQuestions ? `${pkg.questions.length} ejercicios con sus respuestas para comprobar lo que sabes.` : 'Esta unidad contiene material de lectura. Abre la guía para avanzar por sus lecciones.'}</p>
          {capabilities.isExamOnly && <dl className="unit-exam-facts"><div><dt>Preguntas por intento</dt><dd>{capabilities.examQuestionCount}</dd></div><div><dt>Tiempo propuesto</dt><dd>{pkg.unit.exam?.duration_minutes ?? 45} min</dd></div></dl>}
          <div className="unit-actions"><Link to={primaryPath} className="btn-primary">{capabilities.hasLessons ? (readCount > 0 && readCount < lessons.length ? 'Continuar estudiando' : 'Abrir guía') : capabilities.canExam ? 'Preparar simulacro' : 'Practicar ejercicios'}</Link>
            {capabilities.hasQuestions && (capabilities.hasLessons || capabilities.canExam) && <Link to={`${base}/practice`} className="btn-secondary">Practicar ejercicios</Link>}
            {capabilities.hasLessons && capabilities.canExam && <Link to={`${base}/exam`} className="btn-secondary">Preparar simulacro</Link>}
            {capabilities.hasQuestions && <Link to={`${base}/review`} className="text-link">Repasar mis pendientes<ChevronRightIcon size={16} /></Link>}
          </div>
          {capabilities.hasQuestions && !capabilities.canExam && <p className="unit-availability-note">Los ejercicios disponibles no cubren la selección de un simulacro. Puedes resolverlos en Práctica.</p>}
          {capabilities.hasQuestions && <details className="question-types"><summary>Tipos de pregunta ({new Set(pkg.questions.map(q => q.type)).size})</summary>{[...new Set(pkg.questions.map(q => q.type))].map(type => <div key={type}><span>{questionRegistry[type].label}</span><span>{pkg.questions.filter(q => q.type === type).length}</span></div>)}</details>}
        </section>
        {capabilities.hasLessons && <section className="unit-syllabus"><div className="section-heading"><h2>Ruta de estudio</h2><span>{progressError ? 'Progreso no disponible' : `${readCount} de ${lessons.length} leídas`}</span></div>
          {progressError && <div className="callout callout-warning" role="alert"><p>No pudimos leer el progreso. Tus lecciones siguen disponibles.</p><button className="btn-secondary" onClick={() => setReload(value => value + 1)}>Reintentar progreso</button></div>}
          <ol className="lesson-list">{lessons.map((lesson, index) => {
            const isRead = !progressError && read.includes(lesson.frontmatter.id);
            const count = pkg.questions.filter(q => q.topic_id === lesson.frontmatter.topic_id).length;
            return <li key={lesson.frontmatter.id}><span className={`lesson-number ${isRead ? 'is-read' : ''}`}>{isRead ? <CheckIcon size={18} /> : String(index + 1).padStart(2, '0')}</span><div><Link className="lesson-title" to={`${base}/study/${lesson.frontmatter.topic_id}`}>{lesson.frontmatter.title}</Link>{(count > 0 || isRead) && <span className="lesson-meta">{count > 0 && `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'}`}{isRead && `${count > 0 ? ' · ' : ''}Leída`}</span>}</div><Link className="lesson-open" aria-label={`Leer ${lesson.frontmatter.title}`} to={`${base}/study/${lesson.frontmatter.topic_id}`}><ChevronRightIcon size={20} /></Link></li>;
          })}</ol>
        </section>}
      </div>}
    {capabilities.hasQuestions && <TopicPerformance pkg={pkg} lessons={lessons} />}
  </div>;
}
