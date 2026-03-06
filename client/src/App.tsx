import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider } from "./contexts/AppContext";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy-load pages for better performance
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Admin = lazy(() => import("./pages/Admin"));
const Billing = lazy(() => import("./pages/Billing"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));

function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-label="Loading page"
    >
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-[#00C9A7] animate-spin mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public */}
        <Route path="/" component={Home} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/book/:username" component={BookingPage} />
        <Route path="/success" component={CheckoutSuccess} />

        {/* Authenticated user pages */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/dashboard/:section" component={Dashboard} />
        <Route path="/billing" component={Billing} />

        {/* Owner admin */}
        <Route path="/admin" component={Admin} />
        <Route path="/admin/:section" component={Admin} />

        {/* Fallbacks */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <AppProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" closeButton />
            <Router />
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
