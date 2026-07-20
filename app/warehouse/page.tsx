export default function WarehousePage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex h-14 items-center border-b bg-white px-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Warehouse Layout</p>
          <p className="text-xs text-slate-500">Giai đoạn 1 · Nền tảng</p>
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-10 py-12 text-center shadow-sm">
          <p className="text-3xl">📦</p>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Canvas sắp ra mắt</h1>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Nền tảng ứng dụng đã sẵn sàng. Canvas và dữ liệu KiotViet sẽ được triển khai ở các giai đoạn tiếp theo.</p>
        </div>
      </section>
    </main>
  );
}
