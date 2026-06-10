import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudioCreation",
  description: "Creative production engine — fal-powered generation studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
