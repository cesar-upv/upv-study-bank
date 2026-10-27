import React, { useState } from 'react';
import { exportBackup, restoreBackup, clearPersonalData, MAX_BACKUP_BYTES } from '@/infrastructure/persistence/backup';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useConfirmation } from '@/components/use-confirmation';
import {
  DownloadIcon,
  UploadIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from '@/components/icons/Icons';

export const BackupView: React.FC = () => {
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const backup = await exportBackup();
      const { attempts, lessonProgress, bookmarks } = backup;
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `banco-estudio-respaldo-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `Respaldo exportado exitosamente con ${attempts.length} intentos, ${lessonProgress.length} lecciones leídas y ${bookmarks.length} favoritos.`,
      });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Error al exportar respaldo: ${e.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setStatusMessage(null);
      if (file.size > MAX_BACKUP_BYTES) throw new Error('El respaldo supera el límite de 50 MiB.');
      const text = await file.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('El archivo no contiene un JSON válido');
      }

      await restoreBackup(data);

      setStatusMessage({
        type: 'success',
        text: 'Respaldo restaurado exitosamente en la base de datos local.',
      });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Fallo al importar: ${e.message}` });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleClearData = async () => {
    if (isProcessing || !await confirm({
      title: '¿Borrar tu progreso?',
      description: 'Se eliminarán intentos, favoritos, lecturas, repasos y simulacros guardados en este navegador.',
      detail: 'Las materias se conservarán. Para recuperar el progreso necesitarás un respaldo exportado.',
      confirmLabel: 'Borrar progreso', cancelLabel: 'Conservar progreso', tone: 'danger',
    })) {
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMessage(null);
      await clearPersonalData();
      setStatusMessage({ type: 'info', text: 'Progreso y sesiones reiniciadas.' });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Error al reiniciar datos: ${e.message}` });
    } finally { setIsProcessing(false); }
  };

  return (
    <div>
      {confirmationDialog}
      <Breadcrumbs items={[{ label: 'Respaldo' }]} />

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '0.35rem' }}>
          Respaldo y Restauración
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Exporta tu progreso académico e historial de intentos para trasladarlos a otro dispositivo o conservarlos de forma segura en formato JSON portátil.
        </p>
      </div>

      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`callout ${statusMessage.type === 'success' ? 'callout-success' : statusMessage.type === 'error' ? 'callout-error' : 'callout-info'}`}
          style={{ marginBottom: '1.75rem' }}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2Icon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
          ) : (
            <AlertTriangleIcon size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <div>{statusMessage.text}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Export card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Exportar datos personales</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Genera un archivo JSON descargable con todos tus intentos de ejercicios, estado de lectura, favoritos, simulacros y paquetes importados.
            </p>
          </div>
          <button type="button" onClick={handleExport} disabled={isProcessing} className="btn-primary" style={{ alignSelf: 'flex-start', gap: '0.5rem' }}>
            <DownloadIcon size={16} />
            <span>Descargar archivo de respaldo JSON</span>
          </button>
        </div>

        {/* Import card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Restaurar desde archivo</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Añade los registros del respaldo y reemplaza los que tengan el mismo identificador. Los demás datos se conservan. Tamaño máximo: 50 MiB.
            </p>
          </div>
          <label
            className="btn-secondary"
            style={{
              alignSelf: 'flex-start',
              opacity: isProcessing ? 0.55 : 1,
              pointerEvents: isProcessing ? 'none' : 'auto',
            }}
          >
            <UploadIcon size={16} />
            <span>Seleccionar archivo para restaurar</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              disabled={isProcessing}
              className="file-input-accessible"
            />
          </label>
        </div>
      </div>

      {/* Danger zone / Reset */}
      <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-elevated)' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--error-text)', marginBottom: '0.4rem' }}>Zona de mantenimiento</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Elimina tu historial de todas las materias en este navegador. Esta acción no se puede deshacer sin un respaldo.
        </p>
        <button type="button" onClick={handleClearData} disabled={isProcessing} className="btn-outline btn-sm" style={{ color: 'var(--error-text)', borderColor: 'var(--error-border)' }}>
          <RotateCcwIcon size={14} />
          <span>Borrar mi progreso</span>
        </button>
      </div>
    </div>
  );
};
