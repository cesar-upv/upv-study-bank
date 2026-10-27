import React, { useState } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  parseFormula,
  buildTruthTable,
  checkEquivalence,
  solveSat,
  checkEntailment,
  serializeToUnicode,
  TruthTableResult,
} from '@/domain/logic';
import { generateQuestion, GeneratedResult } from '@/domain/practice/generator';
import { QuestionCard } from '@/features/practice/QuestionCard';
import {
  TableIcon,
  ScaleIcon,
  SearchIcon,
  BookOpenIcon,
  SparklesIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
} from '@/components/icons/Icons';

export const LogicLabView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'table' | 'equivalence' | 'sat' | 'entailment' | 'generator'>('table');

  // Table state
  const [tableFormula, setTableFormula] = useState('(p -> (q or (not r)))');
  const [showFullSteps, setShowFullSteps] = useState(true);

  // Equivalence state
  const [eqLeft, setEqLeft] = useState('p -> q');
  const [eqRight, setEqRight] = useState('(not p) or q');

  // SAT state
  const [satFormula, setSatFormula] = useState('(p or q) and ((not p) or (not q))');

  // Entailment state
  const [kbPremises, setKbPremises] = useState('p\np -> q');
  const [kbConclusion, setKbConclusion] = useState('q');

  // Generator state
  const [genId, setGenId] = useState('truth-table-v1');
  const [genLevel, setGenLevel] = useState<'basic' | 'intermediate' | 'advanced'>('basic');
  const [genSeed, setGenSeed] = useState(12345);
  const [generatedItem, setGeneratedItem] = useState<GeneratedResult | null>(null);

  // Helper for symbol insertion
  const insertSymbol = (sym: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter((prev) => prev + sym);
  };

  // Compute Table
  let tableResult: TruthTableResult | null = null;
  let tableError = '';
  try {
    if (tableFormula.trim()) {
      const ast = parseFormula(tableFormula);
      tableResult = buildTruthTable(ast);
    }
  } catch (e: any) {
    tableError = e.message;
  }

  // Compute Equivalence
  let eqResult: any = null;
  let eqError = '';
  try {
    if (eqLeft.trim() && eqRight.trim()) {
      const lAst = parseFormula(eqLeft);
      const rAst = parseFormula(eqRight);
      eqResult = checkEquivalence(lAst, rAst);
    }
  } catch (e: any) {
    eqError = e.message;
  }

  // Compute SAT
  let satResult: any = null;
  let satError = '';
  try {
    if (satFormula.trim()) {
      const ast = parseFormula(satFormula);
      satResult = solveSat(ast);
    }
  } catch (e: any) {
    satError = e.message;
  }

  // Compute Entailment
  let entResult: any = null;
  let entError = '';
  try {
    if (kbPremises.trim() && kbConclusion.trim()) {
      const lines = kbPremises
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const pAsts = lines.map((l) => parseFormula(l));
      const cAst = parseFormula(kbConclusion);
      entResult = checkEntailment(pAsts, cAst);
    }
  } catch (e: any) {
    entError = e.message;
  }

  const handleGenerate = () => {
    const res = generateQuestion(genId, genLevel, genSeed);
    setGeneratedItem(res);
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Laboratorio de Lógica' }]} />

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '0.35rem' }}>
          Laboratorio de Lógica Proposicional
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Entorno computacional interactivo para calcular tablas con columnas intermedias, verificar equivalencias, resolver satisfacibilidad y generar ejercicios reproducibles.
        </p>
      </div>

      {/* Mode Tabs */}
      <div
        role="tablist"
        aria-label="Herramientas del laboratorio de lógica"
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          id="tab-table"
          role="tab"
          aria-selected={activeTab === 'table'}
          aria-controls="panel-table"
          type="button"
          onClick={() => setActiveTab('table')}
          className={activeTab === 'table' ? 'btn-primary' : 'btn-outline'}
        >
          <TableIcon size={16} />
          <span>Tablas de verdad</span>
        </button>
        <button
          id="tab-equivalence"
          role="tab"
          aria-selected={activeTab === 'equivalence'}
          aria-controls="panel-equivalence"
          type="button"
          onClick={() => setActiveTab('equivalence')}
          className={activeTab === 'equivalence' ? 'btn-primary' : 'btn-outline'}
        >
          <ScaleIcon size={16} />
          <span>Equivalencia</span>
        </button>
        <button
          id="tab-sat"
          role="tab"
          aria-selected={activeTab === 'sat'}
          aria-controls="panel-sat"
          type="button"
          onClick={() => setActiveTab('sat')}
          className={activeTab === 'sat' ? 'btn-primary' : 'btn-outline'}
        >
          <SearchIcon size={16} />
          <span>SAT (Satisfacibilidad)</span>
        </button>
        <button
          id="tab-entailment"
          role="tab"
          aria-selected={activeTab === 'entailment'}
          aria-controls="panel-entailment"
          type="button"
          onClick={() => setActiveTab('entailment')}
          className={activeTab === 'entailment' ? 'btn-primary' : 'btn-outline'}
        >
          <BookOpenIcon size={16} />
          <span>Inferencia (KB ⊨ α)</span>
        </button>
        <button
          id="tab-generator"
          role="tab"
          aria-selected={activeTab === 'generator'}
          aria-controls="panel-generator"
          type="button"
          onClick={() => setActiveTab('generator')}
          className={activeTab === 'generator' ? 'btn-primary' : 'btn-outline'}
        >
          <SparklesIcon size={16} />
          <span>Generador de ejercicios</span>
        </button>
      </div>

      {/* Tab 1: Truth Table */}
      {activeTab === 'table' && (
        <div id="panel-table" role="tabpanel" aria-labelledby="tab-table" className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.85rem' }}>Calculadora de Tablas de Verdad</h2>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="lab-table-formula" style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.925rem' }}>
              Fórmula proposicional:
            </label>

            <div className="symbol-toolbar" aria-label="Símbolos lógicos para tabla">
              {['¬', '∧', '∨', '⊕', '→', '↔', '(', ')', 'p', 'q', 'r', 's'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="symbol-btn"
                  onClick={() => insertSymbol(s === '¬' ? '¬ ' : ` ${s} `, setTableFormula)}
                  title={`Insertar ${s}`}
                  aria-label={`Insertar ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <input
              id="lab-table-formula"
              type="text"
              value={tableFormula}
              onChange={(e) => setTableFormula(e.target.value)}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '1.05rem', padding: '0.65rem 0.85rem' }}
              placeholder="Ejemplo: (p -> (q or (not r)))"
            />
          </div>

          <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input
              id="toggle-steps"
              type="checkbox"
              checked={showFullSteps}
              onChange={(e) => setShowFullSteps(e.target.checked)}
              style={{
                margin: 0,
                width: '18px',
                height: '18px',
                flexShrink: 0,
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer',
              }}
            />
            <label htmlFor="toggle-steps" style={{ fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
              Mostrar pasos y columnas intermedias (desactivar para "solo resultado final")
            </label>
          </div>

          {tableError && (
            <div className="callout callout-error" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
              <div>{tableError}</div>
            </div>
          )}

          {tableResult && (
            <div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.85rem 1.15rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <strong>Variables:</strong> {tableResult.variables.join(', ') || 'ninguna'}
                </div>
                <div>
                  <strong>Tautología, Contradicción o Contingencia:</strong>{' '}
                  <span className={`badge ${tableResult.classification === 'tautology' ? 'badge-success' : tableResult.classification === 'contradiction' ? 'badge-error' : 'badge-warning'}`}>
                    {tableResult.classification}
                  </span>
                </div>
                <div>
                  <strong>Satisfacible:</strong> {tableResult.satisfiable ? 'Sí' : 'No'}
                </div>
                <div>
                  <strong>Modelos verdaderos:</strong> {tableResult.models.length} de {tableResult.rows.length} filas
                </div>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      {tableResult.variables.map((v) => (
                        <th key={v} style={{ textAlign: 'center', minWidth: '45px' }}>
                          {v}
                        </th>
                      ))}
                      {(showFullSteps
                        ? tableResult.columns.filter((c) => !c.isVariable)
                        : tableResult.columns.filter((c) => c.isRoot)
                      ).map((col) => (
                        <th
                          key={col.id}
                          style={{
                            textAlign: 'center',
                            backgroundColor: col.isRoot ? 'var(--info-bg)' : undefined,
                            color: col.isRoot ? 'var(--info-text)' : undefined,
                            fontWeight: col.isRoot ? 700 : 500,
                            minWidth: '80px',
                          }}
                        >
                          {col.ast ? serializeToUnicode(col.ast) : col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableResult.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {tableResult.variables.map((v) => (
                          <td key={v} style={{ textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {row.assignment[v] ? 'V' : 'F'}
                          </td>
                        ))}
                        {(showFullSteps
                          ? tableResult.columns.filter((c) => !c.isVariable)
                          : tableResult.columns.filter((c) => c.isRoot)
                        ).map((col) => {
                          const val = row.values[col.id];
                          return (
                            <td
                              key={col.id}
                              style={{
                                textAlign: 'center',
                                fontWeight: col.isRoot ? 700 : 500,
                                fontVariantNumeric: 'tabular-nums',
                                color: val ? 'var(--success-text)' : 'var(--error-text)',
                                backgroundColor: val ? 'var(--success-bg)' : 'var(--error-bg)',
                              }}
                            >
                              {val ? 'V' : 'F'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Equivalence */}
      {activeTab === 'equivalence' && (
        <div id="panel-equivalence" role="tabpanel" aria-labelledby="tab-equivalence" className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.85rem' }}>Comprobador de Equivalencia Lógica</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div>
              <label htmlFor="eq-f1" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.925rem' }}>
                Fórmula A:
              </label>
              <input
                id="eq-f1"
                type="text"
                value={eqLeft}
                onChange={(e) => setEqLeft(e.target.value)}
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                placeholder="p -> q"
              />
            </div>
            <div>
              <label htmlFor="eq-f2" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.925rem' }}>
                Fórmula B:
              </label>
              <input
                id="eq-f2"
                type="text"
                value={eqRight}
                onChange={(e) => setEqRight(e.target.value)}
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                placeholder="(not p) or q"
              />
            </div>
          </div>

          {eqError && (
            <div className="callout callout-error">
              <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
              <div>{eqError}</div>
            </div>
          )}

          {eqResult && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className={eqResult.equivalent ? 'callout callout-success' : 'callout callout-warning'}>
                {eqResult.equivalent ? (
                  <CheckCircle2Icon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
                ) : (
                  <XCircleIcon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--warning-text)' }} />
                )}
                <div>
                  <strong style={{ fontSize: '1rem' }}>
                    {eqResult.equivalent ? 'Son lógicamente equivalentes (A ≡ B)' : 'No son lógicamente equivalentes (A ≢ B)'}
                  </strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                    Dominio común evaluado: {eqResult.domain.join(', ')} ({1 << eqResult.domain.length} asignaciones comprobadas).
                  </p>
                </div>
              </div>

              {!eqResult.equivalent && eqResult.counterexamples.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Contraejemplos encontrados ({eqResult.counterexamples.length}):
                  </h4>
                  <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {eqResult.counterexamples.map((ce: any, idx: number) => (
                      <li key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                        {Object.entries(ce)
                          .map(([k, v]) => `${k} = ${v ? 'V' : 'F'}`)
                          .join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SAT */}
      {activeTab === 'sat' && (
        <div id="panel-sat" role="tabpanel" aria-labelledby="tab-sat" className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.85rem' }}>Verificador de Satisfacibilidad (SAT)</h2>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="sat-formula-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.925rem' }}>
              Fórmula proposicional:
            </label>
            <input
              id="sat-formula-input"
              type="text"
              value={satFormula}
              onChange={(e) => setSatFormula(e.target.value)}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '1.05rem' }}
              placeholder="(p or q) and ((not p) or (not q))"
            />
          </div>

          {satError && (
            <div className="callout callout-error">
              <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
              <div>{satError}</div>
            </div>
          )}

          {satResult && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className={satResult.satisfiable ? 'callout callout-success' : 'callout callout-error'}>
                {satResult.satisfiable ? (
                  <CheckCircle2Icon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
                ) : (
                  <XCircleIcon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
                )}
                <div>
                  <strong style={{ fontSize: '1rem' }}>
                    {satResult.satisfiable ? 'La fórmula es SATISFACIBLE' : 'La fórmula es INSATISFACIBLE (Contradicción)'}
                  </strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                    {satResult.satisfiable
                      ? `Existen ${satResult.models.length} modelos que hacen verdadera la expresión.`
                      : 'Todas las asignaciones posibles evalúan a Falso.'}
                  </p>
                </div>
              </div>

              {satResult.models.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Modelos testigos válidos:
                  </h4>
                  <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {satResult.models.map((m: any, idx: number) => (
                      <li key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                        {Object.entries(m)
                          .map(([k, v]) => `${k} = ${v ? 'V' : 'F'}`)
                          .join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Entailment */}
      {activeTab === 'entailment' && (
        <div id="panel-entailment" role="tabpanel" aria-labelledby="tab-entailment" className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.85rem' }}>Comprobador de Consecuencia Lógica (KB ⊨ α)</h2>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="ent-prem-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.925rem' }}>
              Premisas de la Base de Conocimiento (una por línea):
            </label>
            <textarea
              id="ent-prem-input"
              rows={3}
              value={kbPremises}
              onChange={(e) => setKbPremises(e.target.value)}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', padding: '0.65rem' }}
              placeholder="p&#10;p -> q"
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="ent-conc-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.925rem' }}>
              Conclusión (α):
            </label>
            <input
              id="ent-conc-input"
              type="text"
              value={kbConclusion}
              onChange={(e) => setKbConclusion(e.target.value)}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              placeholder="q"
            />
          </div>

          {entError && (
            <div className="callout callout-error">
              <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--error-text)' }} />
              <div>{entError}</div>
            </div>
          )}

          {entResult && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className={entResult.entailed ? 'callout callout-success' : 'callout callout-warning'}>
                {entResult.entailed ? (
                  <CheckCircle2Icon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--success-text)' }} />
                ) : (
                  <XCircleIcon size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--warning-text)' }} />
                )}
                <div>
                  <strong style={{ fontSize: '1rem' }}>
                    {entResult.entailed ? 'KB ⊨ α (La conclusión se deduce lógicamente)' : 'KB ⊭ α (La conclusión NO se deduce)'}
                  </strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                    {entResult.entailed
                      ? 'En todo modelo donde todas las premisas son verdaderas, la conclusión también lo es.'
                      : 'Existen interpretaciones donde todas las premisas son verdaderas pero la conclusión es falsa.'}
                  </p>
                </div>
              </div>

              {!entResult.entailed && entResult.counterexamples.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Contraejemplos:
                  </h4>
                  <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {entResult.counterexamples.map((ce: any, idx: number) => (
                      <li key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                        {Object.entries(ce)
                          .map(([k, v]) => `${k} = ${v ? 'V' : 'F'}`)
                          .join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Generator */}
      {activeTab === 'generator' && (
        <div id="panel-generator" role="tabpanel" aria-labelledby="tab-generator" className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Generador de Ejercicios Reproducibles</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.925rem' }}>
            Generación determinista basada en AST acotados y PRNG Mulberry32 con semilla uint32. La misma semilla genera exactamente el mismo ejercicio.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <label htmlFor="gen-type-select" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                Tipo de generador:
              </label>
              <select
                id="gen-type-select"
                value={genId}
                onChange={(e) => setGenId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="truth-table-v1">Tablas de verdad (truth-table-v1)</option>
                <option value="equivalence-v1">Equivalencia lógica (equivalence-v1)</option>
                <option value="sat-v1">Satisfacibilidad (sat-v1)</option>
                <option value="translation-v1">Traducción formal (translation-v1)</option>
              </select>
            </div>

            <div>
              <label htmlFor="gen-level-select" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                Dificultad:
              </label>
              <select
                id="gen-level-select"
                value={genLevel}
                onChange={(e) => setGenLevel(e.target.value as any)}
                style={{ width: '100%' }}
              >
                <option value="basic">Básica (2 variables, prof 2)</option>
                <option value="intermediate">Intermedia (3 variables, prof 3)</option>
                <option value="advanced">Avanzada (4 variables, prof 4)</option>
              </select>
            </div>

            <div>
              <label htmlFor="gen-seed-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                Semilla (uint32):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="gen-seed-input"
                  type="number"
                  value={genSeed}
                  onChange={(e) => setGenSeed(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setGenSeed(Math.floor(Math.random() * 1000000))}
                  className="btn-outline btn-sm"
                  title="Generar semilla aleatoria"
                  aria-label="Generar semilla aleatoria"
                >
                  <RotateCcwIcon size={14} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <button type="button" onClick={handleGenerate} className="btn-primary">
              <SparklesIcon size={16} />
              <span>Generar ejercicio interactivo</span>
            </button>
          </div>

          {generatedItem && (
            <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.75rem' }}>
              <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-info">Semilla: {generatedItem.meta.seed}</span>
                <span className="badge badge-warning">Versión: {generatedItem.meta.generatorVersion}</span>
                {generatedItem.meta.isFallback && <span className="badge badge-error">Fallback activado</span>}
              </div>

              <QuestionCard
                key={`${generatedItem.meta.generatorId}-${generatedItem.meta.seed}`}
                question={generatedItem.question}
                answer={generatedItem.answer}
                showLessonLink={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
