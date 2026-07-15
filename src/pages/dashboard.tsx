import { useMemo, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { dbUpd, formatIST, getISTISODate, getISTDateDisplay } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarDays, IndianRupee, TrendingUp, ReceiptText, Banknote, CreditCard,
  QrCode, Share2, ClipboardList, CheckCircle2, Edit, X, ChevronDown, ChevronRight, Plus, Minus,
  Layers
} from "lucide-react";

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function openWhatsAppShare(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function prettyDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Dashboard() {
  const { bills, preorders, menuItems, customers, packages, customerPackages, expenses, refresh } = useStore();
  const { toast } = useToast();

  const todayIso = getISTISODate();
  const todayStr = getISTDateDisplay();

  const billDateToISO = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    return dateStr;
  }, []);

  const [fromDate, setFromDate] = useState<string>(() => {
    const today = getISTISODate();
    const [year, month] = today.split('-');
    return `${year}-${month}-01`;
  });
  const [toDate, setToDate] = useState<string>(getISTISODate);
  const [historySearch, setHistorySearch] = useState("");

  // Preorder edit state
  const [editPo, setEditPo] = useState<any>(null);
  const [editPoName, setEditPoName] = useState("");
  const [editPoPhone, setEditPoPhone] = useState("");
  const [editPoDate, setEditPoDate] = useState("");
  const [editPoNotes, setEditPoNotes] = useState("");
  const [editPoItems, setEditPoItems] = useState<Array<{ name: string; option: string; price: number; qty: number }>>([]);
  const [editPoExpandedGroup, setEditPoExpandedGroup] = useState<number | null>(null);
  const [isSavingPo, setIsSavingPo] = useState(false);


  // Week start date string in IST YYYY-MM-DD (Monday start)
  const wsIso = useMemo(() => {
    const [year, month, day] = todayIso.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const wsDate = new Date(Number(year), Number(month) - 1, diff);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${wsDate.getFullYear()}-${pad(wsDate.getMonth() + 1)}-${pad(wsDate.getDate())}`;
  }, [todayIso]);

  // Helper to compute subscription revenue for range
  const getSubRevenueForRange = useCallback((startISO: string, endISO: string) => {
    let revenue = 0;
    
    // 1. Modern customerPackages
    if (customerPackages && customerPackages.length > 0) {
      revenue += customerPackages
        .filter(cp => cp.status !== 'cancelled' && cp.pack_start_date >= startISO && cp.pack_start_date <= endISO)
        .reduce((sum, cp) => {
          const pkg = packages.find(p => p.id === cp.package_id);
          return sum + (pkg?.price || 0);
        }, 0);
    }

    // 2. Legacy customers fallback
    if (customers && customers.length > 0) {
      customers.forEach(c => {
        if (c.status === 'active' && !c.is_deleted && c.package_id && c.pack_start_date) {
          const hasCp = customerPackages ? customerPackages.some(cp => Number(cp.customer_id) === c.id) : false;
          if (!hasCp) {
            const parsedStartDate = billDateToISO(c.pack_start_date);
            if (parsedStartDate >= startISO && parsedStartDate <= endISO) {
              const pkg = packages.find(p => p.id === c.package_id);
              revenue += (pkg?.price || 0);
            }
          }
        }
      });
    }

    return revenue;
  }, [customerPackages, packages, customers, billDateToISO]);

  // Filter bills in IST periods
  const todayBills = bills.filter((b) => billDateToISO(b.bill_date) === todayIso);
  const todayBillRevenue = todayBills.reduce((s, b) => s + b.total_amount, 0);
  const todaySubRevenue = getSubRevenueForRange(todayIso, todayIso);
  const todayTotalRevenue = todayBillRevenue + todaySubRevenue;

  const weekBills = bills.filter((b) => {
    const bDate = billDateToISO(b.bill_date);
    return bDate >= wsIso && bDate <= todayIso;
  });
  const weekBillRevenue = weekBills.reduce((s, b) => s + b.total_amount, 0);
  const weekSubRevenue = getSubRevenueForRange(wsIso, todayIso);
  const weekTotalRevenue = weekBillRevenue + weekSubRevenue;

  const rangeBills = useMemo(() => {
    return bills.filter((b) => {
      const bDate = billDateToISO(b.bill_date);
      return (!fromDate || bDate >= fromDate) && (!toDate || bDate <= toDate);
    });
  }, [bills, fromDate, toDate, billDateToISO]);

  const rangeBillRevenue = useMemo(() => {
    return rangeBills.reduce((s, b) => s + b.total_amount, 0);
  }, [rangeBills]);

  const rangeSubRevenue = useMemo(() => {
    return getSubRevenueForRange(fromDate || '1970-01-01', toDate || '9999-12-31');
  }, [fromDate, toDate, getSubRevenueForRange]);

  const rangeTotalRevenue = useMemo(() => {
    return rangeBillRevenue + rangeSubRevenue;
  }, [rangeBillRevenue, rangeSubRevenue]);

  const rangeExpenses = useMemo(() => {
    if (!expenses) return 0;
    return expenses
      .filter(e => (!fromDate || e.expense_date >= fromDate) && (!toDate || e.expense_date <= toDate))
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, fromDate, toDate]);

  const rangeActualEarning = useMemo(() => {
    return rangeTotalRevenue - rangeExpenses;
  }, [rangeTotalRevenue, rangeExpenses]);

  // Custom range item quantity sold statistics
  const itemQuantityStats = useMemo(() => {
    const rangeCounts: { [name: string]: number } = {};
    const overallCounts: { [name: string]: number } = {};

    const getMultiplier = (name: string, option: string): number => {
      const nameLower = name.toLowerCase();
      const optionLower = (option || "").toLowerCase();

      // 1. Check if option has explicit piece count
      if (optionLower.includes("3 pieces") || optionLower === "3") {
        return 3;
      }
      if (optionLower.includes("2 pieces") || optionLower === "2") {
        return 2;
      }
      if (optionLower.includes("1 piece") || optionLower === "1") {
        return 1;
      }

      // 2. If it is an add-on for Thepla or Masala Paratha (price is ₹5, name is Butter or Butter add on)
      if (optionLower.includes("butter") && (nameLower.includes("thepla") || nameLower.includes("masala paratha"))) {
        return 0;
      }

      // 3. Main portion variants for Aloo Paratha or Sev Paratha (Oil / Butter)
      if (nameLower.includes("aloo paratha") || nameLower.includes("sev paratha")) {
        return 1;
      }

      // 4. Default fallbacks if no option matches
      if (nameLower.includes("thepla")) return 3;
      if (nameLower.includes("paratha")) return 2; // Default for Masala Paratha is 2 pieces
      
      return 1;
    };

    // 1. Process Range Bills
    rangeBills.forEach(b => {
      b.items.forEach(item => {
        const mult = getMultiplier(item.name, item.option);
        const qty = item.qty * mult;
        rangeCounts[item.name] = (rangeCounts[item.name] || 0) + qty;
      });
    });

    // 2. Process Overall Bills (all bills in the database)
    bills.forEach(b => {
      b.items.forEach(item => {
        const mult = getMultiplier(item.name, item.option);
        const qty = item.qty * mult;
        overallCounts[item.name] = (overallCounts[item.name] || 0) + qty;
      });
    });

    // Compute overall average daily sales from creation to today
    const today = getISTISODate();

    const stats = Object.keys(overallCounts).map(name => {
      const menuItem = menuItems.find(mi => mi.name.toLowerCase() === name.toLowerCase());
      
      // Default creation date to 2026-02-01 if not found
      const itemCreatedDate = menuItem?.created_at ? menuItem.created_at.split('T')[0] : '2026-02-01';
      
      // Calculate total active days from itemCreatedDate to today
      let activeDays = 1;
      if (itemCreatedDate <= today) {
        const d1 = new Date(itemCreatedDate + "T00:00:00");
        const d2 = new Date(today + "T23:59:59");
        const diffMs = d2.getTime() - d1.getTime();
        activeDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      const totalOverallQty = overallCounts[name];
      const rangeQty = rangeCounts[name] || 0;
      const averageSales = totalOverallQty / activeDays;

      return {
        name,
        rangeQty,
        totalOverallQty,
        activeDays,
        averageSales,
        itemCreatedDate
      };
    });

    // Sort by overall average daily sales descending
    return stats.sort((a, b) => b.averageSales - a.averageSales);
  }, [bills, rangeBills, menuItems]);

  const pendingAdvance = bills.filter(b => b.advance_status === 'pending').reduce((s, b) => s + (b.advance_balance || 0), 0);
  const pendingOutstanding = bills.filter(b => b.outstanding_status === 'pending').reduce((s, b) => s + (b.outstanding_balance || 0), 0);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
    const to = toDate ? new Date(toDate + "T23:59:59") : null;
    return bills
      .filter((b) => {
        const created = new Date(b.created_at);
        if (from && created < from) return false;
        if (to && created > to) return false;
        if (q) {
          if (!(b.customer_name || "walk-in").toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [bills, fromDate, toDate, historySearch]);

  const historyTotal = filteredHistory.reduce((s, b) => s + b.total_amount, 0);
  const historyCash = filteredHistory.filter((b) => b.payment_mode === "cash").reduce((s, b) => s + b.total_amount, 0);
  const historyUpi = filteredHistory.filter((b) => b.payment_mode === "upi").reduce((s, b) => s + b.total_amount, 0);
  const historyScan = filteredHistory.filter((b) => b.payment_mode === "scanpay").reduce((s, b) => s + b.total_amount, 0);

  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }, []);

  const tomorrowPreorders = useMemo(
    () => preorders.filter((p) => p.pickup_date === tomorrowIso && !p.is_fulfilled && !p.is_cancelled),
    [preorders, tomorrowIso]
  );

  const pendingPreorders = useMemo(
    () => preorders.filter((p) => !p.is_fulfilled && !p.is_cancelled)
      .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date)),
    [preorders]
  );

  const completedPreorders = useMemo(
    () => preorders.filter((p) => p.is_fulfilled || p.is_cancelled)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [preorders]
  );

  const prepSummary = useMemo(() => {
    const map = new Map<string, { name: string; option: string; qty: number }>();
    for (const po of tomorrowPreorders) {
      for (const it of po.items) {
        const k = `${it.name}||${it.option}`;
        const existing = map.get(k);
        map.set(k, existing ? { ...existing, qty: existing.qty + it.qty } : { name: it.name, option: it.option, qty: it.qty });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [tomorrowPreorders]);

  const allMenuItems = useMemo(
    () => menuItems.filter(m => m.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [menuItems]
  );

  const shareToday = () => {
    const lines = [
      `Morning Bites – Earnings`,
      ``,
      `Today (${todayStr})`,
      `Total: ₹${todayTotalRevenue}`,
      `Walk-in Bills: ₹${todayBillRevenue} (${todayBills.length} bills)`,
      `Subscriptions: ₹${todaySubRevenue}`,
      ``,
      `Walk-in Payment Breakdown:`,
      `- Cash: ₹${todayBills.filter(b => b.payment_mode === "cash").reduce((s, b) => s + b.total_amount, 0)}`,
      `- UPI: ₹${todayBills.filter(b => b.payment_mode === "upi").reduce((s, b) => s + b.total_amount, 0)}`,
      `- Scan & Pay: ₹${todayBills.filter(b => b.payment_mode === "scanpay").reduce((s, b) => s + b.total_amount, 0)}`,
    ];
    openWhatsAppShare(lines.join("\n"));
  };

  const sharePrep = () => {
    if (prepSummary.length === 0) {
      toast({ description: "No preorders for tomorrow." });
      return;
    }
    const prettyDateStr = new Date(tomorrowIso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "short", day: "2-digit" });
    const lines = [
      `Morning Bites – Tomorrow Prep`,
      prettyDateStr,
      ``,
      ...prepSummary.map(x => `- ${x.qty} × ${x.name} (${x.option})`),
      ``,
      `Preorders: ${tomorrowPreorders.length}`,
    ];
    openWhatsAppShare(lines.join("\n"));
  };

  const markFulfilled = async (id: number) => {
    try {
      await dbUpd("preorders", id, { is_fulfilled: true });
      toast({ title: "Marked fulfilled" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const cancelPreorder = async (id: number, name: string) => {
    if (!window.confirm(`Cancel preorder for "${name}"?`)) return;
    try {
      await dbUpd("preorders", id, { is_cancelled: true });
      toast({ title: "Preorder cancelled" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const openEditPo = (po: any) => {
    setEditPo(po);
    setEditPoName(po.customer_name || "");
    setEditPoPhone(po.phone || "");
    setEditPoDate(po.pickup_date);
    setEditPoNotes(po.notes || "");
    setEditPoItems(JSON.parse(JSON.stringify(po.items)));
    setEditPoExpandedGroup(null);
  };

  const editPoTotal = editPoItems.reduce((s, it) => s + it.price * it.qty, 0);

  const handleEditPoQtyChange = (idx: number, delta: number) => {
    setEditPoItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: Math.max(0, next[idx].qty + delta) };
      return next.filter((_, i) => i !== idx || next[idx].qty > 0);
    });
  };

  const handleAddMenuItemToPo = (item: any, optIdx: number) => {
    const opt = item.options[optIdx];
    const existing = editPoItems.findIndex(it => it.name === item.name && it.option === opt.name);
    if (existing >= 0) {
      const next = [...editPoItems];
      next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
      setEditPoItems(next);
    } else {
      setEditPoItems(prev => [...prev, { name: item.name, option: opt.name, price: opt.price, qty: 1 }]);
    }
  };

  const handleSaveEditPo = async () => {
    if (!editPo) return;
    if (!editPoDate) { toast({ variant: "destructive", description: "Pickup date required." }); return; }
    if (editPoItems.length === 0) { toast({ variant: "destructive", description: "Add at least one item." }); return; }
    setIsSavingPo(true);
    try {
      await dbUpd("preorders", editPo.id, {
        customer_name: editPoName || null,
        phone: editPoPhone || null,
        pickup_date: editPoDate,
        notes: editPoNotes || null,
        items: editPoItems,
        total_amount: editPoTotal,
      });
      toast({ title: "Preorder updated" });
      setEditPo(null);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setIsSavingPo(false);
    }
  };

  const PreorderCard = ({ po, showActions }: { po: any; showActions: boolean }) => (
    <Card className={cn("border-border shadow-sm overflow-hidden", po.is_cancelled && "opacity-60")}>
      <div className="p-3 bg-muted/30 flex justify-between items-center border-b border-border">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-bold text-sm truncate">{po.customer_name || "Customer"}</div>
            {po.is_cancelled && <Badge variant="destructive" className="text-[10px] shrink-0">Cancelled</Badge>}
            {po.is_fulfilled && <Badge className="text-[10px] bg-green-100 text-green-800 shrink-0">Fulfilled</Badge>}
          </div>
          {po.phone && <div className="text-[10px] text-muted-foreground">{po.phone}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-base font-black text-primary">₹{po.total_amount}</div>
          {showActions && (
            <>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEditPo(po)}>
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline" size="icon"
                className="h-7 w-7 rounded-lg border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                onClick={() => cancelPreorder(po.id, po.customer_name || "Customer")}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3 h-3" />
          Pickup: {prettyDate(po.pickup_date)}
          {po.pickup_date === tomorrowIso && <Badge className="text-[10px] bg-amber-100 text-amber-800 ml-1">Tomorrow</Badge>}
          {po.pickup_date === todayIso && <Badge className="text-[10px] bg-primary/10 text-primary ml-1">Today</Badge>}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {po.items.map((it: any, idx: number) => (
            <div key={idx}>{it.qty}× {it.name} ({it.option})</div>
          ))}
        </div>
        {showActions && (
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" className="rounded-full text-xs h-7" onClick={() => markFulfilled(po.id)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Fulfilled
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300 pb-8">
      <Tabs defaultValue="earnings" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-4 rounded-xl">
          <TabsTrigger value="earnings" className="rounded-lg text-xs">Earnings</TabsTrigger>
          <TabsTrigger value="quantity" className="rounded-lg text-xs">Quantity</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg text-xs">History</TabsTrigger>
          <TabsTrigger value="preorders" className="rounded-lg text-xs">Preorders</TabsTrigger>
        </TabsList>

        {/* ─── Earnings ─── */}
        <TabsContent value="earnings" className="mt-4 space-y-4">
          {/* Date range filter fields */}
          <Card className="border border-border shadow-sm">
            <CardContent className="p-3.5 flex flex-row items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border bg-primary text-primary-foreground shadow-md">
              <CardContent className="p-4">
                <div className="text-sm font-medium opacity-90 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4" /> Today
                </div>
                <div className="text-2xl font-black mt-1">₹{todayTotalRevenue}</div>
                <div className="text-xs opacity-90 mt-1">
                  Bills: ₹{todayBillRevenue} | Subs: ₹{todaySubRevenue}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> This Week
                </div>
                <div className="text-2xl font-black mt-1 text-foreground">₹{weekTotalRevenue}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Bills: ₹{weekBillRevenue} | Subs: ₹{weekSubRevenue}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm col-span-2">
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <ReceiptText className="w-4 h-4" /> Filtered Period
                    </div>
                    <div className="text-3xl font-black mt-1 text-primary">₹{rangeTotalRevenue}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Bills: ₹{rangeBillRevenue} | Subs: ₹{rangeSubRevenue}
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-full shrink-0" onClick={shareToday}>
                    <Share2 className="w-4 h-4 mr-2" /> Share Today
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 p-2.5 rounded-xl text-center">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase">Period Expenses</div>
                    <div className="text-lg font-black text-amber-700 dark:text-amber-500 mt-0.5">₹{rangeExpenses}</div>
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-200/50 p-2.5 rounded-xl text-center">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase">Actual Net Earning</div>
                    <div className="text-lg font-black text-green-700 dark:text-green-500 mt-0.5">₹{rangeActualEarning}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Selling Items (Average Sales) */}
          <Card className="border border-border shadow-sm col-span-2">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <TrendingUp className="w-4 h-4" /> Top Selling Items (Avg. Daily)
              </CardTitle>
              <CardDescription className="text-[10px]">
                Top 3 items based on overall average daily sales from creation to today.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 flex flex-col gap-3">
              {itemQuantityStats.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground italic">
                  No sales data available.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {itemQuantityStats.slice(0, 3).map((stat, idx) => {
                    const medalColors = [
                      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60", // Gold
                      "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/60", // Silver
                      "bg-amber-50/80 text-amber-700 border-amber-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40", // Bronze
                    ];
                    const medalLabel = ["1st", "2nd", "3rd"];
                    
                    return (
                      <div 
                        key={stat.name} 
                        className={cn(
                          "p-3 rounded-xl border flex flex-col items-center text-center gap-1.5 shadow-sm bg-gradient-to-b from-card to-muted/10",
                          idx === 0 ? "border-amber-200/60" : "border-border"
                        )}
                      >
                        <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider", medalColors[idx])}>
                          {medalLabel[idx]}
                        </span>
                        <div className="font-extrabold text-xs truncate max-w-full text-foreground mt-1">
                          {stat.name}
                        </div>
                        <div className="font-black text-sm text-primary">
                          {stat.averageSales.toFixed(1)} <span className="text-[9px] font-normal text-muted-foreground">/day</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground font-semibold">
                          {stat.totalOverallQty} total · {stat.activeDays}d
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-2 grid grid-cols-2 gap-3 mt-1">
            <Card className="border-green-200 bg-green-50 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-green-700 uppercase tracking-wider">Customer Credit</div>
                <div className="text-xl font-black text-green-800 mt-1">₹{pendingAdvance}</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-red-700 uppercase tracking-wider">Pending Amount</div>
                <div className="text-xl font-black text-red-800 mt-1">₹{pendingOutstanding}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Quantity Stats ─── */}
        <TabsContent value="quantity" className="mt-4 space-y-4">
          {/* Date range filter fields */}
          <Card className="border border-border shadow-sm">
            <CardContent className="p-3.5 flex flex-row items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-muted-foreground font-semibold uppercase">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Sales Quantity
              </CardTitle>
              <CardDescription className="text-xs">
                Overall average daily sales since creation (or Feb 2026). Adjust date range to filter the selected period sold count below.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {itemQuantityStats.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-xs">
                  No sales found in this period.
                </div>
              ) : (
                <div className="space-y-4 mt-2">
                  {itemQuantityStats.map(stat => {
                    const maxAverage = itemQuantityStats[0]?.averageSales || 1;
                    const percent = Math.min(100, Math.max(5, (stat.averageSales / maxAverage) * 100));
                    
                    return (
                      <div key={stat.name} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-sm text-foreground">{stat.name}</span>
                          <span className="font-black text-sm text-primary">{stat.averageSales.toFixed(2)} / day</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Total sold: {stat.rangeQty} qty (selected)</span>
                          <span>Overall: {stat.totalOverallQty} qty over {stat.activeDays} days</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── History ─── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
              <Input placeholder="Search customer name..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="h-9 text-sm" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Card className="border-border bg-primary text-primary-foreground">
                  <CardContent className="p-3">
                    <div className="text-xs opacity-90">Total</div>
                    <div className="text-xl font-black">₹{historyTotal}</div>
                    <div className="text-[11px] opacity-90">{filteredHistory.length} entries</div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3 space-y-2">
                    {[
                      { label: "Cash", icon: <Banknote className="w-3.5 h-3.5 text-green-600" />, rev: historyCash },
                      { label: "UPI", icon: <CreditCard className="w-3.5 h-3.5 text-blue-600" />, rev: historyUpi },
                      { label: "Scan", icon: <QrCode className="w-3.5 h-3.5 text-purple-600" />, rev: historyScan },
                    ].map(m => (
                      <div key={m.label} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 font-medium">{m.icon} {m.label}</div>
                        <div className="font-bold">₹{m.rev}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {filteredHistory.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                <ReceiptText className="w-12 h-12 opacity-20 mb-2" />
                <p>No entries found.</p>
              </div>
            ) : (
              filteredHistory.slice(0, 80).map(bill => (
                <Card key={bill.id} className="border-border shadow-sm overflow-hidden">
                  <div className="p-3 bg-muted/30 flex justify-between items-center border-b border-border">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <CalendarDays className="w-3 h-3" /> {bill.bill_date}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">{formatIST(bill.created_at)}</div>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold">
                      {bill.payment_mode === "scanpay" ? "scan & pay" : bill.payment_mode}
                    </Badge>
                  </div>
                  <CardContent className="p-4 flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="font-bold text-base truncate">{bill.customer_name || "Walk-in"}</div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {bill.items.map((it, idx) => (
                          <div key={idx} className="truncate">{it.qty}× {it.name} ({it.option}) — ₹{it.price * it.qty}</div>
                        ))}
                      </div>
                    </div>
                    <div className="text-xl font-black text-primary shrink-0">₹{bill.total_amount}</div>
                  </CardContent>
                </Card>
              ))
            )}
            {filteredHistory.length > 80 && (
              <div className="text-center text-xs text-muted-foreground">Showing latest 80. Narrow filters to see more.</div>
            )}
          </div>
        </TabsContent>

        {/* ─── Preorders ─── */}
        <TabsContent value="preorders" className="mt-4 space-y-4">
          {/* Tomorrow prep summary */}
          <Card className="border-border shadow-sm">
            <CardHeader className="p-4 pb-2 bg-muted/30">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Tomorrow Prep ({tomorrowPreorders.length})
                </span>
                <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={sharePrep}>
                  <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {prepSummary.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No preorders for tomorrow.</div>
              ) : (
                <div className="space-y-2">
                  {prepSummary.map(x => (
                    <div key={`${x.name}||${x.option}`} className="flex justify-between items-center bg-muted/30 rounded-lg p-2">
                      <div className="text-sm font-medium">{x.name} <span className="text-xs text-muted-foreground">({x.option})</span></div>
                      <div className="text-lg font-black text-primary">{x.qty}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending / Completed sub-tabs */}
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-2 rounded-xl">
              <TabsTrigger value="pending" className="rounded-lg text-xs">
                Pending ({pendingPreorders.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="rounded-lg text-xs">
                Completed ({completedPreorders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-3 space-y-3 pb-4">
              {pendingPreorders.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">No pending preorders.</div>
              ) : (
                pendingPreorders.map(po => <PreorderCard key={po.id} po={po} showActions={true} />)
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-3 space-y-3 pb-4">
              {completedPreorders.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">No completed preorders.</div>
              ) : (
                completedPreorders.map(po => <PreorderCard key={po.id} po={po} showActions={false} />)
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Preorder Modal ─── */}
      <Dialog open={!!editPo} onOpenChange={o => !o && setEditPo(null)}>
        <DialogContent className="sm:max-w-md w-[92%] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4" /> Edit Preorder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input value={editPoName} onChange={e => setEditPoName(e.target.value)} placeholder="Customer" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPoPhone} onChange={e => setEditPoPhone(e.target.value)} placeholder="10-digit" />
            </div>
            <div className="space-y-2">
              <Label>Pickup Date</Label>
              <Input type="date" value={editPoDate} onChange={e => setEditPoDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              <div className="flex flex-col gap-1.5">
                {allMenuItems.map(item => {
                  const itemQty = item.options.reduce((s: number, _: any, idx: number) => {
                    const existing = editPoItems.findIndex(it => it.name === item.name && it.option === item.options[idx].name);
                    return s + (existing >= 0 ? editPoItems[existing].qty : 0);
                  }, 0);
                  const isOpen = editPoExpandedGroup === item.id;
                  return (
                    <div key={item.id} className="rounded-xl border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setEditPoExpandedGroup(prev => prev === item.id ? null : item.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <span className="font-semibold text-sm">{item.name}</span>
                          {(item.category || 'daily') === 'week_special' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold">WS</span>
                          )}
                        </div>
                        {itemQty > 0 && (
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{itemQty}</span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-1 p-2 bg-background">
                          {item.options.map((opt: any, optIdx: number) => {
                            const existingIdx = editPoItems.findIndex(it => it.name === item.name && it.option === opt.name);
                            const qty = existingIdx >= 0 ? editPoItems[existingIdx].qty : 0;
                            return (
                              <div key={optIdx} className="flex items-center justify-between bg-muted/20 p-2 rounded-md">
                                <div>
                                  <div className="text-sm font-medium">{opt.name}</div>
                                  <div className="text-xs text-muted-foreground">₹{opt.price}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleEditPoQtyChange(existingIdx, -1)} disabled={qty === 0}>
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-5 text-center font-bold text-sm">{qty}</span>
                                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleAddMenuItemToPo(item, optIdx)}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Current items in order */}
              {editPoItems.length > 0 && (
                <div className="mt-2 p-3 bg-muted/20 rounded-xl border border-border space-y-1.5">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Order</div>
                  {editPoItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{it.name} <span className="text-muted-foreground">({it.option})</span></span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">₹{it.price * it.qty}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleEditPoQtyChange(idx, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-4 text-center font-bold text-sm">{it.qty}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleEditPoQtyChange(idx, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-border flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span className="text-primary">₹{editPoTotal}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editPoNotes} onChange={e => setEditPoNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEditPo} disabled={isSavingPo} className="w-full h-12 rounded-xl font-bold">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
