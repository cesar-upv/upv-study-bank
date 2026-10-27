import type { Question } from '@/domain/content/types';
import type { StudentResponse } from '@/domain/assessment/types';
import { MarkdownView } from '@/components/MarkdownView';

type Item = { id: string; text: string };
export function CollectionControl({ question, response, onChange, disabled = false }: { question: Question; response?: StudentResponse; onChange: (value: StudentResponse) => void; disabled?: boolean }) {
  if (question.type === 'multiple_choice') {
    const selected = response?.type === 'multiple_choice' ? response.selectedOptionIds : [];
    return <fieldset className="collection-control" disabled={disabled}><legend>Selecciona todas las respuestas correctas.</legend>{question.payload.options.map((item: Item) => <label className="choice-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={e => onChange({ type: 'multiple_choice', selectedOptionIds: e.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id) })} /><MarkdownView content={item.text} /></label>)}</fieldset>;
  }
  if (question.type === 'matching') {
    const pairs = response?.type === 'matching' ? response.pairs : {};
    return <fieldset className="collection-control" disabled={disabled}><legend>Relaciona cada concepto. Usa cada respuesta una sola vez.</legend>{question.payload.left.map((item: Item) => <label className="matching-row" key={item.id}><span>{item.text}</span><select aria-label={`Relación para ${item.text}`} value={pairs[item.id] || ''} onChange={e => onChange({ type: 'matching', pairs: { ...pairs, [item.id]: e.target.value } })}><option value="">Selecciona una relación</option>{question.payload.right.map((right: Item) => <option key={right.id} value={right.id} disabled={Object.entries(pairs).some(([id, value]) => id !== item.id && value === right.id)}>{right.text}</option>)}</select></label>)}</fieldset>;
  }
  const items: Item[] = question.payload.items;
  const order = response?.type === 'ordering' ? response.orderedIds : items.map(i => i.id);
  const move = (index: number, delta: number) => { const next = [...order]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange({ type: 'ordering', orderedIds: next }); };
  return <fieldset className="collection-control" disabled={disabled}><legend>Ordena los elementos de primero a último.</legend><ol className="ordering-list">{order.map((id, index) => <li key={id}><span>{items.find(i => i.id === id)?.text}</span><div><button type="button" className="btn-outline btn-sm" aria-label={`Subir elemento ${index + 1}`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>Subir</button><button type="button" className="btn-outline btn-sm" aria-label={`Bajar elemento ${index + 1}`} disabled={disabled || index === order.length - 1} onClick={() => move(index, 1)}>Bajar</button></div></li>)}</ol>{!response && <button type="button" className="btn-secondary" onClick={() => onChange({ type: 'ordering', orderedIds: order })}>Confirmar este orden</button>}</fieldset>;
}
