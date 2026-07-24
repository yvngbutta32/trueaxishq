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
    <div className="min-h-screen bg-gradient-to-br from-[#0D1117] via-[#1A2E2A] to-[#0D1117] flex items-center justify-center p-4">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#D4922A] opacity-10 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full bg-[#FF6B6B] opacity-8 blur-3xl" />
      </div>

      <main
        id="main-content"
        className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-md p-8 text-center"
        aria-labelledby="success-heading"
      >
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </div>
        {/* Success icon */}
        <div className="relative inline-flex items-center justify-center mb-6" aria-hidden="true">
          <div className="w-20 h-20 rounded-full bg-[#D4922A]/15 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#D4922A]" />
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full gradient-amber flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <h1
          id="success-heading"
          className="text-2xl font-extrabold text-gray-900 mb-2"
        >
          You're all set! 🎉
        </h1>
        <p className="text-gray-600 text-sm mb-8 leading-relaxed">
          Your subscription is now active. Welcome to TrueAxis HQ — your business is about to run on autopilot.
        </p>

        {/* What's unlocked */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left space-y-3" role="list" aria-label="Features now unlocked">
          {[
            "AI client intake forms — active",
            "Smart scheduling — active",
            "Automated invoicing — active",
            "AI follow-up engine — active",
            "Analytics dashboard — active",
          ].map(feature => (
            <div key={feature} className="flex items-center gap-3" role="listitem">
              <CheckCircle className="w-4 h-4 text-[#D4922A] flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="space-y-3">
          <Button
            className="w-full gradient-amber text-white border-0 h-12 text-base gap-2"
            onClick={() => navigate("/dashboard")}
            aria-label="Go to your dashboard"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className="w-full text-gray-600 gap-2"
            onClick={() => navigate("/billing")}
            aria-label="View your billing details"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            View Billing Details
          </Button>
        </div>

        <p className="text-xs text-gray-600 mt-6">
          A receipt has been sent to your email. Questions? Email{" "}
          <a href="mailto:support@trueaxishq.com" className="text-[#D4922A] hover:underline focus-visible:outline-[3px] focus-visible:outline-[#D4922A] focus-visible:outline-offset-1 rounded">
            support@trueaxishq.com
          </a>
        </p>
      </main>
    </div>
  );
}
