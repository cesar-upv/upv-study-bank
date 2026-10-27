import React from 'react';
import { MarkdownView } from '@/components/MarkdownView';
import { Question } from '@/domain/content/types';

interface SingleChoiceControlProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SingleChoiceControl: React.FC<SingleChoiceControlProps> = ({
  question,
  value,
  onChange,
  disabled = false,
}) => {
  const options = question.payload.options || [];

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '1rem 0' }}>
      <legend style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1rem' }}>
        Selecciona la opción correcta:
      </legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {options.map((option: { id: string; text: string }) => {
          const isSelected = value === option.id;
          return (
            <label
              key={option.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                cursor: disabled ? 'default' : 'pointer',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <input
                type="radio"
                name={`question_${question.id}`}
                value={option.id}
                checked={isSelected}
                onChange={() => onChange(option.id)}
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
              <div style={{ minWidth: 0, fontSize: '0.95rem', lineHeight: 1.5, display: 'inline-block' }}>
                <strong style={{ textTransform: 'uppercase' }}>{option.id}. </strong>
                <MarkdownView content={option.text} />
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
