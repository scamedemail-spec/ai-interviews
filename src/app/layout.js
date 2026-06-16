import "./globals.css";
import { SessionProvider } from "@/context/SessionContext";

// Metadata shown in the browser tab and link previews.
export const metadata = {
  title: "Tell — High-Stakes Conversation Simulator",
  description:
    "Practice job interviews, salary negotiations, and hard conversations against an adversarial AI that reads — and exploits — your real-time tells.",
};

// The root layout wraps EVERY page. We put the SessionProvider here so the in-progress
// session state survives navigation between setup → session → debrief.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-ink-200 font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
