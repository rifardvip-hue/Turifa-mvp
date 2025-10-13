// app/rifa/[slug]/loading.tsx
export default function Loading() {
  return (
    <main className="min-h-screen grid place-items-center p-8">
      <div className="w-full max-w-md animate-pulse space-y-3">
        <div className="h-40 rounded-lg bg-gray-200" />
        <div className="h-6 w-2/3 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-200" />
      </div>
    </main>
  );
}
