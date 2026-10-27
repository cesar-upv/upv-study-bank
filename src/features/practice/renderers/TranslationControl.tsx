import React, { useState } from 'react';
import { Question } from '@/domain/content/types';
import { parseFormula, serializeToUnicode } from '@/domain/logic';
import { AlertTriangleIcon } from '@/components/icons/Icons';

interface TranslationControlProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const TranslationControl: React.FC<TranslationControlProps> = ({
  question,
  value,
  onChange,
  disabled = false,
}) => {
  const bindings = question.payload.bindings || {};
  const variables = question.payload.variables || [];
  const [inputVal, setInputVal] = useState(value);

  const handleInsertSymbol = (sym: string) => {
    if (disabled) return;
    const newVal = inputVal + sym;
    setInputVal(newVal);
    onChange(newVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    onChange(val);
  };

  // Preview parsing
  let previewText = '';
  let parseError = '';
  if (inputVal.trim()) {
    try {
      const ast = parseFormula(inputVal);
      previewText = serializeToUnicode(ast);
    } catch (e: any) {
      parseError = e.message;
    }
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
          Variables declaradas en el dominio:
        </h4>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
          {Object.entries(bindings).map(([v, desc]) => (
            <li key={v}>
              <strong>{v}:</strong> {desc as string}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label htmlFor={`trans_${question.id}`} style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.95rem' }}>
          Fórmula lógica traducida:
        </label>

        {/* Symbol Toolbar */}
        <div className="symbol-toolbar" aria-label="Símbolos lógicos rápidos">
          {[
            { sym: '¬ ', label: 'NOT (¬)' },
            { sym: ' ∧ ', label: 'AND (∧)' },
            { sym: ' ∨ ', label: 'OR (∨)' },
            { sym: ' ⊕ ', label: 'XOR (⊕)' },
            { sym: ' → ', label: 'IMPLIES (→)' },
            { sym: ' ↔ ', label: 'IFF (↔)' },
            { sym: '(', label: '(' },
            { sym: ')', label: ')' },
            ...variables.map((v: string) => ({ sym: v, label: v })),
          ].map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className="symbol-btn"
              onClick={() => handleInsertSymbol(btn.sym)}
              disabled={disabled}
              title={`Insertar ${btn.label}`}
              aria-label={`Insertar ${btn.label}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <input
          id={`trans_${question.id}`}
          type="text"
          value={inputVal}
          onChange={handleInputChange}
          placeholder="Ejemplo: (not p) or q  o  p -> q"
          disabled={disabled}
          style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '1.05rem', padding: '0.6rem 0.8rem' }}
        />
      </div>

      {previewText && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Vista previa formateada: <code style={{ fontWeight: 600 }}>{previewText}</code>
        </div>
      )}

      {parseError && (
        <div style={{ fontSize: '0.85rem', color: 'var(--error-text)', marginTop: '0.35rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <AlertTriangleIcon size={14} style={{ flexShrink: 0 }} />
          <span>{parseError}</span>
        </div>
      )}
    </div>
  );
};
