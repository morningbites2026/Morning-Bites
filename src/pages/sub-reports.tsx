import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package, Users, UserPlus, RefreshCw, CheckCircle2, Utensils, CalendarCheck } from "lucide-react";

function getISTTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

export default function SubReports() {
  const { customers, packages, customerPackages, mealSkips } = useStore();

  const activeSubs = customers.filter(c => c.status === 'active' && !c.is_deleted);
  const activePacks = activeSubs.filter(c => c.used < c.total);
  const newlySub = activeSubs.filter(c => c.renew_count === 0);
  const renewCustomers = activeSubs.filter(c => c.renew_count > 0);

  const totalMealsServed = (() => {
    if (customerPackages.length > 0) {
      return customerPackages.reduce((s, cp) => s + cp.used, 0);
    }
    return customers.filter(c => !c.is_deleted).reduce((s, c) => s + c.used, 0);
  })();

  const numPackages = packages.filter(p => p.is_active).length;

  const stats = [
    {
      label: "Packages Available",
      value: numPackages,
      icon: <Package className="w-5 h-5" />,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/20",
      border: "border-violet-200 dark:border-violet-900/40"
    },
    {
      label: "Total Subscribed",
      value: activeSubs.length,
      icon: <Users className="w-5 h-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-900/40"
    },
    {
      label: "Newly Subscribed",
      value: newlySub.length,
      icon: <UserPlus className="w-5 h-5" />,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/20",
      border: "border-green-200 dark:border-green-900/40"
    },
    {
      label: "Active Packs",
      value: activePacks.length,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-primary",
      bg: "bg-primary/5",
      border: "border-primary/20"
    },
    {
      label: "Renewed Customers",
      value: renewCustomers.length,
      icon: <RefreshCw className="w-5 h-5" />,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      border: "border-orange-200 dark:border-orange-900/40"
    },
    {
      label: "Meals Served",
      value: totalMealsServed,
      icon: <Utensils className="w-5 h-5" />,
      color: "text-secondary-foreground",
      bg: "bg-secondary/10",
      border: "border-secondary/30"
    },
  ];

  const tomorrowISO = useMemo(() => getISTTomorrowISO(), []);
  const tomorrowDayIdx = useMemo(() => {
    const d = new Date(tomorrowISO + 'T00:00:00');
    return (d.getDay() + 6) % 7; // 0=Mon, 5=Sat
  }, [tomorrowISO]);

  const tomorrowDayLabel = useMemo(() => {
    return new Date(tomorrowISO + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' });
  }, [tomorrowISO]);

  // Customers scheduled for tomorrow: active, not done, day matches, not skipped
  const tomorrowCustomers = useMemo(() => {
    return activeSubs.filter(c => {
      // Get meals data — prefer customer_packages aggregate
      const custPacks = customerPackages.filter(cp => cp.customer_id === c.id && cp.status === 'active');
      const hasMealsLeft = custPacks.length > 0
        ? custPacks.some(cp => cp.used < cp.total)
        : c.used < c.total;
      if (!hasMealsLeft) return false;

      // Check if tomorrow is a scheduled day
      const scheduled = c.preferred_days.length === 0 || c.preferred_days.includes(tomorrowDayIdx);
      if (!scheduled) return false;

      // Check no skip for tomorrow (package-agnostic — any skip counts)
      const isSkipped = mealSkips.some(s => s.customer_id === c.id && s.skip_date === tomorrowISO && !s.unskipped);
      return !isSkipped;
    });
  }, [activeSubs, customerPackages, mealSkips, tomorrowISO, tomorrowDayIdx]);

  // Group tomorrow's customers by active package
  const activePackagesList = useMemo(() => packages.filter(p => p.is_active), [packages]);

  const prepGroups = useMemo(() => {
    return activePackagesList.map(pkg => {
      const custForPkg = tomorrowCustomers.filter(c => {
        // Check if customer has active customer_package for this pkg
        const hasCp = customerPackages.some(cp =>
          cp.customer_id === c.id &&
          cp.package_id === pkg.id &&
          cp.status === 'active' &&
          cp.used < cp.total
        );
        // Also check legacy customers.package_id
        const hasLegacy = !hasCp && c.package_id === pkg.id;
        return hasCp || hasLegacy;
      });
      return { pkg, customers: custForPkg };
    }).filter(g => g.customers.length > 0);
  }, [activePackagesList, tomorrowCustomers, customerPackages]);

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-8">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Sub Reports
      </h2>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-2 rounded-xl">
          <TabsTrigger value="stats" className="rounded-lg text-xs">Stats</TabsTrigger>
          <TabsTrigger value="prep" className="rounded-lg text-xs">
            Prep Tomorrow ({tomorrowCustomers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.map(s => (
              <Card key={s.label} className={`border ${s.border} ${s.bg} shadow-sm`}>
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${s.color}`}>
                    {s.icon} {s.label}
                  </div>
                  <div className="text-3xl font-black text-foreground">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prep" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-xl border border-border">
            <CalendarCheck className="w-4 h-4 text-primary shrink-0" />
            <span>Customers scheduled for <span className="font-bold text-foreground">{tomorrowDayLabel}</span></span>
          </div>

          {tomorrowCustomers.length === 0 ? (
            <div className="text-center p-10 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
              <CalendarCheck className="w-10 h-10 opacity-30 mx-auto mb-2" />
              <p className="text-sm">No subscribers scheduled for tomorrow.</p>
            </div>
          ) : prepGroups.length === 0 ? (
            // Fallback: no package assignments, show flat list
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  All Customers ({tomorrowCustomers.length})
                </div>
                {tomorrowCustomers.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <div className="font-semibold text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            // Tabs per active package
            <Tabs defaultValue={`pkg-${prepGroups[0].pkg.id}`} className="w-full">
              <TabsList className={`w-full bg-muted/50 p-1 rounded-xl grid grid-cols-${Math.min(prepGroups.length, 3)}`}>
                {prepGroups.map(g => (
                  <TabsTrigger key={g.pkg.id} value={`pkg-${g.pkg.id}`} className="rounded-lg text-[11px] truncate">
                    {g.pkg.name} ({g.customers.length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {prepGroups.map(g => (
                <TabsContent key={g.pkg.id} value={`pkg-${g.pkg.id}`} className="mt-3">
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-sm font-bold">{g.pkg.name}</div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-bold">
                          {g.customers.length} customer{g.customers.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {g.customers.map((c, idx) => {
                        const cp = customerPackages.find(cp => cp.customer_id === c.id && cp.package_id === g.pkg.id && cp.status === 'active');
                        const used = cp ? cp.used : c.used;
                        const total = cp ? cp.total : c.total;
                        return (
                          <div key={c.id} className="py-2 border-b border-border last:border-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">{c.name}</div>
                                <div className="text-xs text-muted-foreground">{c.phone}</div>
                                {cp?.instruction && (
                                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic flex items-center gap-1">
                                    📝 {cp.instruction}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-right text-muted-foreground shrink-0">
                                <div className="font-bold text-foreground">{total - used} left</div>
                                <div>{used}/{total} used</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
