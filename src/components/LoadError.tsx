export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="card load-error"><p role="alert">{message}</p><button type="button" className="btn-primary" onClick={onRetry}>Reintentar</button></div>;
}
