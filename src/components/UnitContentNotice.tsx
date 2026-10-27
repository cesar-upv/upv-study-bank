import { Link } from 'react-router-dom';
import type { UnitManifest } from '@/domain/content/types';
import type { UnitCapabilities } from '@/domain/content/unit-capabilities';
import { unitBasePath } from '@/domain/content/unit-capabilities';
import { Breadcrumbs } from './Breadcrumbs';

export function UnitUnavailable() {
  return <section className="empty-state unit-content-notice"><h1>Unidad no disponible</h1><p>El material de este enlace no está instalado en este navegador. Puedes importarlo o volver a tu biblioteca.</p><div className="unit-actions"><Link className="btn-primary" to="/content">Gestionar materias</Link><Link className="text-link" to="/">Volver a la biblioteca</Link></div></section>;
}

export function UnitContentNotice({ unit, capabilities, section, missingTopic = false }: {
  unit: UnitManifest; capabilities: UnitCapabilities; section: 'study' | 'practice' | 'exam' | 'review'; missingTopic?: boolean;
}) {
  const base = unitBasePath(unit);
  const title = missingTopic ? 'Ese tema no está en esta guía'
    : section === 'study' ? (capabilities.isExamOnly ? 'Esta unidad está dedicada a simulacros' : 'Esta unidad no incluye lecciones')
    : section === 'exam' ? 'No hay preguntas disponibles para un simulacro'
    : capabilities.hasLessons ? 'Esta guía no incluye ejercicios' : 'Esta unidad todavía no tiene ejercicios';
  const message = missingTopic ? 'El enlace puede corresponder a otra versión del material. Abre la guía para ver los temas disponibles.'
    : section === 'study' && capabilities.hasQuestions ? 'Puedes resolver sus preguntas y consultar las explicaciones al terminar.'
    : section === 'exam' && capabilities.hasQuestions ? 'Los ejercicios de esta unidad son opcionales o no cubren las cuotas del examen. Puedes resolverlos en Práctica.'
    : capabilities.hasLessons ? 'Puedes seguir leyendo el material de estudio disponible.' : 'Añade una versión del paquete que contenga lecciones o ejercicios para empezar.';
  return <div><Breadcrumbs items={[{ label: 'Biblioteca', to: '/' }, { label: unit.title, to: base }]} />
    <section className="empty-state unit-content-notice"><h1>{title}</h1><p>{unit.title}</p><p>{message}</p>
      <div className="unit-actions">
        {capabilities.hasLessons && (section !== 'study' || missingTopic) && <Link className="btn-primary" to={`${base}/study`}>Abrir guía</Link>}
        {capabilities.canExam && section !== 'exam' && <Link className={capabilities.hasLessons ? 'btn-secondary' : 'btn-primary'} to={`${base}/exam`}>Hacer simulacro</Link>}
        {capabilities.hasQuestions && section !== 'practice' && <Link className="btn-secondary" to={`${base}/practice`}>Practicar ejercicios</Link>}
        {!capabilities.hasQuestions && !capabilities.hasLessons && <Link className="btn-primary" to="/content">Gestionar materias</Link>}
        <Link className="text-link" to={base}>Vista general</Link><Link className="text-link" to="/">Volver a la biblioteca</Link>
      </div>
    </section>
  </div>;
}
