import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F7F4]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
      <div className="text-center px-6 max-w-md">
        {/* Big 404 */}
        <div className="text-[120px] font-extrabold leading-none text-[#1C1C1E] opacity-10 select-none mb-2">404</div>
        <div className="-mt-8 mb-6">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E8A020]/10 border border-[#E8A020]/20">
            <span className="text-3xl">🔍</span>
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-[#1C1C1E] mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.<br />
          Let's get you back on track.
        </p>

        <div
          id="not-found-button-group"
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button
            onClick={() => setLocation("/")}
            className="gradient-amber text-white border-0 hover:opacity-90 flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Homepage
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 bg-white"
          >
            <LayoutDashboard className="w-4 h-4" />
            Open Dashboard
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-500"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          TrueAxis HQ · <a href="/help" className="underline hover:text-[#E8A020]">Help Center</a> · <a href="/contact" className="underline hover:text-[#E8A020]">Contact Support</a>
        </p>
      </div>
    </div>
  );
}
