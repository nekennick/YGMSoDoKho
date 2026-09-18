import Image from "next/image";
import Link from "next/link";
import yagamiLogo from "../logo/cropped-Final_Logo_NEW-png-e1764553538419.webp";

export default function HomePage() {
  return (
    <main className="yagami-intro relative isolate flex min-h-[100dvh] overflow-hidden px-4 py-4 text-white sm:px-6 sm:py-6 lg:px-10">
      <div aria-hidden="true" className="intro-orb intro-orb-primary" />
      <div aria-hidden="true" className="intro-orb intro-orb-secondary" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col">
        <nav className="intro-reveal intro-reveal-nav flex h-14 items-center justify-between" aria-label="Điều hướng chính">
          <Link href="/" className="group inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#27080d]">
            <span className="intro-brand-mark flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <Image src={yagamiLogo} alt="Yagami Mì Cay" priority className="h-full w-full object-contain" />
            </span>
            <span className="text-base font-bold tracking-[-0.03em] text-white transition-opacity duration-200 group-hover:opacity-85">Yagami</span>
          </Link>
          <p className="hidden text-sm font-medium text-white/65 sm:block">Hệ thống sơ đồ tổng kho</p>
        </nav>

        <section className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] md:gap-14 md:py-16 lg:gap-20" aria-labelledby="intro-title">
          <div className="intro-reveal intro-reveal-copy max-w-2xl">
            <p className="mb-5 text-xs font-bold tracking-[0.2em] text-red-200/90">YAGAMI / VẬN HÀNH KHO</p>
            <h1 id="intro-title" className="max-w-[11ch] text-5xl font-black leading-[0.96] tracking-[-0.065em] text-white sm:text-6xl lg:text-7xl">
              Hệ thống sơ đồ tổng kho Yagami
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-red-50/80 sm:text-lg">
              Quan sát và điều phối vị trí sản phẩm trên một mặt bằng trực quan.
            </p>
            <Link
              href="/warehouse?branch=cao-lanh"
              className="intro-cta mt-9 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ed343e] px-6 text-sm font-bold text-white shadow-[0_16px_36px_rgba(118,10,24,0.42)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#ff4a53] hover:shadow-[0_20px_42px_rgba(118,10,24,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#27080d]"
            >
              Mở sơ đồ kho
            </Link>
          </div>

          <div className="intro-glass intro-reveal intro-reveal-visual relative mx-auto flex aspect-square w-full max-w-[470px] items-center justify-center rounded-[2rem] p-7 sm:p-10">
            <div aria-hidden="true" className="intro-panel-light absolute inset-0 rounded-[2rem]" />
            <div className="intro-logo-stage relative flex aspect-square w-full max-w-[330px] items-center justify-center rounded-[1.5rem] p-8 sm:p-10">
              <Image src={yagamiLogo} alt="Logo Yagami Mì Cay" priority className="h-full w-full object-contain drop-shadow-[0_18px_26px_rgba(43,4,10,0.4)]" />
            </div>
          </div>
        </section>

        <footer className="intro-reveal intro-reveal-footer flex flex-col gap-2 border-t border-white/15 py-5 text-xs font-medium text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>Sơ đồ tổng kho Yagami</span>
          <span>© {new Date().getFullYear()} Khoa Trần</span>
        </footer>
      </div>
    </main>
  );
}
