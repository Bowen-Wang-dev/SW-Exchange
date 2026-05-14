import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SW Exchange v0.x",
  description: "Web foundation for a simulated internal crypto exchange.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
