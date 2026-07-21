"use client";

export default function WarehouseError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-900">Không thể tải trang sơ đồ kho</p>
        <p className="mt-1 text-sm text-red-700">Vui lòng thử lại hoặc kiểm tra cấu hình KiotViet và cơ sở dữ liệu.</p>
        <button type="button" onClick={reset} className="mt-4 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Thử lại
        </button>
      </div>
    </main>
  );
}
