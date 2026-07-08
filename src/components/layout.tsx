import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Search, LayoutDashboard, Receipt, BarChart2, CalendarDays, Users, Leaf, TrendingUp, Package, UtensilsCrossed, Megaphone, ClipboardList, Menu, X, Calculator } from "lucide-react";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/billing", label: "Billing", icon: Receipt },
  { path: "/preorder", label: "Preorder", icon: ClipboardList },
  { path: "/bill-reports", label: "Bill Reports", icon: BarChart2 },
  { path: "/sub-dashboard", label: "Schedule", icon: CalendarDays },
  { path: "/walkins", label: "Walk-ins", icon: Users },
  { path: "/subscribed", label: "Subscribed", icon: Leaf },
  { path: "/sub-reports", label: "Sub Reports", icon: TrendingUp },
  { path: "/packages", label: "Packages", icon: Package },
  { path: "/menu", label: "Menu", icon: UtensilsCrossed },
  { path: "/promotions", label: "Promotions", icon: Megaphone },
  { path: "/recipe-costing", label: "Recipe Costing", icon: Calculator },
];

const primaryTabs = tabs.filter(t => ['/billing', '/bill-reports', '/subscribed'].includes(t.path));

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { customers, walkins, isLoading, error, searchQuery, setSearchQuery } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeSubs = customers.filter(c => c.status === 'active');
  const lowMeals = activeSubs.filter(c => (c.total - c.used) <= 2 && c.used < c.total).length;
  const packDone = activeSubs.filter(c => c.used >= c.total).length;

  return (
    <div className="min-h-[100dvh] bg-background w-full max-w-[500px] md:max-w-none mx-auto shadow-xl md:shadow-none flex flex-col relative pb-10 md:pb-0 overflow-x-hidden">
      <header className="sticky top-0 z-50 flex flex-col" style={{ background: 'linear-gradient(135deg, #1a5c2a 0%, #2d8a45 100%)' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shadow-md">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-serif tracking-wide text-white">Morning Bites</h1>
          </div>
          <div className={cn(
            "text-xs font-bold px-3 py-1.5 rounded-full border",
            isLoading ? "bg-white/10 text-white/70 border-white/20" :
              error ? "bg-red-500/20 text-red-200 border-red-400/30" :
                "bg-white/15 text-white border-white/25"
          )}>
            {isLoading ? "Connecting..." : error ? "Error" : "ONLINE"}
          </div>
        </div>

        <div className="px-4 pb-2 md:px-8">
          <div className="relative md:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              placeholder="Search name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border-white/15 text-white placeholder:text-white/40 pl-10 rounded-full h-10 focus-visible:ring-secondary focus-visible:bg-white/15"
            />
          </div>
        </div>

        <div className="flex px-3 pb-2 gap-2 overflow-x-auto hide-scrollbar md:px-8">
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 shrink-0">
            <span className="text-white/60 text-[11px] font-medium">Walk-ins</span>
            <span className="text-white text-[11px] font-black">{walkins.length}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 shrink-0">
            <span className="text-white/60 text-[11px] font-medium">Active</span>
            <span className="text-white text-[11px] font-black">{activeSubs.length}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0",
            lowMeals > 0 ? "bg-secondary/90" : "bg-white/10"
          )}>
            <span className={cn("text-[11px] font-medium", lowMeals > 0 ? "text-primary" : "text-white/60")}>Low</span>
            <span className={cn("text-[11px] font-black", lowMeals > 0 ? "text-primary" : "text-white")}>{lowMeals}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 shrink-0">
            <span className="text-white/60 text-[11px] font-medium">Done</span>
            <span className="text-white text-[11px] font-black">{packDone}</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-white border-b border-border">
          {/* Mobile: show only primary 3 tabs + hamburger More button */}
          <div className="flex md:hidden">
            {primaryTabs.map(tab => {
              const active = location === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex-1 justify-center",
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </Link>
              );
            })}
            <button
              onClick={() => setMenuOpen(true)}
              className={cn(
                "flex items-center gap-1 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 border-transparent transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0"
              )}
            >
              <Menu className="w-3.5 h-3.5" />
              More
            </button>
          </div>

          {/* Desktop: show all tabs */}
          <div className="hidden md:flex overflow-x-auto hide-scrollbar md:px-4">
            {tabs.map(tab => {
              const active = location === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors",
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile hamburger slide-in panel */}
      {menuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ background: 'linear-gradient(135deg, #1a5c2a 0%, #2d8a45 100%)' }}
            >
              <span className="font-bold font-serif text-xl text-white">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tabs.map(tab => {
                const active = location === tab.path;
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-5 py-4 text-sm font-semibold border-b border-border/50 transition-colors",
                      active
                        ? "bg-primary/5 text-primary border-l-4 border-l-primary pl-4"
                        : "text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:max-w-5xl md:mx-auto md:w-full flex flex-col gap-4">
        {children}
      </main>
    </div>
  );
}
