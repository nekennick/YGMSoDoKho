import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/warehouse">
        Mở Warehouse Layout
      </Link>
    </main>
  );
}
