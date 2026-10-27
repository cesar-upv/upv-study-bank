import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
export function Layout() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    const studyBase = (path: string) => path.match(/^(.*\/study)(?:\/[^/]+)?$/)?.[1];
    const sameGuide = studyBase(previousPath.current) && studyBase(previousPath.current) === studyBase(pathname);
    if (previousPath.current !== pathname && !sameGuide) window.scrollTo({ top: 0, behavior: 'instant' });
    previousPath.current = pathname;
  }, [pathname]);
  return <div className="study-app"><a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Saltar al contenido principal</a><Navbar /><div className="app-workspace"><main className="workspace-content" id="main-content" tabIndex={-1} key={pathname.replace(/(\/study)\/[^/]+$/, '$1')}><Outlet /></main><footer className="workspace-footer"><span>Banco de Estudio</span><span>Tu progreso se guarda en este navegador.</span></footer></div></div>;
}
