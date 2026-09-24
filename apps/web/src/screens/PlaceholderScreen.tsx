export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-ink-2">Coming together phase by phase.</p>
    </div>
  );
}
