import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CheckoutSuccess() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Show a welcome toast after a short delay
    const timer = setTimeout(() => {
      toast.success("Welcome to TrueAxis HQ! Your subscription is now active.", {
        duration: 6000,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1C1C1E] via-[#1A2E2A] to-[#1C1C1E] flex items-center justify-center p-4">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full bg-[#FF6B6B] opacity-8 blur-3xl" />
      </div>

      <main
        id="main-content"
        className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center"
        aria-labelledby="success-heading"
      >
        {/* Success icon */}
        <div className="relative inline-flex items-center justify-center mb-6" aria-hidden="true">
          <div className="w-20 h-20 rounded-full bg-[#00C9A7]/15 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#00C9A7]" />
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full gradient-teal flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <h1
          id="success-heading"
          className="text-2xl font-extrabold text-gray-900 mb-2"
          style={{ fontFamily: "Sora, sans-serif" }}
        >
          You're all set! 🎉
        </h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Your subscription is now active. Welcome to TrueAxis HQ — your business is about to run on autopilot.
        </p>

        {/* What's unlocked */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left space-y-3" role="list" aria-label="Features now unlocked">
          {[
            "AI client intake forms — active",
            "Smart scheduling — active",
            "Automated invoicing — active",
            "AI follow-up engine — active",
            "Analytics dashboard — active",
          ].map(feature => (
            <div key={feature} className="flex items-center gap-3" role="listitem">
              <CheckCircle className="w-4 h-4 text-[#00C9A7] flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="space-y-3">
          <Button
            className="w-full gradient-teal text-white border-0 h-12 text-base gap-2"
            onClick={() => navigate("/dashboard")}
            aria-label="Go to your dashboard"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className="w-full text-gray-500 gap-2"
            onClick={() => navigate("/billing")}
            aria-label="View your billing details"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            View Billing Details
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          A receipt has been sent to your email. Questions? Email{" "}
          <a href="mailto:support@trueaxishq.com" className="text-[#00C9A7] hover:underline focus-visible:outline-[3px] focus-visible:outline-[#00C9A7] focus-visible:outline-offset-1 rounded">
            support@trueaxishq.com
          </a>
        </p>
      </main>
    </div>
  );
}
