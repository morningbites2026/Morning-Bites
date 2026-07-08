import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

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
import RecipeCosting from "@/pages/recipe-costing";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
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
        <Route path="/promotions" component={Promotions} />
        <Route path="/recipe-costing" component={RecipeCosting} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreProvider>
          <WouterRouter base={(process.env.PUBLIC_URL || "/").replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </StoreProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
