import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppSidebar } from "@/components/AppSidebar";
import { TradingHeader } from "@/components/TradingHeader";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePortfolio } from "@/hooks/useApi";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Bots from "@/pages/Bots";
import Markets from "@/pages/Markets";
import Analytics from "@/pages/Analytics";

function Router() {
  // Initialize WebSocket connection
  useWebSocket();

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/bots" component={Bots} />
      <Route path="/markets" component={Markets} />
      <Route path="/analytics" component={Analytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data: portfolio } = usePortfolio("paper");

  return (
    <div className="flex flex-col md:flex-row h-screen w-full">
      <div className="md:hidden sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-2">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <span className="text-sm text-muted-foreground">
            CryptoML Trading
          </span>
        </div>
      </div>
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <TradingHeader balance={portfolio?.totalBalance || 100000} connected={true} />
        <div className="hidden md:flex items-center gap-2 p-2 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <span className="text-sm text-muted-foreground">
            Kraken Connected • ML Models Active
          </span>
        </div>
        <main className="flex-1 overflow-auto p-3 md:p-6">
          <Router />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="dark">
          <SidebarProvider style={style as React.CSSProperties}>
            <AppContent />
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
