import React from 'react';
import { Question, Answer } from '@/domain/content/types';

interface ShortAnswerControlProps {
  question: Question;
  answer?: Answer;
  studentText: string;
  criteriaScores: Record<number, number>;
  isSubmitted: boolean;
  onStudentTextChange: (text: string) => void;
  onCriteriaScoresChange: (scores: Record<number, number>) => void;
  disabled?: boolean;
}

export const ShortAnswerControl: React.FC<ShortAnswerControlProps> = ({
  question,
  answer,
  studentText,
  criteriaScores,
  isSubmitted,
  onStudentTextChange,
  onCriteriaScoresChange,
  disabled = false,
}) => {
  const rubric: Array<{ criterion: string; points: number }> = answer?.solution?.rubric || [];
  const modelAnswer: string = answer?.solution?.model_answer || '';

  const handleCriterionToggle = (idx: number, maxPoints: number) => {
    if (disabled) return;
    const current = criteriaScores[idx] || 0;
    const next = current > 0 ? 0 : maxPoints;
    onCriteriaScoresChange({
      ...criteriaScores,
      [idx]: next,
    });
  };

  return (
    <div style={{ margin: '1rem 0' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor={`short_${question.id}`} style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.95rem' }}>
          Tu respuesta redactada:
        </label>
        <textarea
          id={`short_${question.id}`}
          rows={4}
          value={studentText}
          onChange={(e) => onStudentTextChange(e.target.value)}
          placeholder="Redacta tu explicación con tus propias palabras..."
          disabled={disabled || isSubmitted}
          style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.95rem', borderRadius: 'var(--radius-md)' }}
        />
      </div>

      {isSubmitted && (
        <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              Solución modelo oficial:
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              {modelAnswer}
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
              Rúbrica de autoevaluación:
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Compara tu respuesta con la solución modelo y marca los criterios cumplidos:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rubric.map((item, idx) => {
                const awarded = (criteriaScores[idx] || 0) > 0;
                return (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: awarded ? 'var(--success-bg)' : 'var(--bg-surface)',
                      border: `1px solid ${awarded ? 'var(--success-border)' : 'var(--border-color)'}`,
                      cursor: disabled ? 'default' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={awarded}
                      onChange={() => handleCriterionToggle(idx, item.points)}
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
                    <span style={{ fontSize: '0.9rem', flex: 1 }}>{item.criterion}</span>
                    <span className="badge badge-info">{item.points} pto{item.points > 1 ? 's' : ''}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
