import { useMemo, useState, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Package, Users, UserPlus, RefreshCw, CheckCircle2, Utensils, CalendarCheck, DollarSign, Calendar, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { dbGet, ActivityLog, Package as DbPackage, getScheduleMode, getStartingSaladKey } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

function getISTTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

export default function SubReports() {
  const { customers, packages, customerPackages, mealSkips, preorders, menuItems } = useStore();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [subDetailsExpanded, setSubDetailsExpanded] = useState(false);
  const [saladDetailsExpanded, setSaladDetailsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "stats";
  });

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

  const normalizeToISO = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (trimmed.includes('-')) {
      return trimmed.split('T')[0];
    }
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return trimmed;
  }, []);

  const getSubRevenueForRange = useCallback((startISO: string, endISO: string) => {
    // 1. Calculate revenue from customerPackages
    let revenue = 0;
    customerPackages.forEach(cp => {
      if (cp.status !== 'cancelled' && cp.pack_start_date) {
        const parsedDate = normalizeToISO(cp.pack_start_date);
        if (parsedDate >= startISO && parsedDate <= endISO) {
          const pkg = packages.find(p => p.id === cp.package_id);
          revenue += (pkg?.price || 0);
        }
      }
    });

    // 2. Add revenue from legacy customer packages (if customer has no customerPackages entries)
    customers.forEach(c => {
      if ((c.status === 'active' || c.status === 'hold') && !c.is_deleted && c.package_id && c.pack_start_date) {
        const hasCp = customerPackages.some(cp => Number(cp.customer_id) === c.id);
        if (!hasCp) {
          const parsedDate = normalizeToISO(c.pack_start_date);
          if (parsedDate >= startISO && parsedDate <= endISO) {
            const pkg = packages.find(p => p.id === c.package_id);
            revenue += (pkg?.price || 0);
          }
        }
      }
    });

    return revenue;
  }, [customerPackages, packages, customers, normalizeToISO]);

  const getSubCountsForRange = useCallback((startISO: string, endISO: string) => {
    let newCount = 0;
    let renewCount = 0;

    // 1. Calculate counts from customerPackages
    customerPackages.forEach(cp => {
      if (cp.status !== 'cancelled' && cp.pack_start_date) {
        const parsedDate = normalizeToISO(cp.pack_start_date);
        if (parsedDate >= startISO && parsedDate <= endISO) {
          if (cp.renew_count === 0) {
            newCount++;
          } else {
            renewCount++;
          }
        }
      }
    });

    // 2. Add counts from legacy customer packages (if customer has no customerPackages entries)
    customers.forEach(c => {
      if ((c.status === 'active' || c.status === 'hold') && !c.is_deleted && c.package_id && c.pack_start_date) {
        const hasCp = customerPackages.some(cp => Number(cp.customer_id) === c.id);
        if (!hasCp) {
          const parsedDate = normalizeToISO(c.pack_start_date);
          if (parsedDate >= startISO && parsedDate <= endISO) {
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
  }, [customerPackages, customers, normalizeToISO]);

  const weeklyRevenue = useMemo(() => getSubRevenueForRange(weeklyStartISO, todayISO), [weeklyStartISO, todayISO, getSubRevenueForRange]);
  const monthlyRevenue = useMemo(() => getSubRevenueForRange(monthlyStartISO, todayISO), [monthlyStartISO, todayISO, getSubRevenueForRange]);
  const customPeriodRevenue = useMemo(() => getSubRevenueForRange(revenueFromDate, revenueToDate), [revenueFromDate, revenueToDate, getSubRevenueForRange]);

  const weeklyCounts = useMemo(() => getSubCountsForRange(weeklyStartISO, todayISO), [weeklyStartISO, todayISO, getSubCountsForRange]);
  const monthlyCounts = useMemo(() => getSubCountsForRange(monthlyStartISO, todayISO), [monthlyStartISO, todayISO, getSubCountsForRange]);
  const customCounts = useMemo(() => getSubCountsForRange(revenueFromDate, revenueToDate), [revenueFromDate, revenueToDate, getSubCountsForRange]);

  const customSubDetails = useMemo(() => {
    const list: Array<{ name: string; phone: string; pkgName: string; price: number; date: string; isRenew: boolean }> = [];
    
    customerPackages.forEach(cp => {
      if (cp.status !== 'cancelled' && cp.pack_start_date) {
        const parsedDate = normalizeToISO(cp.pack_start_date);
        if (parsedDate >= revenueFromDate && parsedDate <= revenueToDate) {
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
        }
      }
    });

    customers.forEach(c => {
      if ((c.status === 'active' || c.status === 'hold') && !c.is_deleted && c.package_id && c.pack_start_date) {
        const hasCp = customerPackages.some(cp => Number(cp.customer_id) === c.id);
        if (!hasCp) {
          const parsedDate = normalizeToISO(c.pack_start_date);
          if (parsedDate >= revenueFromDate && parsedDate <= revenueToDate) {
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
  }, [customerPackages, customers, packages, revenueFromDate, revenueToDate, normalizeToISO]);

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
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      }
    } catch {}
    // Safe fallback if parsing fails: extract YYYY-MM-DD
    const match = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    return isoStr.split('T')[0].split(' ')[0];
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
          .filter(cp => normalizeToISO(cp.pack_start_date) <= logDate)
          .sort((a, b) => normalizeToISO(b.pack_start_date).localeCompare(normalizeToISO(a.pack_start_date)));
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
  }, [customerPackages, customers, packages, getISTDate, normalizeToISO]);

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

  const activeSubs = customers.filter(c => (c.status === 'active' || c.status === 'hold') && !c.is_deleted);
  const activePacks = activeSubs.filter(c => c.used < c.total);
  const newlySub = activeSubs.filter(c => c.renew_count === 0);
  const renewCustomers = activeSubs.filter(c => c.renew_count > 0);

  const totalMealsServed = useMemo(() => {
    return logs.reduce((sum, log) => {
      let qty = 1;
      if (log.meta && typeof log.meta.qty === 'number') {
        qty = log.meta.qty;
      } else {
        const match = log.description.match(/^(\d+)\s+meals\s+used/i);
        if (match) {
          qty = parseInt(match[1]);
        }
      }
      return sum + qty;
    }, 0);
  }, [logs]);

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

  const [targetDate, setTargetDate] = useState<string>(() => getISTTomorrowISO());
  const tomorrowISO = targetDate;
  const tomorrowDayIdx = useMemo(() => {
    const d = new Date(targetDate + 'T00:00:00');
    return (d.getDay() + 6) % 7; // 0=Mon, 5=Sat
  }, [targetDate]);

  const tomorrowDayLabel = useMemo(() => {
    return new Date(targetDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' });
  }, [targetDate]);

  const handleShareWhatsApp = () => {
    let msg = `📢 *Prep List for ${tomorrowDayLabel}*\n\n`;
    
    prepGroups.forEach(g => {
      const totalQty = g.customers.reduce((sum, item) => sum + (item.qty || 1), 0);
      msg += `🥗 *${g.name}* (${totalQty} pack${totalQty !== 1 ? 's' : ''})\n`;
      g.customers.forEach((c: any) => {
        if (c.isPreorder) {
          msg += `  • [PREORDER] ${c.customerName} (Qty: ${c.qty})${c.notes ? ` - _📝 ${c.notes}_` : ''}\n`;
        } else {
          msg += `  • ${c.customer.name}${c.qty > 1 ? ` (x${c.qty})` : ''}${c.instruction ? ` - _📝 ${c.instruction}_` : ''}\n`;
        }
      });
      msg += '\n';
    });

    if (prepGroups.length === 0) {
      msg += `No items scheduled for this day.`;
    }

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Customers scheduled for tomorrow: active, not done, day matches, not skipped
  const tomorrowCustomers = useMemo(() => {
    return activeSubs.filter(c => {
      if (c.status !== 'active') return false;
      const hasAnyCustPacks = customerPackages.some(cp => Number(cp.customer_id) === c.id);
      
      let isScheduledForAnyPack = false;
      
      if (hasAnyCustPacks) {
        const custPacks = customerPackages.filter(cp => Number(cp.customer_id) === c.id && cp.status === 'active');
        isScheduledForAnyPack = custPacks.some(cp => {
          if (cp.used >= cp.total) return false;
          
          const mode = getScheduleMode(cp);
          if (mode === 'default') {
            const cpPrefDays = cp.preferred_days;
            const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null && cpPrefDays.length > 0) ? cpPrefDays : (c.preferred_days || []);
            return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
          }
          
          if (cp.salad_schedules && Object.keys(cp.salad_schedules).length > 0) {
            return Object.values(cp.salad_schedules).some((days: any) => {
              return Array.isArray(days) && (days.length === 0 || days.includes(tomorrowDayIdx));
            });
          }

          const cpPrefDays = cp.preferred_days;
          const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
          return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
        });
      } else if (c.package_id && c.used < c.total && c.status === 'active') {
        const effectivePrefDays = c.preferred_days || [];
        isScheduledForAnyPack = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
      }

      if (!isScheduledForAnyPack) return false;

      const isSkipped = mealSkips.some(s => Number(s.customer_id) === c.id && s.skip_date === tomorrowISO && !s.unskipped);
      return !isSkipped;
    });
  }, [activeSubs, customerPackages, mealSkips, tomorrowISO, tomorrowDayIdx]);

  const tomorrowPreorderSalads = useMemo(() => {
    return preorders.filter(po => {
      if (po.pickup_date !== tomorrowISO || po.is_fulfilled || po.is_cancelled) return false;
      const saladItems = po.items.filter((it: any) => {
        const mi = menuItems.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        return mi?.type === 'salad';
      });
      return saladItems.length > 0;
    }).map(po => {
      const saladItems = po.items.filter((it: any) => {
        const mi = menuItems.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        return mi?.type === 'salad';
      });
      return { ...po, saladItems };
    });
  }, [preorders, menuItems, tomorrowISO]);



  const getPackageSaladOptions = (pkg?: DbPackage | null) => {
    if (!pkg) return [];
    if (pkg.salad_options && pkg.salad_options.length > 0) {
      return pkg.salad_options;
    }
    if (pkg.salad_ids && pkg.salad_ids.length > 0) {
      return pkg.salad_ids.map(id => ({ id, option: "Regular" }));
    }
    return [];
  };

  const prepGroups = useMemo(() => {
    const groupMap = new Map<string, { id: string; name: string; type: 'salad' | 'package'; customers: any[] }>();

    // 1. Group subscription customers
    tomorrowCustomers.forEach(c => {
      const hasAnyCustPacks = customerPackages.some(cp => Number(cp.customer_id) === c.id);

      if (hasAnyCustPacks) {
        const custPacks = customerPackages.filter(cp => Number(cp.customer_id) === c.id && cp.status === 'active' && cp.used < cp.total);
        custPacks.forEach(cp => {
          const pkg = packages.find(p => p.id === cp.package_id);
          if (!pkg) return;

          const pkgSaladOptions = getPackageSaladOptions(pkg);
          if (pkgSaladOptions.length > 0) {
            const mode = getScheduleMode(cp);
            if (mode === 'default') {
              const cpPrefDays = cp.preferred_days;
              const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null && cpPrefDays.length > 0) ? cpPrefDays : (c.preferred_days || []);
              const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
              if (isScheduled) {
                const freq = cp.frequency || 1;
                const deliveryIndex = Math.floor(cp.used / freq);
                const startSaladKey = getStartingSaladKey(cp);
                let startIdx = 0;
                if (startSaladKey) {
                  const foundIdx = pkgSaladOptions.findIndex((opt: any) => `${opt.id}:${opt.option}` === startSaladKey);
                  if (foundIdx >= 0) startIdx = foundIdx;
                }
                const rotatedSaladIdx = (deliveryIndex + startIdx) % pkgSaladOptions.length;
                const opt = pkgSaladOptions[rotatedSaladIdx];
                if (opt) {
                  const saladKey = `${opt.id}:${opt.option}`;
                  const saladItem = menuItems.find(mi => mi.id === opt.id);
                  const baseName = saladItem ? saladItem.name : `Salad ID ${opt.id}`;
                  const name = opt.option && opt.option.toLowerCase() !== 'regular'
                    ? `${baseName} – ${opt.option}`
                    : baseName;
                  const groupId = `salad-${saladKey}`;
                  if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
                  }
                  groupMap.get(groupId)!.customers.push({
                    isPreorder: false,
                    customer: c,
                    cp,
                    instruction: cp.instruction || '',
                    used: cp.used,
                    total: cp.total,
                    qty: freq
                  });
                }
              }
            } else {
              pkgSaladOptions.forEach((opt: any) => {
                const saladKey = `${opt.id}:${opt.option}`;
                const saladSched = cp.salad_schedules || {};
                const days = saladSched[saladKey] || [];
                const isScheduled = days.length === 0 || days.includes(tomorrowDayIdx);
                if (isScheduled) {
                  const saladItem = menuItems.find(mi => mi.id === opt.id);
                  const baseName = saladItem ? saladItem.name : `Salad ID ${opt.id}`;
                  const name = opt.option && opt.option.toLowerCase() !== 'regular'
                    ? `${baseName} – ${opt.option}`
                    : baseName;
                  const groupId = `salad-${saladKey}`;
                  if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
                  }
                  groupMap.get(groupId)!.customers.push({
                    isPreorder: false,
                    customer: c,
                    cp,
                    instruction: cp.instruction || '',
                    used: cp.used,
                    total: cp.total,
                    qty: (cp.salad_frequencies && cp.salad_frequencies[saladKey]) || cp.frequency || 1
                  });
                }
              });
            }
          } else {
            // Fallback for package without salads
            const cpPrefDays = cp.preferred_days;
            const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
            const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
            if (isScheduled) {
              const groupId = `pkg-${pkg.id}`;
              if (!groupMap.has(groupId)) {
                groupMap.set(groupId, { id: groupId, name: pkg.name, type: 'package', customers: [] });
              }
              groupMap.get(groupId)!.customers.push({
                isPreorder: false,
                customer: c,
                cp,
                instruction: cp.instruction || '',
                used: cp.used,
                total: cp.total,
                qty: cp.frequency || 1
              });
            }
          }
        });
      } else {
        // Legacy fallback
        if (c.package_id && c.used < c.total && c.status === 'active') {
          const pkg = packages.find(p => p.id === c.package_id);
          if (pkg) {
            const effectivePrefDays = c.preferred_days || [];
            const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
            if (isScheduled) {
              const pkgSaladOptions = getPackageSaladOptions(pkg);
              if (pkgSaladOptions.length > 0) {
                pkgSaladOptions.forEach((opt: any) => {
                  const saladKey = `${opt.id}:${opt.option}`;
                  const saladItem = menuItems.find(mi => mi.id === opt.id);
                  const baseName = saladItem ? saladItem.name : `Salad ID ${opt.id}`;
                  const name = opt.option && opt.option.toLowerCase() !== 'regular'
                    ? `${baseName} – ${opt.option}`
                    : baseName;
                  const groupId = `salad-${saladKey}`;
                  if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
                  }
                  groupMap.get(groupId)!.customers.push({
                    isPreorder: false,
                    customer: c,
                    cp: null,
                    instruction: '',
                    used: c.used,
                    total: c.total
                  });
                });
              } else {
                const groupId = `pkg-${pkg.id}`;
                if (!groupMap.has(groupId)) {
                  groupMap.set(groupId, { id: groupId, name: pkg.name, type: 'package', customers: [] });
                }
                groupMap.get(groupId)!.customers.push({
                  isPreorder: false,
                  customer: c,
                  cp: null,
                  instruction: '',
                  used: c.used,
                  total: c.total
                });
              }
            }
          }
        }
      }
    });

    // 2. Group pre-order customers
    tomorrowPreorderSalads.forEach(po => {
      po.saladItems.forEach((it: any) => {
        const saladItem = menuItems.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        if (!saladItem) return;

        const option = it.option || "Regular";
        const saladKey = `${saladItem.id}:${option}`;
        const baseName = saladItem.name;
        const name = option && option.toLowerCase() !== 'regular'
          ? `${baseName} – ${option}`
          : baseName;
        const groupId = `salad-${saladKey}`;

        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
        }
        groupMap.get(groupId)!.customers.push({
          isPreorder: true,
          customerName: po.customer_name || "One-time Customer",
          phone: po.phone || "",
          qty: it.qty,
          notes: po.notes || ""
        });
      });
    });

    const sortedGroups = Array.from(groupMap.values()).map(g => {
      const parts = g.name.split(" – ");
      const base = parts[0].trim();
      const option = parts[1] ? parts[1].trim() : "";
      return { group: g, base, option };
    });

    sortedGroups.sort((a, b) => {
      const baseCompare = a.base.localeCompare(b.base, undefined, { sensitivity: 'base' });
      if (baseCompare !== 0) return baseCompare;

      const getOptionPriority = (opt: string) => {
        const lower = opt.toLowerCase();
        if (lower === 'full') return 1;
        if (lower === 'half') return 2;
        if (lower === 'regular' || lower === '') return 3;
        return 4;
      };

      const pA = getOptionPriority(a.option);
      const pB = getOptionPriority(b.option);
      if (pA !== pB) return pA - pB;

      return a.option.localeCompare(b.option, undefined, { sensitivity: 'base' });
    });

    return sortedGroups.map(pg => pg.group);
  }, [tomorrowCustomers, tomorrowPreorderSalads, customerPackages, packages, menuItems, tomorrowDayIdx]);

  const prepCount = useMemo(() => {
    return prepGroups.reduce((sum, g) => sum + g.customers.reduce((gSum, c) => gSum + (c.qty || 1), 0), 0);
  }, [prepGroups]);

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-8">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Sub Reports
      </h2>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-2 rounded-xl">
          <TabsTrigger value="stats" className="rounded-lg text-xs">Stats</TabsTrigger>
          <TabsTrigger value="prep" className="rounded-lg text-xs">
            Prep Tomorrow ({prepCount})
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
                <div className="flex flex-col sm:flex-row gap-2">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-xl border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="w-4 h-4 text-primary shrink-0" />
              <span>Preparation list for <span className="font-bold text-foreground">{tomorrowDayLabel}</span></span>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="h-9 px-3 rounded-lg text-xs font-bold border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
              </Button>
              <div className="flex items-center gap-2">
                <Label htmlFor="targetDate" className="text-xs font-bold text-muted-foreground shrink-0 ml-2">Select Date:</Label>
                <Input
                  type="date"
                  id="targetDate"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-9 w-40 rounded-lg text-xs font-semibold cursor-pointer"
                />
              </div>
            </div>
          </div>

          {tomorrowCustomers.length === 0 && tomorrowPreorderSalads.length === 0 ? (
            <div className="text-center p-10 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
              <CalendarCheck className="w-10 h-10 opacity-30 mx-auto mb-2" />
              <p className="text-sm">No subscribers or pre-ordered salads scheduled for this date.</p>
            </div>
          ) : prepGroups.length === 0 ? (
            // Fallback: no package assignments, show flat list of subscribers
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  All Subscribers ({tomorrowCustomers.length})
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
            // Accordion per active item (Salad or Package fallback)
            <Accordion type="multiple" defaultValue={[...prepGroups.map(g => g.id)]} className="w-full space-y-3">
              {prepGroups.map(g => {
                const totalQty = g.customers.reduce((sum, item) => sum + (item.qty || 1), 0);
                return (
                  <AccordionItem key={g.id} value={g.id} className="border border-border rounded-xl px-4 bg-card shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex justify-between items-center w-full pr-4">
                        <span className="font-bold text-sm text-foreground">{g.name}</span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-bold ml-2">
                          {totalQty} pack{totalQty !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 border-t border-border">
                      <div className="space-y-1.5">
                        {g.customers.map((c, idx) => {
                          if (c.isPreorder) {
                            return (
                              <div key={`po-${idx}`} className="py-2 border-b border-border last:border-0 animate-in fade-in duration-200">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                                      <span>{c.customerName}</span>
                                      <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-bold">
                                        Preorder
                                      </span>
                                    </div>
                                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                                    {c.notes && (
                                      <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic flex items-center gap-1">
                                        📝 {c.notes}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-right shrink-0 font-bold text-foreground">
                                    Qty: {c.qty}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          const { customer, instruction, used, total, qty } = c;
                          return (
                            <div key={`sub-${customer.id}-${idx}`} className="py-2 border-b border-border last:border-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                                    <span>{customer.name}</span>
                                    {qty > 1 && (
                                      <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-100 rounded-md font-bold">
                                        Qty: {qty}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{customer.phone}</div>
                                  {instruction && (
                                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic flex items-center gap-1">
                                      📝 {instruction}
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
                );
              })}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
