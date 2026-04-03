import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider } from "./contexts/AppContext";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy-load pages for better performance and code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Admin = lazy(() => import("./pages/Admin"));
const Billing = lazy(() => import("./pages/Billing"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Help = lazy(() => import("./pages/Help"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));

// ─── Full-screen page loader ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-label="Loading page"
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#E8A020]/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-6 h-6 text-[#E8A020] animate-spin" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// ─── Skip to main content link (accessibility) ────────────────────────────────
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#E8A020] focus:text-white focus:font-semibold focus:shadow-lg focus:outline-none"
    >
      Skip to main content
    </a>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public routes */}
        <Route path="/" component={Home} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/book/:username" component={BookingPage} />
        <Route path="/success" component={CheckoutSuccess} />

        {/* Authenticated user routes */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/dashboard/:section" component={Dashboard} />
        <Route path="/billing" component={Billing} />

        {/* Owner admin routes */}
        <Route path="/admin" component={Admin} />
        <Route path="/admin/:section" component={Admin} />

        {/* Info pages */}
        <Route path="/about" component={About} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/help" component={Help} />
        <Route path="/contact" component={Contact} />

        {/* Client Portal — public, token-gated */}
        <Route path="/portal/:token" component={ClientPortal} />

        {/* Auth routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* Fallbacks */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <AppProvider>
          <TooltipProvider>
            {/* Accessibility: skip link */}
            <SkipLink />

            {/* Network status banner */}
            <OfflineBanner />

            {/* Toast notifications */}
            <Toaster
              richColors
              position="top-right"
              closeButton
              toastOptions={{
                duration: 4000,
                classNames: {
                  toast: "font-sans text-sm",
                },
              }}
            />

            {/* Main app */}
            <main id="main-content">
              <Router />
            </main>
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
