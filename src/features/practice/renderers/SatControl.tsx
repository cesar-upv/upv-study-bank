import React from 'react';
import { Question } from '@/domain/content/types';

interface SatControlProps {
  question: Question;
  satisfiable: boolean | null;
  model: Record<string, boolean>;
  onSatisfiableChange: (val: boolean) => void;
  onModelChange: (model: Record<string, boolean>) => void;
  disabled?: boolean;
}

export const SatControl: React.FC<SatControlProps> = ({
  question,
  satisfiable,
  model,
  onSatisfiableChange,
  onModelChange,
  disabled = false,
}) => {
  const variables: string[] = question.payload.variables || [];

  const handleVarToggle = (v: string, currentVal: boolean) => {
    if (disabled) return;
    onModelChange({
      ...model,
      [v]: !currentVal,
    });
  };

  return (
    <div style={{ margin: '1rem 0' }}>
      <fieldset style={{ border: 'none', padding: 0, marginBottom: '1rem' }}>
        <legend style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1rem' }}>
          ¿Es satisfacible la fórmula?
        </legend>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${satisfiable === true ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              backgroundColor: satisfiable === true ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <input
              type="radio"
              name={`sat_${question.id}`}
              checked={satisfiable === true}
              onChange={() => onSatisfiableChange(true)}
              disabled={disabled}
              style={{
                margin: 0,
                width: '18px',
                height: '18px',
                flexShrink: 0,
                accentColor: 'var(--accent-primary)',
                cursor: disabled ? 'default' : 'pointer',
              }}
            />
            <span style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
              <strong>Satisfacible</strong> (existe al menos un modelo que la hace V)
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${satisfiable === false ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              backgroundColor: satisfiable === false ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <input
              type="radio"
              name={`sat_${question.id}`}
              checked={satisfiable === false}
              onChange={() => onSatisfiableChange(false)}
              disabled={disabled}
              style={{
                margin: 0,
                width: '18px',
                height: '18px',
                flexShrink: 0,
                accentColor: 'var(--accent-primary)',
                cursor: disabled ? 'default' : 'pointer',
              }}
            />
            <span style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
              <strong>Insatisfacible</strong> (falsa en todas las asignaciones)
            </span>
          </label>
        </div>
      </fieldset>

      {satisfiable === true && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            Proporciona un modelo testigo (asignación que haga verdadera la fórmula):
          </h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {variables.map((v) => {
              const val = model[v] ?? false;
              return (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{v}:</span>
                  <button
                    type="button"
                    onClick={() => handleVarToggle(v, val)}
                    disabled={disabled}
                    className="btn-outline btn-sm"
                    style={{
                      minWidth: '40px',
                      fontWeight: 700,
                      backgroundColor: val ? 'var(--success-bg)' : 'var(--error-bg)',
                      color: val ? 'var(--success-text)' : 'var(--error-text)',
                    }}
                  >
                    {val ? 'V' : 'F'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
