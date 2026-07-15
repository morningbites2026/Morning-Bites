import { useMemo, useState, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Package, Users, UserPlus, RefreshCw, CheckCircle2, Utensils, CalendarCheck, DollarSign, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { dbGet, ActivityLog } from "@/lib/supabase";

function getISTTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

export default function SubReports() {
  const { customers, packages, customerPackages, mealSkips } = useStore();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [subDetailsExpanded, setSubDetailsExpanded] = useState(false);
  const [saladDetailsExpanded, setSaladDetailsExpanded] = useState(false);

  // Date states for custom revenue range
  const todayISO = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }, []);

  const [revenueFromDate, setRevenueFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  });
  
  const [revenueToDate, setRevenueToDate] = useState<string>(todayISO);

  const getISTDateOffsetISO = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  };

  const weeklyStartISO = useMemo(() => getISTDateOffsetISO(-7), []);
  const monthlyStartISO = useMemo(() => getISTDateOffsetISO(-30), []);

  const getSubRevenueForRange = useCallback((startISO: string, endISO: string) => {
    // 1. Calculate revenue from customerPackages
    let revenue = customerPackages
      .filter(cp => cp.status !== 'cancelled' && cp.pack_start_date >= startISO && cp.pack_start_date <= endISO)
      .reduce((sum, cp) => {
        const pkg = packages.find(p => p.id === cp.package_id);
        return sum + (pkg?.price || 0);
      }, 0);

    // 2. Add revenue from legacy customer packages (if customer has no customerPackages entries)
    customers.forEach(c => {
      if (c.status === 'active' && !c.is_deleted && c.package_id && c.pack_start_date) {
        const hasCp = customerPackages.some(cp => Number(cp.customer_id) === c.id);
        if (!hasCp) {
          if (c.pack_start_date >= startISO && c.pack_start_date <= endISO) {
            const pkg = packages.find(p => p.id === c.package_id);
            revenue += (pkg?.price || 0);
          }
        }
      }
    });

    return revenue;
  }, [customerPackages, packages, customers]);

  const getSubCountsForRange = useCallback((startISO: string, endISO: string) => {
    let newCount = 0;
    let renewCount = 0;

    // 1. Calculate counts from customerPackages
    customerPackages
      .filter(cp => cp.status !== 'cancelled' && cp.pack_start_date >= startISO && cp.pack_start_date <= endISO)
      .forEach(cp => {
        if (cp.renew_count === 0) {
          newCount++;
        } else {
          renewCount++;
        }
      });

    // 2. Add counts from legacy customer packages (if customer has no customerPackages entries)
    customers.forEach(c => {
      if (c.status === 'active' && !c.is_deleted && c.package_id && c.pack_start_date) {
        const hasCp = customerPackages.some(cp => Number(cp.customer_id) === c.id);
        if (!hasCp) {
          if (c.pack_start_date >= startISO && c.pack_start_date <= endISO) {
            if (c.renew_count === 0) {
              newCount++;
            } else {
              renewCount++;
            }
          }
        }
      }
    });

    return { newCount, renewCount };
  }, [customerPackages, customers]);

  const weeklyRevenue = useMemo(() => getSubRevenueForRange(weeklyStartISO, todayISO), [weeklyStartISO, todayISO, getSubRevenueForRange]);
  const monthlyRevenue = useMemo(() => getSubRevenueForRange(monthlyStartISO, todayISO), [monthlyStartISO, todayISO, getSubRevenueForRange]);
  const customPeriodRevenue = useMemo(() => getSubRevenueForRange(revenueFromDate, revenueToDate), [revenueFromDate, revenueToDate, getSubRevenueForRange]);

  const weeklyCounts = useMemo(() => getSubCountsForRange(weeklyStartISO, todayISO), [weeklyStartISO, todayISO, getSubCountsForRange]);
  const monthlyCounts = useMemo(() => getSubCountsForRange(monthlyStartISO, todayISO), [monthlyStartISO, todayISO, getSubCountsForRange]);
  const customCounts = useMemo(() => getSubCountsForRange(revenueFromDate, revenueToDate), [revenueFromDate, revenueToDate, getSubCountsForRange]);

  const customSubDetails = useMemo(() => {
    const list: Array<{ name: string; phone: string; pkgName: string; price: number; date: string; isRenew: boolean }> = [];
    
    customerPackages
      .filter(cp => cp.status !== 'cancelled' && cp.pack_start_date >= revenueFromDate && cp.pack_start_date <= revenueToDate)
      .forEach(cp => {
        const cust = customers.find(c => c.id === Number(cp.customer_id));
        const pkg = packages.find(p => p.id === cp.package_id);
        if (cust) {
          list.push({
            name: cust.name,
            phone: cust.phone,
            pkgName: pkg?.name || "Unknown Package",
            price: pkg?.price || 0,
            date: cp.pack_start_date,
            isRenew: cp.renew_count > 0
          });
        }
      });

    customers.forEach(c => {
      if (c.status === 'active' && !c.is_deleted && c.package_id && c.pack_start_date) {
        const hasCp = customerPackages.some(cp => Number(cp.customer_id) === c.id);
        if (!hasCp) {
          if (c.pack_start_date >= revenueFromDate && c.pack_start_date <= revenueToDate) {
            const pkg = packages.find(p => p.id === c.package_id);
            list.push({
              name: c.name,
              phone: c.phone,
              pkgName: pkg?.name || "Unknown Package",
              price: pkg?.price || 0,
              date: c.pack_start_date,
              isRenew: c.renew_count > 0
            });
          }
        }
      }
    });

    return list;
  }, [customerPackages, customers, packages, revenueFromDate, revenueToDate]);

  useEffect(() => {
    let active = true;
    setLoadingLogs(true);
    dbGet<ActivityLog>('activity_logs', 'action=eq.meal_used')
      .then(fetchedLogs => {
        if (active) {
          setLogs(fetchedLogs);
          setLoadingLogs(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch activity logs:", err);
        if (active) setLoadingLogs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const getISTDate = useCallback((isoStr: string) => {
    try {
      let s = isoStr.trim().replace(' ', 'T');
      if (!/Z|[+-]\d{2}(:\d{2})?$/.test(s)) s += 'Z';
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s));
    } catch {
      return isoStr.split('T')[0];
    }
  }, []);

  const getSaladNameForLog = useCallback((log: ActivityLog) => {
    if (log.meta && log.meta.package_name) {
      return log.meta.package_name;
    }
    const match = log.description.match(/(.+) used\. Now \d+\/\d+/);
    if (match) {
      const candidate = match[1].trim();
      const cleanCandidate = candidate.replace(/^\d+\s+/, '').trim();
      if (cleanCandidate !== "Meal" && !cleanCandidate.endsWith("meals")) {
        return cleanCandidate;
      }
    }
    if (log.customer_id) {
      const custCps = customerPackages.filter(cp => Number(cp.customer_id) === log.customer_id);
      const cust = customers.find(c => c.id === log.customer_id);
      const logDate = getISTDate(log.created_at);

      if (custCps.length === 1) {
        const pkg = packages.find(p => p.id === custCps[0].package_id);
        if (pkg) return pkg.name;
      } else if (custCps.length > 1) {
        const potentialCps = custCps
          .filter(cp => cp.pack_start_date <= logDate)
          .sort((a, b) => b.pack_start_date.localeCompare(a.pack_start_date));
        if (potentialCps.length > 0) {
          const pkg = packages.find(p => p.id === potentialCps[0].package_id);
          if (pkg) return pkg.name;
        }
      }
      if (cust && cust.package_id) {
        const pkg = packages.find(p => p.id === cust.package_id);
        if (pkg) return pkg.name;
      }
    }
    return "Standard Salad";
  }, [customerPackages, customers, packages, getISTDate]);

  const rangeServedSalads = useMemo(() => {
    return logs.filter(log => {
      if (log.action !== 'meal_used') return false;
      const logDate = getISTDate(log.created_at);
      return logDate >= revenueFromDate && logDate <= revenueToDate;
    });
  }, [logs, revenueFromDate, revenueToDate, getISTDate]);


  const packageServedTotals = useMemo(() => {
    const totals: { [name: string]: number } = {};
    rangeServedSalads.forEach(log => {
      const saladName = getSaladNameForLog(log);
      let qty = 1;
      if (log.meta && typeof log.meta.qty === 'number') {
        qty = log.meta.qty;
      } else {
        const match = log.description.match(/^(\d+)\s+meals\s+used/i);
        if (match) {
          qty = parseInt(match[1]);
        }
      }
      totals[saladName] = (totals[saladName] || 0) + qty;
    });
    return Object.entries(totals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [rangeServedSalads, getSaladNameForLog]);

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
      // Get all active packages for this customer
      const custPacks = customerPackages.filter(cp => Number(cp.customer_id) === c.id && cp.status === 'active');
      
      let isScheduledForAnyPack = false;
      
      if (custPacks.length > 0) {
        // If they have active packages in customer_packages, check if any of them are scheduled for tomorrow
        isScheduledForAnyPack = custPacks.some(cp => {
          if (cp.used >= cp.total) return false;
          
          const cpPrefDays = cp.preferred_days;
          const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
          return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
        });
      } else if (c.package_id && c.used < c.total) {
        // Legacy fallback
        const effectivePrefDays = c.preferred_days || [];
        isScheduledForAnyPack = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
      }

      if (!isScheduledForAnyPack) return false;

      // Check no skip for tomorrow (package-agnostic — any skip counts)
      const isSkipped = mealSkips.some(s => Number(s.customer_id) === c.id && s.skip_date === tomorrowISO && !s.unskipped);
      return !isSkipped;
    });
  }, [activeSubs, customerPackages, mealSkips, tomorrowISO, tomorrowDayIdx]);

  // Group tomorrow's customers by active package
  const activePackagesList = useMemo(() => packages.filter(p => p.is_active), [packages]);

  const prepGroups = useMemo(() => {
    return activePackagesList.map(pkg => {
      const custForPkg = tomorrowCustomers.filter(c => {
        // Get all active packages for this customer
        const custPacks = customerPackages.filter(cp => Number(cp.customer_id) === c.id && cp.status === 'active');

        if (custPacks.length > 0) {
          // Check if customer has active customer_package for this pkg
          const cp = custPacks.find(cp => cp.package_id === pkg.id && cp.used < cp.total);
          if (cp) {
            // Check if this specific package is scheduled for tomorrow
            const cpPrefDays = cp.preferred_days;
            const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
            return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
          }
          return false;
        }

        // Legacy fallback
        if (c.package_id === pkg.id && c.used < c.total) {
          const effectivePrefDays = c.preferred_days || [];
          return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
        }
        
        return false;
      });
      return { pkg, customers: custForPkg };
    }).filter(g => g.customers.length > 0);
  }, [activePackagesList, tomorrowCustomers, customerPackages, tomorrowDayIdx]);

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

        <TabsContent value="stats" className="mt-4 space-y-4">
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

          {/* Subscription Revenue Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <DollarSign className="w-5 h-5" /> Subscription Revenue
              </CardTitle>
              <CardDescription className="text-xs">
                Revenue generated from subscription packages and renewals.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Daily / Weekly / Monthly Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 border border-border p-3 rounded-xl text-center space-y-0.5">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Weekly Revenue (7 Days)</div>
                  <div className="text-xl font-black text-foreground">₹{weeklyRevenue}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {weeklyCounts.newCount} New · {weeklyCounts.renewCount} Renewed
                  </div>
                </div>
                <div className="bg-muted/30 border border-border p-3 rounded-xl text-center space-y-0.5">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Monthly Revenue (30 Days)</div>
                  <div className="text-xl font-black text-foreground">₹{monthlyRevenue}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {monthlyCounts.newCount} New · {monthlyCounts.renewCount} Renewed
                  </div>
                </div>
              </div>

              {/* Custom Date Range Picker */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Custom Date Range
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-[9px] text-muted-foreground">From</Label>
                    <Input
                      type="date"
                      value={revenueFromDate}
                      onChange={e => setRevenueFromDate(e.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[9px] text-muted-foreground">To</Label>
                    <Input
                      type="date"
                      value={revenueToDate}
                      onChange={e => setRevenueToDate(e.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                </div>
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-primary">Selected Period Revenue</span>
                    <span className="text-lg font-black text-primary">₹{customPeriodRevenue}</span>
                  </div>
                  <div className="text-[10px] text-primary/80 border-t border-primary/10 pt-1.5 flex justify-between">
                    <span>New Subscriptions: <strong>{customCounts.newCount}</strong></span>
                    <span>Renewals: <strong>{customCounts.renewCount}</strong></span>
                  </div>
                </div>

                {/* Collapsible Subscriber Details */}
                <div className="mt-3 pt-2 space-y-1.5 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setSubDetailsExpanded(!subDetailsExpanded)}
                    className="w-full flex items-center justify-between py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <span>Subscriber Details ({customSubDetails.length})</span>
                    {subDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  
                  {subDetailsExpanded && (
                    customSubDetails.length === 0 ? (
                      <div className="text-center p-4 text-muted-foreground text-xs italic">
                        No subscriber details found.
                      </div>
                    ) : (
                      <div className="divide-y divide-border border border-border rounded-xl max-h-48 overflow-y-auto bg-muted/10 bg-white dark:bg-card mt-1.5 animate-in slide-in-from-top-1 duration-200">
                        {customSubDetails.map((sub, i) => (
                          <div key={i} className="p-2.5 flex justify-between items-center text-xs">
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                {sub.name}
                                <Badge variant="outline" className={sub.isRenew ? "text-[9px] h-4 bg-blue-50 text-blue-700 border-blue-200" : "text-[9px] h-4 bg-green-50 text-green-700 border-green-200"}>
                                  {sub.isRenew ? "Renewal" : "New"}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {sub.pkgName} · {sub.date}
                              </div>
                            </div>
                            <div className="font-bold text-foreground">₹{sub.price}</div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Collapsible Served Salad Details */}
                <div className="mt-4 pt-2 space-y-1.5 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setSaladDetailsExpanded(!saladDetailsExpanded)}
                    className="w-full flex items-center justify-between py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <span>Served Salad Details ({rangeServedSalads.length})</span>
                    {saladDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                         {saladDetailsExpanded && (
                    loadingLogs ? (
                      <div className="text-center p-4 text-muted-foreground text-xs italic">
                        Loading served salads...
                      </div>
                    ) : packageServedTotals.length === 0 ? (
                      <div className="text-center p-4 text-muted-foreground text-xs italic">
                        No salads served in this period.
                      </div>
                    ) : (
                      <div className="space-y-4 mt-1.5 animate-in slide-in-from-top-1 duration-200">
                        <div className="divide-y divide-border border border-border rounded-xl bg-white dark:bg-card">
                          {packageServedTotals.map(total => (
                            <div key={total.name} className="p-2.5 flex justify-between items-center text-xs">
                              <span className="font-semibold text-foreground">{total.name}</span>
                              <Badge variant="secondary" className="text-[10px] h-5 font-bold">
                                {total.total} {total.total === 1 ? 'salad' : 'salads'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
            // Accordion per active package
            <Accordion type="multiple" defaultValue={prepGroups.map(g => `pkg-${g.pkg.id}`)} className="w-full space-y-3">
              {prepGroups.map(g => (
                <AccordionItem key={g.pkg.id} value={`pkg-${g.pkg.id}`} className="border border-border rounded-xl px-4 bg-card shadow-sm">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex justify-between items-center w-full pr-4">
                      <span className="font-bold text-sm text-foreground">{g.pkg.name}</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-bold ml-2">
                        {g.customers.length} customer{g.customers.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 border-t border-border">
                    <div className="space-y-1.5">
                      {g.customers.map((c, idx) => {
                        const cp = customerPackages.find(cp => Number(cp.customer_id) === c.id && cp.package_id === g.pkg.id && cp.status === 'active');
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
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
