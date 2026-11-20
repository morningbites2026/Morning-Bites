import { Component, ErrorInfo, ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { Layout } from "@/components/layout";
import { AdminGuard } from "@/components/admin-guard";
import NotFound from "@/pages/not-found";

import PublicSite from "@/pages/public-site";
import Dashboard from "@/pages/dashboard";
import Billing from "@/pages/billing";
import Preorder from "@/pages/preorder";
import BillReports from "@/pages/bill-reports";
import SubDashboard from "@/pages/sub-dashboard";
import Walkins from "@/pages/walkins";
import Subscribed from "@/pages/subscribed";
import SubscriberDetail from "@/pages/subscriber-detail";
import SubReports from "@/pages/sub-reports";
import Packages from "@/pages/packages";
import Menu from "@/pages/menu";
import Promotions from "@/pages/promotions";
import BannerManager from "@/pages/banner-manager";
import RecipeCosting from "@/pages/recipe-costing";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#faf5ee] text-[#3b1e08] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl border-2 border-[#e5d8c3] shadow-lg space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold font-serif">Something went wrong</h2>
            <p className="text-xs text-slate-600">
              {this.state.error?.message || "An unexpected error occurred while loading this page."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-[#1e4d2b] text-white text-xs font-bold px-6 py-2.5 rounded-full hover:bg-[#163c22] transition shadow cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public Customer Website (Open to all, zero prices, dynamic menu, no PIN needed) */}
      <Route path="/" component={PublicSite} />

      {/* Staff & Admin Management Portal (Protected by 4-digit PIN) */}
      <Route>
        <AdminGuard>
          <Layout>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/billing" component={Billing} />
              <Route path="/preorder" component={Preorder} />
              <Route path="/bill-reports" component={BillReports} />
              <Route path="/sub-dashboard" component={SubDashboard} />
              <Route path="/walkins" component={Walkins} />
              <Route path="/subscribed" component={Subscribed} />
              <Route path="/subscriber/:id" component={SubscriberDetail} />
              <Route path="/sub-reports" component={SubReports} />
              <Route path="/packages" component={Packages} />
              <Route path="/menu" component={Menu} />
              <Route path="/banner" component={BannerManager} />
              <Route path="/promotions" component={Promotions} />
              <Route path="/recipe-costing" component={RecipeCosting} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </AdminGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreProvider>
          <ErrorBoundary>
            <WouterRouter base={(process.env.PUBLIC_URL || "/").replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </ErrorBoundary>
        </StoreProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
