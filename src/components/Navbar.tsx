import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { contentRepo } from '@/infrastructure/content/repository';
import { useTheme } from '@/app/theme-context';
import { getUnitCapabilities, type UnitCapabilities } from '@/domain/content/unit-capabilities';
import { BookOpenIcon, TargetIcon, TimerIcon, RotateCcwIcon, FlaskIcon, PackageIcon, DatabaseIcon, SunIcon, MoonIcon, TableIcon } from './icons/Icons';

const decodeRouteId = (id: string) => { try { return decodeURIComponent(id); } catch { return id; } };

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const match = pathname.match(/^\/subjects\/([^/]+)\/units\/([^/]+)/);
  const routeBase = match?.[0] || null;
  const [context, setContext] = useState<{ base: string; subject: string; unit: string; capabilities: UnitCapabilities } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    let active = true;
    if (pathname === '/') setContext(null);
    if (routeBase) {
      const [, subjectId, unitId] = routeBase.match(/^\/subjects\/([^/]+)\/units\/([^/]+)/)!;
      contentRepo.getUnitPackage(decodeRouteId(subjectId), decodeRouteId(unitId)).then(pkg => {
        if (active) setContext(pkg ? { base: routeBase, subject: pkg.subject.title, unit: pkg.unit.title, capabilities: getUnitCapabilities(pkg.unit, pkg.lessons.length, pkg.questions) } : null);
      }).catch(() => { if (active) setContext(null); });
    }
    return () => { active = false; };
  }, [routeBase, pathname === '/']);
  const selected = pathname !== '/' && (!routeBase || context?.base === routeBase) ? context : null;
  const base = selected?.base;
  const linkClass = ({ isActive }: { isActive: boolean }) => `rail-link${isActive ? ' active' : ''}`;
  return <header className="app-rail">
    <NavLink to="/" className="rail-brand"><BookOpenIcon size={26} /><span>Banco de<br />Estudio</span></NavLink>
    {selected && <div className="rail-context rail-context-mobile"><strong>{selected.unit}</strong></div>}
    <button className="rail-menu" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Cerrar navegación' : 'Explorar y herramientas'}</button>
    <nav id="main-navigation" aria-label="Navegación principal" className={`rail-navigation${menuOpen ? ' is-open' : ''}`}>
      <NavLink to="/" end className={linkClass}><BookOpenIcon size={18} />Biblioteca</NavLink>
      {base && <section className="rail-group rail-unit" aria-labelledby="rail-study-title">
        <h2 id="rail-study-title" className="rail-label rail-unit-title">{selected.unit}</h2>
        <NavLink to={base} end className={linkClass}><TableIcon size={18} />Vista general</NavLink>
        {selected.capabilities.hasLessons && <NavLink to={`${base}/study`} className={linkClass}><BookOpenIcon size={18} />Guía de estudio</NavLink>}
        {selected.capabilities.hasQuestions && <NavLink to={`${base}/practice`} className={linkClass}><TargetIcon size={18} />Práctica</NavLink>}
        {selected.capabilities.canExam && <NavLink to={`${base}/exam`} className={linkClass} aria-label="Simulacro"><TimerIcon size={18} /><span>Simulacro</span></NavLink>}
        {selected.capabilities.hasQuestions && <NavLink to={`${base}/review`} className={linkClass} aria-label="Repaso"><RotateCcwIcon size={18} /><span>Repaso</span></NavLink>}
      </section>}
      <section className="rail-group" aria-labelledby="rail-explore-title">
        <h2 id="rail-explore-title" className="rail-label">Explorar conceptos</h2>
        <NavLink to="/logic-lab" className={linkClass} aria-label="Laboratorio"><FlaskIcon size={18} /><span>Laboratorio</span></NavLink>
      </section>
      <section className="rail-group" aria-labelledby="rail-data-title">
        <h2 id="rail-data-title" className="rail-label">Material y datos</h2>
        <NavLink to="/content" className={linkClass} aria-label="Gestionar materias"><PackageIcon size={18} /><span>Gestionar materias</span></NavLink>
        <NavLink to="/settings" className={linkClass}><SunIcon size={18} /><span>Configuración</span></NavLink>
        <NavLink to="/backup" className={linkClass} aria-label="Mis datos"><DatabaseIcon size={18} /><span>Mis datos</span></NavLink>
      </section>
    </nav>
    <button className="rail-theme" onClick={toggleTheme} aria-label={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}>{theme === 'light' ? <MoonIcon size={18} /> : <SunIcon size={18} />}Modo {theme === 'light' ? 'oscuro' : 'claro'}</button>
  </header>;
}
