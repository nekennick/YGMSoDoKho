export default function WarehouseLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <div className="h-14 animate-pulse border-b bg-white" />
      <section className="flex flex-1 items-center justify-center">
        <div className="rounded-lg border bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Đang tải sơ đồ kho…
        </div>
      </section>
    </main>
  );
}
