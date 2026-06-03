export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="muted">この機能は後続のフェーズで実装されます。</p>
    </div>
  );
}
