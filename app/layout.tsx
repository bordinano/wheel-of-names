import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRYPTITA X B4Y SPIN WHEEL SPIN",
  description: "Full of exciting prizes awaits."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
