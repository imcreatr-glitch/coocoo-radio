"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "coocoo-install-dismissed-v1";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * InstallPrompt — PWA install CTA.
 *
 * Behavior:
 *  - On Chrome/Edge/Android: listens for `beforeinstallprompt`, shows a small banner
 *    with "Install karo" button → click triggers native install prompt.
 *  - On iOS Safari (no beforeinstallprompt): shows a small banner telling user to
 *    use Share → Add to Home Screen.
 *  - Once installed (display-mode: standalone or appinstalled event), banner hides forever.
 *  - User can dismiss with X; remembers dismissal for 14 days in localStorage.
 *
 * Also registers /sw.js on mount (required for Chrome install criteria).
 *
 * All initial state is computed lazily so we never call setState synchronously in
 * an effect body (avoids react-hooks/set-state-in-effect lint error).
 */
export default function InstallPrompt() {
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari proprietary
      window.navigator.standalone === true
    );
  });
  const [ios, setIos] = useState(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    return isIos && isSafari;
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true; // SSR: hide banner
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_MS;
  });
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  // Register service worker (Chrome install criteria)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW register fail:", err);
      });
    }
  }, []);

  // Listen for beforeinstallprompt (Chrome/Edge/Android) + appinstalled
  useEffect(() => {
    if (installed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  // Show banner when: not installed, not dismissed, and either iOS Safari (always show)
  // or beforeinstallprompt has fired (Chrome/Android).
  const show = !installed && !dismissed && (ios || deferred !== null);
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install CooCoo Radio app"
      className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-zinc-900/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur"
      style={{ boxShadow: "0 8px 32px rgba(var(--amb-rgb), 0.18), 0 8px 32px rgba(0,0,0,0.6)" }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Close"
        className="absolute right-2 top-2 rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
          style={{ background: "linear-gradient(135deg, #fbbf24, #d97706)" }}
        >
          📻
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">CooCoo Radio nu App vangu install karo</p>
          <p className="mt-0.5 text-xs text-zinc-300">
            Phone di home screen te icon — ek tap vich radio on. Bina browser khole!
          </p>

          {ios ? (
            <div className="mt-2.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
              <span className="font-semibold">iPhone layi:</span> Neeche{" "}
              <Share className="inline h-3 w-3 -translate-y-0.5" /> Share button dabao → phir{" "}
              <span className="font-semibold">&quot;Add to Home Screen&quot;</span> →{" "}
              <span className="font-semibold">Add</span>.
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstall}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              Install karo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
