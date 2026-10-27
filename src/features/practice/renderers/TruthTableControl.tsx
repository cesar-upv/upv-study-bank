import React, { useMemo } from 'react';
import { Question } from '@/domain/content/types';
import { parseFormula, buildTruthTable, serializeToUnicode } from '@/domain/logic';

interface TruthTableControlProps {
  question: Question;
  cells: Record<string, boolean | null>;
  classification?: string;
  onCellsChange: (cells: Record<string, boolean | null>) => void;
  onClassificationChange: (classification: string) => void;
  disabled?: boolean;
}

export const TruthTableControl: React.FC<TruthTableControlProps> = ({
  question,
  cells,
  classification = '',
  onCellsChange,
  onClassificationChange,
  disabled = false,
}) => {
  const tableData = useMemo(() => {
    try {
      const ast = parseFormula(question.payload.formula);
      return buildTruthTable(ast, question.payload.variables);
    } catch {
      return null;
    }
  }, [question.payload.formula, question.payload.variables]);

  if (!tableData) {
    return <div style={{ color: 'var(--error-text)', fontWeight: 500 }}>Error al procesar la fórmula de la tabla.</div>;
  }

  const stepCols = tableData.columns.filter((c) => !c.isVariable);

  const handleCellToggle = (cellKey: string, currentVal: boolean | null | undefined) => {
    if (disabled) return;
    // Cycle: null -> true (V) -> false (F) -> null
    let nextVal: boolean | null;
    if (currentVal === undefined || currentVal === null) {
      nextVal = true;
    } else if (currentVal === true) {
      nextVal = false;
    } else {
      nextVal = null;
    }

    onCellsChange({
      ...cells,
      [cellKey]: nextVal,
    });
  };

  return (
    <div style={{ margin: '1rem 0' }}>
      <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Haz clic en cada celda para alternar su valor: <strong>[Vacío → V → F]</strong>. Orden de filas: F antes de V; última variable cambia más rápido.
      </div>

      <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
        <table>
          <thead>
            <tr>
              {tableData.variables.map((v) => (
                <th key={v} style={{ textAlign: 'center', minWidth: '48px', backgroundColor: 'var(--bg-surface-elevated)' }}>
                  {v}
                </th>
              ))}
              {stepCols.map((col) => (
                <th
                  key={col.id}
                  style={{
                    textAlign: 'center',
                    minWidth: '90px',
                    backgroundColor: col.isRoot ? 'var(--info-bg)' : 'var(--bg-surface-elevated)',
                    color: col.isRoot ? 'var(--info-text)' : 'inherit',
                    fontWeight: 600,
                  }}
                >
                  {col.ast ? serializeToUnicode(col.ast) : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {tableData.variables.map((v) => (
                  <td
                    key={v}
                    style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: row.assignment[v] ? 'var(--success-text)' : 'var(--text-muted)',
                    }}
                  >
                    {row.assignment[v] ? 'V' : 'F'}
                  </td>
                ))}

                {stepCols.map((col) => {
                  const cellKey = `${rIdx}_${col.id}`;
                  const cellVal = cells[cellKey];

                  let text = '-';
                  let bg = 'transparent';
                  let color = 'var(--text-muted)';

                  if (cellVal === true) {
                    text = 'V';
                    bg = 'var(--success-bg)';
                    color = 'var(--success-text)';
                  } else if (cellVal === false) {
                    text = 'F';
                    bg = 'var(--error-bg)';
                    color = 'var(--error-text)';
                  }

                  const colName = col.ast ? serializeToUnicode(col.ast) : col.header;

                  return (
                    <td key={col.id} style={{ textAlign: 'center', padding: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => handleCellToggle(cellKey, cellVal)}
                        disabled={disabled}
                        aria-label={`Fila ${rIdx + 1}, columna ${colName}: valor actual ${text === '-' ? 'Vacío' : text}`}
                        style={{
                          width: '100%',
                          minHeight: '38px',
                          minWidth: '38px',
                          backgroundColor: bg,
                          color,
                          fontWeight: 700,
                          fontSize: '1rem',
                          fontVariantNumeric: 'tabular-nums',
                          border: `1px solid ${cellVal !== null && cellVal !== undefined ? 'var(--border-focus)' : 'var(--border-color)'}`,
                          borderRadius: 'var(--radius-sm)',
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                      >
                        {text}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label htmlFor={`class_${question.id}`} style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          Clasificación de la fórmula:
        </label>
        <select
          id={`class_${question.id}`}
          value={classification}
          onChange={(e) => onClassificationChange(e.target.value)}
          disabled={disabled}
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.95rem', maxWidth: '100%' }}
        >
          <option value="">-- Selecciona clasificación --</option>
          <option value="tautology">Tautología (verdadera en todas las filas)</option>
          <option value="contingency">Contingencia (verdadera en al menos una y falsa en al menos una)</option>
          <option value="contradiction">Contradicción (falsa en todas las filas)</option>
        </select>
      </div>
    </div>
  );
};
