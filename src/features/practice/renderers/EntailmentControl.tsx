import React from 'react';
import { Question } from '@/domain/content/types';

interface EntailmentControlProps {
  question: Question;
  entailed: boolean | null;
  counterexample: Record<string, boolean>;
  onEntailedChange: (val: boolean) => void;
  onCounterexampleChange: (ce: Record<string, boolean>) => void;
  disabled?: boolean;
}

export const EntailmentControl: React.FC<EntailmentControlProps> = ({
  question,
  entailed,
  counterexample,
  onEntailedChange,
  onCounterexampleChange,
  disabled = false,
}) => {
  const variables: string[] = question.payload.variables || [];

  const handleVarToggle = (v: string, currentVal: boolean) => {
    if (disabled) return;
    onCounterexampleChange({
      ...counterexample,
      [v]: !currentVal,
    });
  };

  return (
    <div style={{ margin: '1rem 0' }}>
      <fieldset style={{ border: 'none', padding: 0, marginBottom: '1rem' }}>
        <legend style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1rem' }}>
          ¿Se deduce lógicamente la conclusión a partir de la base de conocimiento?
        </legend>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${entailed === true ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              backgroundColor: entailed === true ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <input
              type="radio"
              name={`ent_${question.id}`}
              checked={entailed === true}
              onChange={() => onEntailedChange(true)}
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
              <strong>Sí</strong> (KB ⊨ conclusión)
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${entailed === false ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              backgroundColor: entailed === false ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <input
              type="radio"
              name={`ent_${question.id}`}
              checked={entailed === false}
              onChange={() => onEntailedChange(false)}
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
              <strong>No</strong> (KB ⊭ conclusión)
            </span>
          </label>
        </div>
      </fieldset>

      {entailed === false && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            Proporciona un contraejemplo (hace V todas las premisas y F la conclusión):
          </h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {variables.map((v) => {
              const val = counterexample[v] ?? false;
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
