import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { contentRepo } from '@/infrastructure/content/repository';
import { UnitPackage } from '@/domain/content/types';
import { validateUnitPackage, ValidationError } from '@/domain/content/package-validator';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import templatePackage from '@/../templates/matematicas.unit-package.json';
import {
  UploadIcon,
  DownloadIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  PackageIcon,
  BookOpenIcon,
  TargetIcon,
} from '@/components/icons/Icons';

export const ImportView: React.FC = () => {
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [successInfo, setSuccessInfo] = useState<{
    subjectTitle: string;
    unitTitle: string;
    subjectId: string;
    unitId: string;
    lessonsCount: number;
    questionsCount: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availablePackages, setAvailablePackages] = useState<UnitPackage[]>([]);

  useEffect(() => {
    async function loadPackages() {
      try {
        const pkgs = await contentRepo.getAllPackages();
        setAvailablePackages(pkgs);
      } catch { setErrors([{ path: 'biblioteca', message: 'No pudimos cargar las materias. Recarga para volver a intentarlo.' }]); }
    }
    loadPackages();
  }, [successInfo]);

  const handleExportPackage = (pkg: UnitPackage) => {
    const jsonStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.subject.id}-${pkg.unit.id}.unit-package.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processPackageJson = async (text: string) => {
    setIsProcessing(true);
    setErrors([]);
    setSuccessInfo(null);

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (err: any) {
        setErrors([{ path: 'json', message: `Error de sintaxis JSON: ${err.message}` }]);
        return;
      }

      const valResult = validateUnitPackage(parsed, text);
      if (!valResult.valid || !valResult.data) {
        setErrors(valResult.errors);
        return;
      }

      const pkg = valResult.data;
      await contentRepo.saveImportedPackage(pkg);

      setSuccessInfo({
        subjectTitle: pkg.subject.title,
        unitTitle: pkg.unit.title,
        subjectId: pkg.subject.id,
        unitId: pkg.unit.id,
        lessonsCount: pkg.lessons.length,
        questionsCount: pkg.questions.length,
      });
      setJsonText('');
    } catch (err: any) {
      setErrors([{ path: 'system', message: `Error al procesar el paquete: ${err.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      setSuccessInfo(null);
      if (file.size > 5 * 1024 * 1024) throw new Error('El paquete supera el límite de 5 MiB.');
      const text = await file.text();
      await processPackageJson(text);
    } catch (error) {
      setErrors([{ path: 'archivo', message: error instanceof Error ? error.message : 'No se pudo leer el archivo.' }]);
    } finally { setIsProcessing(false); e.target.value = ''; }
  };

  const handleLoadTemplate = async () => {
    const text = JSON.stringify(templatePackage, null, 2);
    setJsonText(text);
    await processPackageJson(text);
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Importar paquetes' }]} />

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '0.35rem' }}>
          Gestión de Contenido e Importación
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Importa nuevas materias y unidades mediante paquetes JSON conformes a la especificación oficial <code>unit-package</code> (v1).
        </p>
      </div>

      {successInfo && (
        <div role="status" className="callout callout-success" style={{ marginBottom: '1.75rem' }}>
          <CheckCircle2Icon size={24} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              Paquete importado con éxito: {successInfo.subjectTitle}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Unidad: <strong>{successInfo.unitTitle}</strong> ({successInfo.lessonsCount} lección(es), {successInfo.questionsCount} ejercicio(s)).
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to={`/subjects/${successInfo.subjectId}/units/${successInfo.unitId}`} className="btn-primary btn-sm">
                Abrir unidad importada
              </Link>
              <Link to={`/subjects/${successInfo.subjectId}/units/${successInfo.unitId}/study`} className="btn-secondary btn-sm">
                <BookOpenIcon size={14} />
                <span>Leer lección</span>
              </Link>
              <Link to={`/subjects/${successInfo.subjectId}/units/${successInfo.unitId}/practice`} className="btn-outline btn-sm">
                <TargetIcon size={14} />
                <span>Practicar ejercicio</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="callout callout-error" style={{ marginBottom: '1.75rem' }}>
          <AlertTriangleIcon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
          <div>
            <strong style={{ fontSize: '0.95rem' }}>Se encontraron {errors.length} error(es) en el paquete. La importación fue rechazada íntegramente:</strong>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', fontSize: '0.875rem' }}>
              {errors.map((e, idx) => (
                <li key={idx}>
                  <code>{e.path}</code>: {e.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* File upload option */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>Subir archivo de paquete</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Selecciona un archivo <code>.json</code> con la estructura <code>unit-package</code> (máx. 5 MiB, 1.000 preguntas, 100 lecciones).
            </p>
          </div>
          <label
            className="btn-primary"
            style={{
              alignSelf: 'flex-start',
              opacity: isProcessing ? 0.55 : 1,
              pointerEvents: isProcessing ? 'none' : 'auto',
            }}
          >
            <UploadIcon size={16} />
            <span>Seleccionar archivo JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="file-input-accessible"
            />
          </label>
        </div>

        {/* Template test option */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>Prueba los formatos de preguntas</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Una unidad breve de conjuntos con selección múltiple, relaciones y ordenamiento. Puedes estudiarla, practicar y hacer un simulacro.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadTemplate}
            disabled={isProcessing}
            className="btn-secondary"
            style={{ alignSelf: 'flex-start', gap: '0.5rem' }}
          >
            <PackageIcon size={16} />
            <span>Añadir ejemplo de matemáticas</span>
          </button>
        </div>
      </div>

      {/* Paste text area */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>O pega el contenido JSON:</h2>
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            rows={7}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"schema_version": 1, "kind": "unit-package", ...}'
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', padding: '0.75rem' }}
          />
        </div>
        <button
          type="button"
          onClick={() => processPackageJson(jsonText)}
          disabled={isProcessing || !jsonText.trim()}
          className="btn-primary"
        >
          Validar e Importar JSON
        </button>
      </div>

      {/* Export / Share packages */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>Exportar cursos para compartir con compañeros</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Puedes descargar el paquete completo de cualquier materia/unidad en formato <code>.unit-package.json</code>.
          Tus compañeros solo necesitan abrir Banco de Estudio y subir este archivo en esta misma pestaña para tener el curso completo con todas sus guías, ejercicios, soluciones y simulacros, sin requerir conexión a internet ni compartir tus respuestas privadas.
        </p>

        {availablePackages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando cursos disponibles...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {availablePackages.map((pkg) => (
              <div
                key={`${pkg.subject.id}-${pkg.unit.id}`}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                    {pkg.subject.title} &mdash; <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{pkg.unit.title}</span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    ID: <code>{pkg.subject.id}/{pkg.unit.id}</code> · {pkg.lessons.length} lecciones · {pkg.questions.length} ejercicios · {pkg.answers.length} soluciones
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleExportPackage(pkg)}
                    className="btn-primary btn-sm"
                    title={`Exportar ${pkg.unit.title} como archivo JSON`}
                  >
                    <DownloadIcon size={14} />
                    <span>Descargar paquete (.json)</span>
                  </button>
                  <Link
                    to={`/subjects/${pkg.subject.id}/units/${pkg.unit.id}`}
                    className="btn-outline btn-sm"
                  >
                    Ver unidad
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
