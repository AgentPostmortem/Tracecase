import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar, MobileBar } from "@/components/Sidebar";
import { themeInitScript } from "@/components/ThemeToggle";
import { ChatWidget } from "@/components/ChatWidget";
import { SuiteLinks } from "@/components/SuiteLinks";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tracecase: CI for AI agents",
  description:
    "Record agent runs, replay them against prompt and model changes, and catch regressions and unsafe tool calls before they ship.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="app-bg min-h-screen font-sans antialiased">
        <div className="relative z-10 flex min-h-screen">
          <Sidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <MobileBar />
            <main className="flex-1 px-5 py-8 md:px-10 lg:px-14">
              <div className="mx-auto w-full max-w-[88rem]">{children}</div>
            </main>
            <footer className="border-t border-border-soft px-5 py-5 md:px-10 lg:px-14">
              <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-3 font-mono text-[11px] text-muted">
                <span>tracecase · record runs · replay changes · catch regressions</span>
                <SuiteLinks />
              </div>
            </footer>
          </div>
        </div>
        <ChatWidget
          name="Tracecase"
          greeting="Hi! Ask me about Tracecase, agent evals, or how a run gets scored."
        />
      </body>
    </html>
  );
}
