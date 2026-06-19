import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Archivo, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import AppShell from "./components/AppShell";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal One — Media Platform",
  description: "Portal One — the unified media platform: AI create, library, finishing & delivery",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const skin = (await cookies()).get("studio_skin")?.value === "lumen" ? "lumen" : "onyx";
  return (
    <html
      lang="en"
      data-skin={skin}
      className={`${archivo.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
