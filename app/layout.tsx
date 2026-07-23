import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sơ đồ kho",
  description: "Công cụ nội bộ quản lý sơ đồ vị trí sản phẩm",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
