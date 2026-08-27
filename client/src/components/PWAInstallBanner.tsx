import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWAInstallBanner
 * Shows a subtle install-to-home-screen banner on supported browsers.
 * - Chrome/Edge/Android: uses the native beforeinstallprompt event
 * - iOS Safari: shows manual instructions (iOS doesn't support the prompt API)
 * - Dismissed state is persisted in localStorage for 30 days
 */
export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  const showOnlyOutsideEntryContexts = () => {
    const hasEntryControl = Boolean(document.querySelector("form, input, textarea, select, [contenteditable='true']"));
    if (!hasEntryControl) setShowBanner(true);
  };

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Check if user dismissed recently (within 30 days)
    try {
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (dismissed) {
        const dismissedDate = parseInt(dismissed, 10);
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (!isNaN(dismissedDate) && Date.now() - dismissedDate < thirtyDays) return;
      }
    } catch {
      // localStorage unavailable — show banner anyway
    }

    // Detect iOS
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show iOS banner after a short delay
      const timer = setTimeout(showOnlyOutsideEntryContexts, 3000);
      return () => clearTimeout(timer);
    }

    // Listen for Chrome/Android install prompt
    let bannerTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      bannerTimer = setTimeout(showOnlyOutsideEntryContexts, 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (bannerTimer !== null) clearTimeout(bannerTimer);
    };
  }, []);

  useEffect(() => {
    const hideForFormEntry = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        setShowBanner(false);
      }
    };
    document.addEventListener("focusin", hideForFormEntry);
    return () => document.removeEventListener("focusin", hideForFormEntry);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSInstructions(false);
    try { localStorage.setItem("pwa-install-dismissed", Date.now().toString()); } catch { /* ignore */ }
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
        role="region"
        aria-label="Install TrueAxis HQ app"
      >
        <div className="bg-[#0D1117] border border-[#D4922A]/30 rounded-xl shadow-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4922A]/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-[#D4922A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Install TrueAxis HQ</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isIOS ? "Add to Home Screen for the best experience" : "Install for faster access from your home screen"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              onClick={handleInstall}
              className="bg-[#D4922A] hover:bg-[#d4901c] text-white border-0 h-8 px-3 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Install
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0D1117] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Install TrueAxis HQ</h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              To install TrueAxis HQ on your iPhone or iPad:
            </p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4922A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p className="text-sm text-gray-300">
                  Tap the <strong className="text-white">Share</strong> button{" "}
                  <span className="inline-block bg-white/10 rounded px-1.5 py-0.5 text-xs">⬆</span>{" "}
                  at the bottom of Safari
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4922A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p className="text-sm text-gray-300">
                  Scroll down and tap{" "}
                  <strong className="text-white">"Add to Home Screen"</strong>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4922A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p className="text-sm text-gray-300">
                  Tap <strong className="text-white">"Add"</strong> — TrueAxis HQ will appear on your home screen
                </p>
              </li>
            </ol>
            <Button
              className="w-full mt-5 bg-[#D4922A] hover:bg-[#d4901c] text-white border-0"
              onClick={handleDismiss}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
