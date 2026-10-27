import React from 'react';
import { Question } from '@/domain/content/types';

interface EquivalenceControlProps {
  question: Question;
  equivalent: boolean | null;
  counterexample: Record<string, boolean>;
  onEquivalentChange: (val: boolean) => void;
  onCounterexampleChange: (ce: Record<string, boolean>) => void;
  disabled?: boolean;
}

export const EquivalenceControl: React.FC<EquivalenceControlProps> = ({
  question,
  equivalent,
  counterexample,
  onEquivalentChange,
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
          ¿Son lógicamente equivalentes las dos fórmulas?
        </legend>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${equivalent === true ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              backgroundColor: equivalent === true ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <input
              type="radio"
              name={`eq_${question.id}`}
              checked={equivalent === true}
              onChange={() => onEquivalentChange(true)}
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
              <strong>Sí</strong>, son equivalentes
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${equivalent === false ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              backgroundColor: equivalent === false ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <input
              type="radio"
              name={`eq_${question.id}`}
              checked={equivalent === false}
              onChange={() => onEquivalentChange(false)}
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
              <strong>No</strong>, no son equivalentes
            </span>
          </label>
        </div>
      </fieldset>

      {equivalent === false && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            Proporciona un contraejemplo (asignación donde las fórmulas difieran):
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
