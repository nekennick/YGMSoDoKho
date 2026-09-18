import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Yagami | Sơ đồ tổng kho",
    template: "%s | Yagami",
  },
  description: "Hệ thống sơ đồ tổng kho Yagami.",
};

export const viewport: Viewport = {
  themeColor: "#27080d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
