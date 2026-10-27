import React from 'react';
import { Question } from '@/domain/content/types';

interface PropositionCheckControlProps {
  question: Question;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const PropositionCheckControl: React.FC<PropositionCheckControlProps> = ({
  question,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '1rem 0' }}>
      <legend style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1rem' }}>
        ¿Es una proposición lógica?
      </legend>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${value === true ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            backgroundColor: value === true ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
            cursor: disabled ? 'default' : 'pointer',
            transition: 'border-color 0.15s ease, background-color 0.15s ease',
          }}
        >
          <input
            type="radio"
            name={`prop_${question.id}`}
            checked={value === true}
            onChange={() => onChange(true)}
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
            <strong>Sí</strong> (es proposición)
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${value === false ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            backgroundColor: value === false ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
            cursor: disabled ? 'default' : 'pointer',
            transition: 'border-color 0.15s ease, background-color 0.15s ease',
          }}
        >
          <input
            type="radio"
            name={`prop_${question.id}`}
            checked={value === false}
            onChange={() => onChange(false)}
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
            <strong>No</strong> (no es proposición)
          </span>
        </label>
      </div>
    </fieldset>
  );
};
