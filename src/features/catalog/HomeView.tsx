import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { contentRepo } from '@/infrastructure/content/repository';
import type { UnitPackage } from '@/domain/content/types';
import { getUnitCapabilities, unitBasePath, unitKindLabels, unitPreferenceKey, type UnitCapabilities } from '@/domain/content/unit-capabilities';
import { parseLessonMarkdown } from '@/domain/content/parser';
import { db } from '@/infrastructure/persistence/db';
import { BookOpenIcon, EyeOffIcon, GridIcon, ListIcon, PackageIcon, TimerIcon } from '@/components/icons/Icons';
import { LoadError } from '@/components/LoadError';
import { useLibraryPreferences } from './use-library-preferences';

type LibraryUnit = { pkg: UnitPackage; key: string; capabilities: UnitCapabilities; searchText: string; read: number | null; pending: number | null };
type Visibility = 'visible' | 'hidden' | 'all';
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

export function HomeView() {
  const [units, setUnits] = useState<LibraryUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('visible');
  const [lastAction, setLastAction] = useState<{ key: string; title: string; hidden: boolean } | null>(null);
  const [feedbackPaused, setFeedbackPaused] = useState(false);
  const visibleFilterRef = useRef<HTMLButtonElement>(null);
  const library = useLibraryPreferences();
  useEffect(() => {
    if (!lastAction || feedbackPaused) return;
    const timeout = window.setTimeout(() => setLastAction(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [lastAction, feedbackPaused]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const packages = await contentRepo.getAllPackages();
        const [progress, review] = await Promise.allSettled([db.lessonProgress.toArray(), db.reviewItems.toArray()]);
        const now = new Date().toISOString();
        const completedByUnit = new Map<string, Set<string>>();
        const pendingByUnit = new Map<string, string[]>();
        if (progress.status === 'fulfilled') for (const item of progress.value) {
          if (!item.completed) continue;
          const key = unitPreferenceKey(item.subjectId, item.unitId);
          if (!completedByUnit.has(key)) completedByUnit.set(key, new Set());
          completedByUnit.get(key)!.add(item.lessonId);
        }
        if (review.status === 'fulfilled') for (const item of review.value) {
          if (item.dueDate > now) continue;
          const key = unitPreferenceKey(item.subjectId, item.unitId);
          if (!pendingByUnit.has(key)) pendingByUnit.set(key, []);
          pendingByUnit.get(key)!.push(item.questionId);
        }
        const rows = packages.map(pkg => {
          const key = unitPreferenceKey(pkg.subject.id, pkg.unit.id);
          const lessonIds = new Set(pkg.lessons.map(lesson => parseLessonMarkdown(lesson.path, lesson.markdown).frontmatter.id));
          const questionIds = new Set(pkg.questions.map(question => question.id));
          const capabilities = getUnitCapabilities(pkg.unit, pkg.lessons.length, pkg.questions);
          return {
            pkg, key, capabilities,
            searchText: normalizeSearch(`${pkg.subject.title} ${pkg.unit.title} ${unitKindLabels[capabilities.kind]}`),
            read: progress.status === 'fulfilled' ? [...completedByUnit.get(key) ?? []].filter(id => lessonIds.has(id)).length : null,
            pending: review.status === 'fulfilled' ? (pendingByUnit.get(key) ?? []).filter(id => questionIds.has(id)).length : null,
          };
        });
        if (active) {
          setUnits(rows);
          setHistoryError(progress.status === 'rejected' || review.status === 'rejected');
        }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reload]);
  const hiddenKeys = useMemo(() => new Set(library.preferences.hidden), [library.preferences.hidden]);
  const hiddenCount = units.filter(({ key }) => hiddenKeys.has(key)).length;
  const visibleCount = units.length - hiddenCount;
  const terms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const filtered = units.filter(({ key, capabilities, searchText }) => {
    const hidden = hiddenKeys.has(key);
    return (visibility === 'all' || (visibility === 'hidden' ? hidden : !hidden))
      && (!kind || capabilities.kind === kind)
      && terms.every(term => searchText.includes(term));
  });
  const groups = new Map<string, { title: string; units: LibraryUnit[] }>();
  for (const row of filtered) {
    const id = row.pkg.subject.id;
    if (!groups.has(id)) groups.set(id, { title: row.pkg.subject.title, units: [] });
    groups.get(id)!.units.push(row);
  }
  const toggleHidden = (pkg: UnitPackage, hidden: boolean) => {
    const key = unitPreferenceKey(pkg.subject.id, pkg.unit.id);
    library.setHidden(key, hidden);
    setFeedbackPaused(false);
    setLastAction({ key, title: pkg.unit.title, hidden });
    visibleFilterRef.current?.focus();
  };
  const clearFilters = () => { setSearch(''); setKind(''); };
  const hasFilters = terms.length > 0 || Boolean(kind);

  return <div className="library-page">
    <header className="page-heading library-heading"><div><h1>Tu biblioteca</h1><p>Tu material de estudio, a mano.</p></div><Link className="btn-primary" to="/content"><PackageIcon size={17} />Añadir materia</Link></header>
    <div className="library-toolbar">
      <label className="search-label" htmlFor="library-search">Buscar en tu biblioteca<input id="library-search" type="search" placeholder="Materia o unidad…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="search-label library-kind"><label htmlFor="library-kind">Contenido</label><select id="library-kind" value={kind} onChange={e => setKind(e.target.value)}><option value="">Todo el material</option>{Object.entries(unitKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="library-view-control" role="group" aria-label="Vista de biblioteca"><button type="button" aria-label="Lista compacta" title="Lista compacta" aria-pressed={library.preferences.layout === 'list'} onClick={() => library.setLayout('list')}><ListIcon size={17} /><span>Lista compacta</span></button><button type="button" aria-label="Cuadrícula" title="Cuadrícula" aria-pressed={library.preferences.layout === 'grid'} onClick={() => library.setLayout('grid')}><GridIcon size={17} /><span>Cuadrícula</span></button></div>
    </div>
    <div className="library-filterbar"><div className="library-visibility" role="group" aria-label="Visibilidad de unidades">
      <button ref={visibleFilterRef} type="button" aria-pressed={visibility === 'visible'} onClick={() => setVisibility('visible')}>Visibles <span>{visibleCount}</span></button>
      <button type="button" aria-pressed={visibility === 'hidden'} onClick={() => setVisibility('hidden')}>Ocultas <span>{hiddenCount}</span></button>
      <button type="button" aria-pressed={visibility === 'all'} onClick={() => setVisibility('all')}>Todas <span>{units.length}</span></button>
    </div>{!loading && !error && hasFilters && <span className="library-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'unidad' : 'unidades'} con estos filtros</span>}</div>
    {library.storageError && <div className="callout callout-warning" role="alert"><p>No pudimos recuperar o guardar tus preferencias de biblioteca. Los cambios de esta visita siguen disponibles; vuelve a guardarlos para conservarlos al cerrar.</p><button type="button" className="btn-secondary" onClick={library.retrySave}>Volver a guardar preferencias</button></div>}
    {lastAction && <div className="library-feedback" role="status" onMouseEnter={() => setFeedbackPaused(true)} onMouseLeave={event => setFeedbackPaused(event.currentTarget.contains(document.activeElement))} onFocus={() => setFeedbackPaused(true)} onBlur={event => setFeedbackPaused(event.currentTarget.contains(event.relatedTarget) || event.currentTarget.matches(':hover'))}><span><strong>{lastAction.title}</strong>{lastAction.hidden ? ' se ocultó de la biblioteca.' : ' vuelve a estar visible.'}</span><button type="button" className="btn-outline" onClick={() => { library.setHidden(lastAction.key, !lastAction.hidden); setLastAction(null); visibleFilterRef.current?.focus(); }}>Deshacer</button></div>}
    {visibility === 'hidden' && hiddenCount > 0 && <div className="library-hidden-help"><p>Ocultar conserva el material, los enlaces y tu progreso.</p><button type="button" className="btn-outline" onClick={() => { library.restoreAll(); setVisibility('visible'); setLastAction(null); visibleFilterRef.current?.focus(); }}>Restaurar todas</button></div>}
    {loading ? <p role="status" className="empty-state">Abriendo tu biblioteca…</p>
      : error ? <LoadError message="No pudimos abrir tu biblioteca. Vuelve a intentarlo para cargar el material." onRetry={() => setReload(value => value + 1)} />
      : <>
        {historyError && <div className="callout callout-warning" role="alert"><p>Tu material está disponible, pero no pudimos leer parte de tu progreso.</p><button className="btn-secondary" onClick={() => setReload(value => value + 1)}>Reintentar progreso</button></div>}
        {filtered.length === 0 && <section className="empty-state">
          <h2>{units.length === 0 ? 'Tu próxima materia empieza aquí' : hasFilters ? 'No hay coincidencias con estos filtros' : visibility === 'hidden' ? 'No tienes unidades ocultas' : visibleCount === 0 ? 'Tu material está en Ocultas' : 'No hay unidades en esta vista'}</h2>
          <p>{units.length === 0 ? 'Añade un paquete de contenido para empezar a estudiar.' : hasFilters ? 'Prueba otro nombre, tipo de contenido o revisa las unidades ocultas.' : visibility === 'hidden' ? 'Puedes ocultar las unidades que no necesitas ahora y recuperarlas aquí.' : 'Restaura las unidades que quieras tener a mano. Su contenido y progreso se conservan.'}</p>
          <div className="unit-actions">{hasFilters && <button type="button" className="btn-secondary" onClick={clearFilters}>Limpiar filtros</button>}{hiddenCount > 0 && visibility !== 'hidden' && <button type="button" className="btn-secondary" onClick={() => { clearFilters(); setVisibility('hidden'); }}>Ver unidades ocultas</button>}{visibility === 'hidden' && <button type="button" className="btn-secondary" onClick={() => { clearFilters(); setVisibility('visible'); }}>Ver unidades visibles</button>}{units.length === 0 && <Link to="/content" className="btn-primary">Añadir materia</Link>}</div>
        </section>}
        {[...groups.entries()].map(([subjectId, group]) => <section className="library-subject" key={subjectId} aria-label={group.title}>
          <header className="library-subject-heading"><h2>{group.title}</h2></header>
          <div className={`library-collection library-${library.preferences.layout}`}>{group.units.map(({ pkg, key, capabilities, read, pending }) => {
            const base = unitBasePath(pkg.unit);
            const hidden = hiddenKeys.has(key);
            const lessonCount = pkg.lessons.length;
            const primaryPath = capabilities.hasLessons ? `${base}/study` : capabilities.canExam ? `${base}/exam` : capabilities.hasQuestions ? `${base}/practice` : base;
            const primaryLabel = capabilities.hasLessons ? (read && read < lessonCount ? 'Continuar estudiando' : read === lessonCount ? 'Volver a la guía' : 'Abrir guía') : capabilities.canExam ? 'Hacer simulacro' : capabilities.hasQuestions ? 'Practicar' : 'Ver unidad';
            return <article className={`library-entry${hidden ? ' is-hidden' : ''}`} key={pkg.unit.id} aria-label={pkg.unit.title}>
              <div className="library-entry-body"><div className="library-entry-heading"><h3><Link className="unit-title" to={base}>{pkg.unit.title}</Link></h3></div>
                <div className="unit-meta"><span className="unit-kind library-meta-kind">{unitKindLabels[capabilities.kind]}{hidden && ' · Oculta'}</span>{capabilities.hasLessons && <span className="library-meta-detail">{lessonCount} {lessonCount === 1 ? 'lección' : 'lecciones'}</span>}{capabilities.isExamOnly && <span className="library-meta-detail">{pkg.unit.exam?.duration_minutes ?? 45} min por intento</span>}{capabilities.hasQuestions && <span className="library-meta-questions">{pkg.questions.length} {pkg.questions.length === 1 ? 'ejercicio' : 'ejercicios'}</span>}{!capabilities.hasLessons && !capabilities.hasQuestions && <span className="library-meta-empty">El paquete no incluye lecciones ni ejercicios.</span>}</div>
                {capabilities.hasLessons && (read === null ? <p className="library-progress-unavailable">Progreso no disponible</p> : <div className="reading-track"><progress value={read} max={lessonCount} aria-label={`Lectura de ${pkg.unit.title}`} /><span>{read} de {lessonCount} {lessonCount === 1 ? 'lección leída' : 'lecciones leídas'}</span></div>)}
              </div>
              <div className="library-actions" role="group" aria-label={`Acciones de ${pkg.unit.title}`}>
                <Link className="library-action-primary btn-primary" to={primaryPath}>{capabilities.hasLessons ? <BookOpenIcon size={16} /> : capabilities.canExam ? <TimerIcon size={16} /> : null}{primaryLabel}</Link>
                {capabilities.hasQuestions && primaryPath !== `${base}/practice` && <Link className="library-action-practice text-link" to={`${base}/practice`}>Practicar</Link>}
                {capabilities.hasLessons && capabilities.canExam && <Link className="library-action-exam text-link" to={`${base}/exam`}>Hacer simulacro</Link>}
                {pending !== null && pending > 0 && <Link className="library-action-review text-link" to={`${base}/review`}>{pending} por repasar</Link>}
                <button type="button" className="library-hide btn-outline" aria-label={`${hidden ? 'Restaurar' : 'Ocultar'} ${pkg.unit.title}`} title={hidden ? 'Volver a mostrar en la biblioteca' : 'Ocultar de la biblioteca; conserva tu progreso'} onClick={() => toggleHidden(pkg, !hidden)}>{hidden ? 'Restaurar' : <><EyeOffIcon size={16} /><span>Ocultar</span></>}</button>
              </div>
            </article>;
          })}</div>
        </section>)}
      </>}
  </div>;
}
