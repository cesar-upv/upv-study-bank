import { palettes, useTheme, type ThemeMode } from '@/app/theme-context';
import { MarkdownView } from '@/components/MarkdownView';

const preview = '### Un espacio para concentrarte\n\nLa comprensión crece con la práctica: $a^2+b^2=c^2$.\n\n| Actividad | Estado |\n| --- | --- |\n| Lectura | En curso |\n\n```python\ndef repasar(temas):\n    return [tema for tema in temas if tema.pendiente]\n```';

export function SettingsView() {
  const { palette, mode, theme, setPalette, setMode, storageError } = useTheme();
  return <div className="settings-view">
    <header className="page-heading"><div><h1>Configuración</h1><p>Ajusta tu espacio de estudio.</p></div></header>
    <section aria-labelledby="appearance-title" className="settings-section">
      <h2 id="appearance-title">Apariencia</h2>
      <p>La paleta cambia la interfaz y el contenido. Tu progreso se conserva.</p>
      <label className="settings-mode" htmlFor="theme-mode">Modo de color
        <select id="theme-mode" value={mode} onChange={event => setMode(event.target.value as ThemeMode)}>
          <option value="system">Seguir al sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option>
        </select>
      </label>
      <fieldset className="palette-options"><legend>Paleta de colores</legend>
        {Object.entries(palettes).map(([id, info]) => <label key={id} className="palette-option">
          <input type="radio" name="palette" checked={palette === id} onChange={() => setPalette(id as keyof typeof palettes)} />
          <span><strong>{info.name}</strong><span>{info.description}</span><small>{info.light} / {info.dark}</small></span>
        </label>)}
      </fieldset>
      <p role="status">Tema activo: {palettes[palette].name} {palettes[palette][theme]}{mode === 'system' ? ' · según tu sistema' : ''}.</p>
      {storageError && <p role="alert" className="callout callout-warning">El navegador no permite guardar la preferencia. Se aplicará durante esta visita; habilita el almacenamiento para conservarla.</p>}
    </section>
    <section className="settings-preview" aria-labelledby="theme-preview-title"><h2 id="theme-preview-title">Vista previa</h2><MarkdownView content={preview} /><div className="preview-states"><span className="badge badge-success">Correcto</span><span className="badge badge-error">Por revisar</span><span className="badge badge-warning">Atención</span></div></section>
  </div>;
}
