import { useState } from "react";
import { useStore } from "@/lib/store";
import { dbUpd, dbIns, dbUpdWhere, logActivity, getActivityLogs, formatIST, formatISTDate, getISTISODate, ActivityLog, UPI_ID, CustomerPackage, Package } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Undo2, SkipForward, RefreshCw, Trash2, Edit, MessageCircle, ChevronLeft, ChevronRight, History, Plus, Banknote, CreditCard, QrCode, Ban, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PaymentModeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-3 gap-2">
      {[
        { value: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
        { value: 'upi', label: 'UPI', icon: <CreditCard className="w-4 h-4" /> },
        { value: 'scanpay', label: 'Scan', icon: <QrCode className="w-4 h-4" /> },
      ].map(m => (
        <div key={m.value}>
          <RadioGroupItem value={m.value} id={`pm-sub-${m.value}`} className="peer sr-only" />
          <Label htmlFor={`pm-sub-${m.value}`} className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all text-xs font-semibold">
            {m.icon}{m.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

const buildMealUpdateMsg = (name: string, used: number, remaining: number, total: number, pkgName?: string) =>
  `Hello ${name},\n\nHere is your meal update${pkgName ? ` for *${pkgName}*` : ''}:\n✅ Meals used so far: ${used}\n🥗 Meals remaining: ${remaining}\n📦 Total meals in pack: ${total}\n\nEnjoy your fresh meals every morning and stay healthy!\n\nTiming: 6:30 AM to 9:00 AM\nCall us: 9099172237 / 9429929822\n\nThank you!`;

const buildRenewPackMsg = (name: string, remaining: number, total: number, price: number, pkgName?: string) =>
  `Hello ${name},\n\nYou currently have ${remaining} meal(s) remaining${pkgName ? ` in your *${pkgName}*` : ''}.\n\nRenew your pack today!\n🎉 ${total} fresh meals for just ₹${price}!\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nThank you!`;

const buildPackDoneMsg = (name: string, total: number, price: number, pkgName?: string) =>
  `Hello ${name},\n\nAll ${total} meals${pkgName ? ` in your *${pkgName}*` : ''} have been used.\n\nRenew today!\n🎉 ${total} fresh meals for just ₹${price}!\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nThank you!`;

const buildActiveSubMsg = (name: string, pkgName: string, total: number, price: number, startDate: string) =>
  `Hello ${name},\n\nYour ${pkgName} subscription is now active!\n\n📦 Pack: ${total} meals\n💰 Amount: ₹${price}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;

const buildActiveSubMsgMulti = (name: string, pkgs: Package[], startDate: string) => {
  const pkgsList = pkgs.map((p, i) => `${i + 1}. ${p.name} — ${p.meals_count ?? 10} meals — ₹${p.price}`).join('\n');
  const totalPrice = pkgs.reduce((s, p) => s + p.price, 0);
  const totalMeals = pkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0);
  return `Hello ${name},\n\nYour subscriptions are now active!\n\n📦 Packages:\n${pkgsList}\n\n🍽️ Total meals: ${totalMeals}\n💰 Total amount: ₹${totalPrice}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;
};

const buildRenewalMsg = (name: string, pkgName: string, total: number, price: number, startDate: string) =>
  `Hello ${name},\n\nYour subscription has been renewed!\n\n🔄 Renewal\n📦 Package: ${pkgName}\n🍽️ Meals: ${total}\n💰 Amount: ₹${price}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;

const buildRenewalMsgMulti = (name: string, pkgs: Package[], startDate: string) => {
  const pkgsList = pkgs.map((p, i) => `${i + 1}. ${p.name} — ${p.meals_count ?? 10} meals — ₹${p.price}`).join('\n');
  const totalPrice = pkgs.reduce((s, p) => s + p.price, 0);
  const totalMeals = pkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0);
  return `Hello ${name},\n\nYour subscriptions have been renewed!\n\n🔄 Renewal\n📦 Packages:\n${pkgsList}\n\n🍽️ Total meals: ${totalMeals}\n💰 Total amount: ₹${totalPrice}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;
};

export default function Subscribed() {
  const { customers, packages, walkins, mealSkips, customerPackages, refresh, searchQuery } = useStore();
  const { toast } = useToast();

  const [filter, setFilter] = useState("all");

  const [notifyModal, setNotifyModal] = useState<{ open: boolean; customer: any; type: string; cp: CustomerPackage | null }>({ open: false, customer: null, type: "", cp: null });
  const [skipModal, setSkipModal] = useState<{ open: boolean; customer: any; cp: CustomerPackage | null }>({ open: false, customer: null, cp: null });
  const [skipDate, setSkipDate] = useState(getISTISODate());
  const [skipMode, setSkipMode] = useState<'single' | 'range' | 'multi'>('single');
  const [skipRangeStart, setSkipRangeStart] = useState(getISTISODate());
  const [skipRangeEnd, setSkipRangeEnd] = useState(getISTISODate());
  const [skipMultiDates, setSkipMultiDates] = useState<string[]>([]);
  const [skipAddDate, setSkipAddDate] = useState(getISTISODate());
  const [editModal, setEditModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPkg, setEditPkg] = useState("");
  const [editMode, setEditMode] = useState<any>("");
  const [weekOffset, setWeekOffset] = useState<Record<number, number>>({});

  // selected customer_package id per customer card
  const [selectedCpId, setSelectedCpId] = useState<Record<number, number>>({});

  // Add package to existing customer (from edit modal)
  const [addPkgModal, setAddPkgModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [addPkgPkgId, setAddPkgPkgId] = useState("");
  const [addPkgPayMode, setAddPkgPayMode] = useState("cash");
  const [addPkgCash, setAddPkgCash] = useState("");
  const [addPkgQrOpen, setAddPkgQrOpen] = useState(false);

  const [cancelModal, setCancelModal] = useState<{ open: boolean; customer: any; cp: CustomerPackage | null }>({ open: false, customer: null, cp: null });

  const [addModal, setAddModal] = useState(false);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPkgIds, setAddPkgIds] = useState<number[]>([]);
  const [addPayMode, setAddPayMode] = useState("cash");
  const [addCash, setAddCash] = useState("");
  const [addQrOpen, setAddQrOpen] = useState(false);
  const [addInstructions, setAddInstructions] = useState<Record<number, string>>({});
  const [editInstructions, setEditInstructions] = useState<Record<number, string>>({});
  // Salad days: preferred delivery days per subscription
  const [addSaladDays, setAddSaladDays] = useState<number[]>([]);
  const [editSaladDaysByCp, setEditSaladDaysByCp] = useState<Record<number, number[]>>({});

  const toggleAddSaladDay = (dayIdx: number) => {
    setAddSaladDays(prev => {
      if (prev.length === 0) return [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
      if (prev.includes(dayIdx)) {
        const next = prev.filter(d => d !== dayIdx);
        return next.length === 6 ? [] : next;
      }
      const next = [...prev, dayIdx].sort();
      return next.length === 6 ? [] : next;
    });
  };

  const toggleEditSaladDay = (cpId: number, dayIdx: number) => {
    setEditSaladDaysByCp(prev => {
      const current = prev[cpId] || [];
      let next: number[];
      if (current.length === 0) {
        next = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
      } else if (current.includes(dayIdx)) {
        next = current.filter(d => d !== dayIdx);
        if (next.length === 6) next = [];
      } else {
        next = [...current, dayIdx].sort();
        if (next.length === 6) next = [];
      }
      return { ...prev, [cpId]: next };
    });
  };

  const [historyModal, setHistoryModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [historyLogs, setHistoryLogs] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [instrModal, setInstrModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [instrEdits, setInstrEdits] = useState<Record<number, string>>({});

  const [mealUsedModal, setMealUsedModal] = useState<{ open: boolean; customer: any; used: number; total: number; pkgName: string }>({ open: false, customer: null, used: 0, total: 0, pkgName: '' });
  const [useMealQty, setUseMealQty] = useState<{ [key: number]: number }>({});

  // ─── helpers ──────────────────────────────────────────────────────────────
  const activeSubs = customers.filter(c => !c.is_deleted);

  const getCustPacks = (customerId: number) =>
    customerPackages.filter(cp => cp.customer_id === customerId && cp.status !== 'cancelled')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getSelectedCp = (c: any): CustomerPackage | null => {
    const cps = getCustPacks(c.id);
    if (cps.length === 0) return null;
    return cps.find(cp => cp.id === selectedCpId[c.id]) || cps[0];
  };

  const getDisplayData = (c: any) => {
    const cp = getSelectedCp(c);
    return {
      cp,
      used: cp ? cp.used : c.used,
      total: cp ? cp.total : c.total,
      packageId: cp ? cp.package_id : c.package_id,
    };
  };

  const activePackages = packages.filter(p => p.is_active);

  const filteredSubs = activeSubs.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.phone.includes(searchQuery)) return false;
    const { used, total } = getDisplayData(c);
    if (filter === "active") return c.status === 'active' && used < total;
    if (filter === "low") return c.status === 'active' && (total - used) <= 2 && used < total;
    if (filter === "done") return c.status === 'active' && used >= total;
    if (filter === "new") return c.status === 'active' && c.renew_count === 0;
    if (filter === "renewed") return c.status === 'active' && c.renew_count > 0;
    return true;
  });

  const selectedAddPkgs = activePackages.filter(p => addPkgIds.includes(p.id));
  const addTotal = selectedAddPkgs.reduce((s, p) => s + p.price, 0);
  const addCashNum = Number(addCash) || 0;
  const addChange = addCashNum - addTotal;
  const addUpiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${addTotal}&cu=INR`;

  const selectedAddPkgPkg = activePackages.find(p => p.id.toString() === addPkgPkgId);
  const addPkgTotal = selectedAddPkgPkg?.price || 0;
  const addPkgUpiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${addPkgTotal}&cu=INR`;

  // ─── Add customer ─────────────────────────────────────────────────────────
  const handleAddCustomer = async () => {
    if (!addName.trim() || !addPhone.trim() || addPkgIds.length === 0) {
      toast({ variant: "destructive", description: "Name, phone and at least one package are required" });
      return;
    }
    if (addPayMode === 'scanpay' && !addQrOpen) {
      setAddQrOpen(true);
      return;
    }

    const primaryPkg = selectedAddPkgs[0];
    const today = getISTISODate();
    const dateDisplay = formatISTDate(today);
    const primaryMeals = primaryPkg?.meals_count ?? 10;

    const msg = isRenewalMode
      ? (selectedAddPkgs.length === 1
          ? buildRenewalMsg(addName, primaryPkg?.name || 'Sprouts Salad', primaryMeals, primaryPkg?.price || 0, dateDisplay)
          : buildRenewalMsgMulti(addName, selectedAddPkgs, dateDisplay))
      : (selectedAddPkgs.length === 1
          ? buildActiveSubMsg(addName, primaryPkg?.name || 'Sprouts Salad', primaryMeals, primaryPkg?.price || 0, dateDisplay)
          : buildActiveSubMsgMulti(addName, selectedAddPkgs, dateDisplay));
    window.open(`https://wa.me/91${addPhone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      const existingCust = customers.find(c => c.phone === addPhone);
      let custId: number | null = null;

      if (existingCust) {
        await dbUpd('customers', existingCust.id, {
          name: addName, status: 'active', used: 0, total: primaryMeals,
          renew_count: existingCust.renew_count + 1,
          last_renewed: today, pack_start_date: today,
          package_id: primaryPkg?.id || null, payment_mode: addPayMode
        });
        custId = existingCust.id;
        await dbUpdWhere('meal_skips', `customer_id=eq.${custId}&skip_date=gte.${today}&unskipped=eq.false`, { unskipped: true });
      } else {
        const res = await dbIns<any>('customers', {
          name: addName, phone: addPhone, type: 'subscribed',
          total: primaryMeals, used: 0, join_date: today, renew_count: 0,
          pack_start_date: today, status: 'active', is_deleted: false,
          preferred_days: [], package_id: primaryPkg?.id || null, payment_mode: addPayMode
        });
        custId = res[0]?.id || null;
      }

      if (custId) {
        for (const pkg of selectedAddPkgs) {
          await dbIns('customer_packages', {
            customer_id: custId,
            package_id: pkg.id,
            used: 0,
            total: pkg.meals_count ?? 10,
            pack_start_date: today,
            payment_mode: addPayMode,
            status: 'active',
            renew_count: existingCust ? existingCust.renew_count + 1 : 0,
            instruction: addInstructions[pkg.id] || '',
            preferred_days: addSaladDays,
          });
        }
      }

      const pkgNames = selectedAddPkgs.map(p => p.name).join(', ');
      logActivity(custId, existingCust ? 'renewed' : 'subscribed', `${existingCust ? 'Renewed' : 'Subscribed'} to ${pkgNames} for ₹${addTotal}. Payment: ${addPayMode}`);

      toast({ title: isRenewalMode ? "Subscription renewed!" : existingCust ? "Pack renewed!" : "Customer added and subscribed!" });
      setAddModal(false);
      setAddQrOpen(false);
      setIsRenewalMode(false);
      setAddName(""); setAddPhone(""); setAddPkgIds([]); setAddPayMode("cash"); setAddCash("");
      setAddInstructions({}); setAddSaladDays([]);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Add package to existing customer ─────────────────────────────────────
  const handleAddPackageToCustomer = async () => {
    const c = addPkgModal.customer;
    if (!c || !addPkgPkgId) {
      toast({ variant: "destructive", description: "Select a package" });
      return;
    }
    if (addPkgPayMode === 'scanpay' && !addPkgQrOpen) {
      setAddPkgQrOpen(true);
      return;
    }

    const pkg = activePackages.find(p => p.id.toString() === addPkgPkgId);
    const today = getISTISODate();
    const dateDisplay = formatISTDate(today);
    const mealsCount = pkg?.meals_count ?? 10;

    const msg = buildActiveSubMsg(c.name, pkg?.name || 'Sprouts Salad', mealsCount, pkg?.price || 0, dateDisplay);
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      await dbIns('customer_packages', {
        customer_id: c.id,
        package_id: Number(addPkgPkgId),
        used: 0,
        total: mealsCount,
        pack_start_date: today,
        payment_mode: addPkgPayMode,
        status: 'active',
        renew_count: 0,
      });

      logActivity(c.id, 'pkg_added', `Additional package added: ${pkg?.name} for ₹${pkg?.price}`);
      toast({ title: "Package added!" });
      setAddPkgModal({ open: false, customer: null });
      setAddPkgQrOpen(false);
      setAddPkgPkgId(""); setAddPkgPayMode("cash"); setAddPkgCash("");
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Mark meal used ───────────────────────────────────────────────────────
  const handleUseMeal = async (c: any, cp: CustomerPackage | null, qty: number = 1) => {
    const currentUsed = cp ? cp.used : c.used;
    const currentTotal = cp ? cp.total : c.total;
    if (currentUsed + qty > currentTotal) return;

    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { used: cp.used + qty });
        await dbUpd('customers', c.id, { used: c.used + qty });
      } else {
        await dbUpd('customers', c.id, { used: c.used + qty });
      }
      const newUsed = currentUsed + qty;
      await logActivity(c.id, 'meal_used', `${qty > 1 ? qty + ' meals' : 'Meal'} used. Now ${newUsed}/${currentTotal}`);
      const pkg = packages.find(p => p.id === (cp ? cp.package_id : c.package_id));
      refresh();
      setMealUsedModal({ open: true, customer: c, used: newUsed, total: currentTotal, pkgName: pkg?.name || '' });
      setUseMealQty(p => ({ ...p, [c.id]: 1 }));
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleSendMealUpdate = (customer: any, used: number, remaining: number, total: number, pkgName: string) => {
    const msg = buildMealUpdateMsg(customer.name, used, remaining, total, pkgName || undefined);
    window.open(`https://wa.me/91${customer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setMealUsedModal({ open: false, customer: null, used: 0, total: 0, pkgName: '' });
  };

  // ─── Undo meal ────────────────────────────────────────────────────────────
  const handleUndo = async (c: any, cp: CustomerPackage | null) => {
    const currentUsed = cp ? cp.used : c.used;
    if (currentUsed === 0) return;
    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { used: cp.used - 1 });
        await dbUpd('customers', c.id, { used: Math.max(0, c.used - 1) });
      } else {
        await dbUpd('customers', c.id, { used: c.used - 1 });
      }
      await logActivity(c.id, 'meal_undo', `Meal use undone. Now ${currentUsed - 1}/${cp ? cp.total : c.total}`);
      toast({ title: "Meal use undone" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Renew ────────────────────────────────────────────────────────────────
  const handleRenew = (c: any, cp: CustomerPackage | null) => {
    const pkgId = cp ? cp.package_id : c.package_id;
    setIsRenewalMode(true);
    setAddModal(true);
    setAddQrOpen(false);
    setAddName(c.name);
    setAddPhone(c.phone);
    setAddPkgIds(pkgId ? [pkgId] : []);
    setAddPayMode(cp?.payment_mode || c.payment_mode || 'cash');
    setAddCash('');
    setAddInstructions({});
    setAddSaladDays(cp?.preferred_days || []);
  };

  // ─── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = (c: any, cp: CustomerPackage | null) => {
    setCancelModal({ open: true, customer: c, cp });
  };

  const handleConfirmCancel = async (sendReturn: boolean) => {
    const { customer: c, cp } = cancelModal;
    if (!c) return;

    if (sendReturn) {
      const pkgId = cp ? cp.package_id : c.package_id;
      const pkg = packages.find(p => p.id === pkgId);
      const pricePerMeal = pkg ? Math.round(pkg.price / (pkg.meals_count ?? 10)) : 0;
      const used = cp ? cp.used : c.used;
      const total = cp ? cp.total : c.total;
      const refundAmount = (total - used) * pricePerMeal;
      const msg = `Hello ${c.name},\n\nYour subscription has been cancelled.\n\n📊 Meals Used: ${used}/${total}\n💰 Refund Amount: ₹${refundAmount} (${total - used} meals × ₹${pricePerMeal})\n\nWe hope to see you again!`;
      window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { status: 'cancelled' });
        const remaining = getCustPacks(c.id).filter(x => x.id !== cp.id);
        if (remaining.length === 0) {
          await dbUpd('customers', c.id, { status: 'cancelled' });
        }
      } else {
        await dbUpd('customers', c.id, { status: 'cancelled' });
      }
      logActivity(c.id, 'cancelled', 'Subscription cancelled.');
      toast({ title: "Subscription cancelled" });
      setCancelModal({ open: false, customer: null, cp: null });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (c: any) => {
    if (window.confirm("Delete this customer? They will be removed from both Subscribed and Walk-ins.")) {
      try {
        await dbUpd('customers', c.id, { is_deleted: true });
        const walkin = walkins.find(w => w.phone === c.phone);
        if (walkin) await dbUpd('walkins', walkin.id, { is_deleted: true });
        await logActivity(c.id, 'deleted', 'Customer deleted (soft)');
        toast({ title: "Customer deleted" });
        refresh();
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      }
    }
  };

  // ─── Notify ───────────────────────────────────────────────────────────────
  const sendWhatsApp = () => {
    const c = notifyModal.customer;
    const cp = notifyModal.cp;
    if (!c) return;

    const pkgId = cp ? cp.package_id : c.package_id;
    const pkg = packages.find(p => p.id === pkgId);
    const used = cp ? cp.used : c.used;
    const total = cp ? cp.total : c.total;
    const remaining = total - used;
    const price = pkg?.price || 0;
    const pkgName = pkg?.name;

    let msg = "";
    if (notifyModal.type === 'meal') {
      msg = buildMealUpdateMsg(c.name, used, remaining, total, pkgName);
    } else if (notifyModal.type === 'low') {
      msg = buildRenewPackMsg(c.name, remaining, total, price, pkgName);
    } else if (notifyModal.type === 'done') {
      msg = buildPackDoneMsg(c.name, total, price, pkgName);
    }
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setNotifyModal({ open: false, customer: null, type: "", cp: null });
  };

  // ─── Skip ─────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    const c = skipModal.customer;
    const skipCp = skipModal.cp;
    if (!c) return;

    let datesToSkip: string[] = [];
    if (skipMode === 'single') {
      if (!skipDate) return;
      datesToSkip = [skipDate];
    } else if (skipMode === 'range') {
      if (!skipRangeStart || !skipRangeEnd || skipRangeStart > skipRangeEnd) {
        toast({ variant: "destructive", description: "Select a valid date range" });
        return;
      }
      let d = new Date(skipRangeStart + 'T00:00:00');
      const end = new Date(skipRangeEnd + 'T00:00:00');
      while (d <= end) {
        datesToSkip.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d));
        d.setDate(d.getDate() + 1);
      }
    } else {
      if (skipMultiDates.length === 0) {
        toast({ variant: "destructive", description: "Add at least one date" });
        return;
      }
      datesToSkip = [...skipMultiDates];
    }

    const pkg = skipCp ? packages.find(p => p.id === skipCp.package_id) : null;
    const pkgLine = pkg ? `\n📦 Package: ${pkg.name}` : '';

    let msg = '';
    if (skipMode === 'single') {
      const d = new Date(datesToSkip[0] + 'T00:00:00');
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
      const dateStr = d.toLocaleDateString('en-IN');
      msg = `Hello ${c.name},\n\nConfirmed — your pack is skipped for:\n\n📅 ${dayName}, ${dateStr}${pkgLine}\n\nYour remaining meals stay the same. See you on your next day!`;
    } else if (skipMode === 'range') {
      const start = new Date(datesToSkip[0] + 'T00:00:00').toLocaleDateString('en-IN');
      const end = new Date(datesToSkip[datesToSkip.length - 1] + 'T00:00:00').toLocaleDateString('en-IN');
      msg = `Hello ${c.name},\n\nConfirmed — your pack is skipped from:\n\n📅 ${start} to ${end} (${datesToSkip.length} days)${pkgLine}\n\nYour remaining meals stay the same.`;
    } else {
      const dateLines = datesToSkip.map(d => `📅 ${new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}`).join('\n');
      msg = `Hello ${c.name},\n\nConfirmed — your pack is skipped on:\n\n${dateLines}${pkgLine}\n\nYour remaining meals stay the same.`;
    }
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      for (const date of datesToSkip) {
        await dbIns('meal_skips', {
          customer_id: c.id,
          skip_date: date,
          notified: true,
          unskipped: false,
          customer_package_id: skipCp?.id ?? null,
        });
      }
      logActivity(c.id, 'meal_skipped', `${datesToSkip.length} day(s) skipped${pkg ? ` (${pkg.name})` : ''}: ${datesToSkip.join(', ')}`);
      setSkipModal({ open: false, customer: null, cp: null });
      setSkipMode('single');
      setSkipMultiDates([]);
      toast({ title: `${datesToSkip.length} day${datesToSkip.length > 1 ? 's' : ''} skipped & WhatsApp opened` });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Unskip ───────────────────────────────────────────────────────────────
  const handleUnskip = async (skipId: number, customerId: number) => {
    try {
      await dbUpd('meal_skips', skipId, { unskipped: true });
      logActivity(customerId, 'meal_unskipped', 'Skip removed');
      toast({ title: "Skip removed" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Preferred days (per package when cp provided, else per customer) ────
  const handleTogglePrefDay = async (c: any, dayIdx: number, cp: CustomerPackage | null) => {
    const currentPrefs = cp ? [...(cp.preferred_days ?? [])] : [...(c.preferred_days || [])];
    let newPrefs = currentPrefs;
    if (newPrefs.length === 0) {
      newPrefs = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
    } else if (newPrefs.includes(dayIdx)) {
      newPrefs = newPrefs.filter(d => d !== dayIdx);
    } else {
      newPrefs.push(dayIdx);
    }
    if (newPrefs.length === 6) newPrefs = [];
    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { preferred_days: newPrefs });
      } else {
        await dbUpd('customers', c.id, { preferred_days: newPrefs });
      }
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (c: any) => {
    setEditModal({ open: true, customer: c });
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditPkg(c.package_id ? c.package_id.toString() : "");
    setEditMode(c.payment_mode);
    const cps = getCustPacks(c.id);
    const instr: Record<number, string> = {};
    const saladDays: Record<number, number[]> = {};
    cps.forEach(cp => {
      instr[cp.id] = cp.instruction || '';
      saladDays[cp.id] = cp.preferred_days || [];
    });
    setEditInstructions(instr);
    setEditSaladDaysByCp(saladDays);
  };

  const saveEdit = async () => {
    const c = editModal.customer;
    if (!c) return;
    try {
      await dbUpd('customers', c.id, {
        name: editName, phone: editPhone,
        package_id: editPkg ? Number(editPkg) : null,
        payment_mode: editMode
      });
      const walkin = walkins.find(w => w.phone === c.phone || w.phone === editPhone);
      if (walkin) await dbUpd('walkins', walkin.id, { name: editName, phone: editPhone });
      // Update instruction + preferred_days per customer_package in one call each
      const cps = getCustPacks(c.id);
      for (const cp of cps) {
        const updates: Record<string, unknown> = {};
        if (editInstructions[cp.id] !== undefined) updates.instruction = editInstructions[cp.id];
        if (editSaladDaysByCp[cp.id] !== undefined) updates.preferred_days = editSaladDaysByCp[cp.id];
        if (Object.keys(updates).length > 0) {
          await dbUpd('customer_packages', cp.id, updates);
        }
      }
      await logActivity(c.id, 'edit', `Info updated: name=${editName}, phone=${editPhone}, mode=${editMode}`);
      toast({ title: "Customer updated" });
      setEditModal({ open: false, customer: null });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── History ──────────────────────────────────────────────────────────────
  const openHistory = async (c: any) => {
    setHistoryModal({ open: true, customer: c });
    setHistoryLoading(true);
    const cp = getSelectedCp(c);
    const logs = await getActivityLogs(c.id);
    // Filter to selected package's timeframe (from pack_start_date)
    const cutoff = cp?.pack_start_date ? new Date(cp.pack_start_date + 'T00:00:00').getTime() : 0;
    const filtered = cutoff > 0 ? logs.filter(l => new Date(l.created_at).getTime() >= cutoff) : logs;
    setHistoryLogs(filtered);
    setHistoryLoading(false);
  };

  // ─── Instructions ─────────────────────────────────────────────────────────
  const openInstr = (c: any) => {
    const cps = getCustPacks(c.id).filter(cp => cp.status === 'active');
    const edits: Record<number, string> = {};
    cps.forEach(cp => { edits[cp.id] = cp.instruction || ''; });
    setInstrEdits(edits);
    setInstrModal({ open: true, customer: c });
  };

  const saveInstr = async () => {
    try {
      for (const [cpId, instr] of Object.entries(instrEdits)) {
        await dbUpd('customer_packages', Number(cpId), { instruction: instr });
      }
      toast({ title: "Instructions saved" });
      setInstrModal({ open: false, customer: null });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Week helpers ──────────────────────────────────────────────────────────
  const getWeekDays = (offset: number) => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday + offset * 7);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: d,
        iso: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d),
        dayStr: DAYS[i][0],
        dateStr: d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' })
      };
    });
  };

  const filters = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "low", label: "Low" },
    { id: "done", label: "Done" },
    { id: "new", label: "New" },
    { id: "renewed", label: "Renewed" }
  ];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Subscribed</h2>
        <Button
          onClick={() => {
            setAddModal(true); setAddQrOpen(false); setAddName(""); setAddPhone("");
            setAddPkgIds([]); setAddPayMode("cash"); setAddCash(""); setAddInstructions({}); setAddSaladDays([]);
          }}
          className="rounded-full shadow-md font-bold px-4"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add
        </Button>
      </div>

      <div className="bg-muted p-1.5 rounded-2xl flex overflow-x-auto hide-scrollbar shadow-inner border border-border">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex-1 min-w-[60px] px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200",
              filter === f.id
                ? "bg-white dark:bg-card text-primary shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {filteredSubs.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground bg-muted/30 rounded-3xl border border-dashed">
            No subscribers match this filter.
          </div>
        ) : (
          filteredSubs.map(c => {
            const custPacks = getCustPacks(c.id);
            const { cp, used, total, packageId } = getDisplayData(c);
            const pkg = packages.find(p => p.id === packageId);
            const isDone = used >= total;
            const isLow = (total - used) <= 2 && !isDone;
            const progressPercent = total > 0 ? (used / total) * 100 : 0;
            const isWalkin = walkins.some(w => w.phone === c.phone);
            const offset = weekOffset[c.id] || 0;
            const weekDays = getWeekDays(offset);

            return (
              <Card key={c.id} className={cn("border border-border shadow-sm overflow-hidden transition-all duration-200", c.status === 'cancelled' ? 'opacity-60' : 'hover:shadow-md')}>
                <div className={cn("h-1.5 w-full", isDone ? 'bg-gray-400' : isLow ? 'bg-secondary' : 'bg-primary')} />

                <CardContent className="p-5 flex flex-col gap-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold font-serif text-xl leading-tight">{c.name}</div>
                      <div className="text-sm font-medium text-muted-foreground mt-0.5">{c.phone}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {/* Package selector / label */}
                      {(() => {
                        const activePacks = custPacks.filter(cp => cp.total - cp.used > 0);
                        if (activePacks.length > 0) {
                          return (
                            <Select
                              value={(selectedCpId[c.id] || activePacks[0]?.id)?.toString()}
                              onValueChange={v => setSelectedCpId(p => ({ ...p, [c.id]: Number(v) }))}
                            >
                              <SelectTrigger className="h-7 text-xs border-primary/20 text-primary w-auto min-w-[100px] max-w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activePacks.map(xcp => {
                                  const xpkg = packages.find(p => p.id === xcp.package_id);
                                  return (
                                    <SelectItem key={xcp.id} value={xcp.id.toString()}>
                                      {xpkg?.name || 'Pack'} ({xcp.total - xcp.used} left)
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          );
                        } else if (pkg) {
                          return (
                            <div className="text-[11px] font-semibold text-primary/80 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                              {pkg.name}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Meals left badge */}
                      {c.status === 'cancelled' ? (
                        <Badge variant="destructive" className="font-bold">Cancelled</Badge>
                      ) : isDone ? (
                        <Badge className="bg-gray-200 text-gray-700 font-bold">Pack Done</Badge>
                      ) : isLow ? (
                        <Badge className="bg-secondary text-secondary-foreground font-bold">Low: {total - used} left</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary font-bold border-primary/20">{total - used} left</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isWalkin && <Badge variant="secondary" className="text-[11px] rounded-lg">Walk-in</Badge>}
                    {c.renew_count === 0 ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] rounded-lg">New User</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] rounded-lg">Renewed ×{c.renew_count}</Badge>
                    )}
                    {custPacks.length > 1 && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] rounded-lg">{custPacks.length} packs</Badge>
                    )}
                    <Badge variant="outline" className="text-[11px] rounded-lg uppercase">{c.payment_mode}</Badge>
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-xl border border-border">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Meals Used</span>
                      <span className="text-foreground">{used} / {total}</span>
                    </div>
                    <Progress value={progressPercent} className={cn("h-3 bg-muted", isDone ? '[&>div]:bg-gray-400' : isLow ? '[&>div]:bg-secondary' : '[&>div]:bg-primary')} />
                  </div>

                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex justify-between items-center px-3 py-2 bg-muted/30 border-b border-border">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</div>
                      <div className="flex items-center gap-1 bg-background rounded-lg border border-border">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setWeekOffset(p => ({ ...p, [c.id]: offset - 1 }))}>
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <span className="text-[10px] font-bold w-12 text-center">{offset === 0 ? 'This Wk' : offset > 0 ? `+${offset} Wk` : `${offset} Wk`}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setWeekOffset(p => ({ ...p, [c.id]: offset + 1 }))}>
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex p-2 gap-1.5 bg-muted/10">
                      {weekDays.map((d, i) => {
                        const cpPrefDays = cp?.preferred_days;
                        const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
                        const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(i);
                        const skip = mealSkips.find(s =>
                          s.customer_id === c.id &&
                          s.skip_date === d.iso &&
                          !s.unskipped &&
                          (s.customer_package_id == null || s.customer_package_id === cp?.id)
                        );
                        const isSkipped = !!skip;
                        const isToday = d.iso === getISTISODate();
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              if (isSkipped && skip) {
                                handleUnskip(skip.id, c.id);
                              } else {
                                handleTogglePrefDay(c, i, cp);
                              }
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center flex-1 py-2 rounded-lg cursor-pointer border-2 transition-all duration-200",
                              isSkipped ? 'bg-orange-50 border-orange-200 text-orange-800' :
                                isScheduled ? 'bg-primary border-primary text-primary-foreground shadow-md' :
                                  'bg-card border-transparent text-muted-foreground hover:border-border',
                              isToday && !isSkipped ? 'ring-2 ring-primary/30 ring-offset-1' : ''
                            )}
                            title={isSkipped ? 'Tap to remove skip' : isScheduled ? 'Tap to skip this day' : 'Tap to schedule this day'}
                          >
                            <div className="text-[11px] font-bold">{d.dayStr}</div>
                            <div className={cn("text-[10px] mt-0.5 font-medium", isScheduled ? 'opacity-90' : 'opacity-60')}>{d.dateStr.split('/')[0]}</div>
                            {isSkipped && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1" />}
                          </div>
                        );
                      })}
                    </div>
                    {mealSkips.some(s => s.customer_id === c.id && !s.unskipped) && (
                      <div className="px-3 pb-2 text-[10px] text-orange-600 font-medium">
                        Tap orange day to remove skip
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex gap-3">
                      {!isDone && c.status !== 'cancelled' && (
                        <div className="flex bg-muted/20 border border-border rounded-xl overflow-hidden h-14 w-20">
                          <input
                            type="number"
                            min="1"
                            max={total - used}
                            value={useMealQty[c.id] || 1}
                            onChange={e => {
                              let val = parseInt(e.target.value);
                              if (isNaN(val) || val < 1) val = 1;
                              if (val > (total - used)) val = total - used;
                              setUseMealQty(p => ({ ...p, [c.id]: val }));
                            }}
                            className="w-full text-center bg-transparent font-bold text-lg outline-none"
                          />
                        </div>
                      )}
                      <Button
                        onClick={() => handleUseMeal(c, cp, useMealQty[c.id] || 1)}
                        disabled={isDone || c.status === 'cancelled'}
                        className="flex-1 h-14 rounded-xl shadow-md font-bold text-lg"
                      >
                        <Check className="w-5 h-5 mr-2" /> Mark Used
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleUndo(c, cp)}
                        disabled={used === 0 || c.status === 'cancelled'}
                        className="w-14 h-14 rounded-xl border-border bg-card hover:bg-muted"
                      >
                        <Undo2 className="w-5 h-5" />
                      </Button>
                    </div>

                    {isDone && (
                      <Button
                        onClick={() => handleRenew(c, cp)}
                        disabled={c.status === 'cancelled'}
                        className="w-full h-10 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold"
                      >
                        <RefreshCw className="w-4 h-4 mr-1.5" /> Renew
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openInstr(c)}
                        className="w-10 h-10 rounded-lg p-0 border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
                        title="Instructions"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </Button>

                      {!isDone && (
                        <Button
                          variant="outline"
                          onClick={() => setNotifyModal({ open: true, customer: c, type: isLow ? 'low' : 'meal', cp })}
                          disabled={c.status === 'cancelled'}
                          className="w-10 h-10 rounded-lg p-0 border-primary/20 text-primary hover:bg-primary/5"
                          title="Notify"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => { setSkipModal({ open: true, customer: c, cp }); setSkipDate(getISTISODate()); }}
                        disabled={isDone || c.status === 'cancelled'}
                        className="w-10 h-10 rounded-lg p-0 border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
                        title="Skip Meal"
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>

                      <Button variant="outline" className="w-10 h-10 rounded-lg p-0" onClick={() => openHistory(c)} title="History">
                        <History className="w-4 h-4" />
                      </Button>

                      <Button variant="outline" className="w-10 h-10 rounded-lg p-0" onClick={() => openEdit(c)} title="Edit">
                        <Edit className="w-4 h-4" />
                      </Button>

                      {c.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          className="w-10 h-10 rounded-lg p-0 border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
                          onClick={() => handleCancel(c, cp)}
                          title="Cancel Subscription"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        className="w-10 h-10 rounded-lg p-0 border-red-300 text-red-700 bg-red-100 hover:bg-red-200"
                        onClick={() => handleDelete(c)}
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ─── Add Customer Modal ─────────────────────────────────────────────── */}
      <Dialog open={addModal} onOpenChange={v => { setAddModal(v); if (!v) { setAddQrOpen(false); setIsRenewalMode(false); } }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">
              {isRenewalMode ? `Renew — ${addName}` : 'Add Subscriber'}
            </DialogTitle>
          </DialogHeader>
          {addQrOpen ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl font-black text-primary">₹{addTotal}</div>
              <div className="p-3 bg-white rounded-2xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(addUpiUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <a href={addUpiUrl} className="flex items-center gap-2 text-sm font-bold text-blue-600 underline underline-offset-2">
                <CreditCard className="w-4 h-4" /> Open in UPI App
              </a>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 h-12 rounded-xl font-bold" onClick={handleAddCustomer}>Payment Done</Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setAddQrOpen(false)}>Back</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input placeholder="Enter name" value={addName} onChange={e => setAddName(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input type="tel" placeholder="10-digit number" value={addPhone} onChange={e => setAddPhone(e.target.value)} className="h-12 rounded-xl font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Package(s) — tap to select one or more</Label>
                  <div className="space-y-2">
                    {activePackages.map(p => {
                      const selected = addPkgIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAddPkgIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border-2 transition-all flex justify-between items-center",
                            selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <div>
                            <div className={cn("font-bold text-sm", selected && 'text-primary')}>{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.meals_count ?? 10} meals</div>
                          </div>
                          <span className={cn("font-bold", selected ? 'text-primary' : 'text-muted-foreground')}>₹{p.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedAddPkgs.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm flex justify-between">
                    <span>{selectedAddPkgs.length} pack{selectedAddPkgs.length > 1 ? 's' : ''} — {selectedAddPkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0)} meals total</span>
                    <span className="font-bold text-primary">₹{addTotal}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <PaymentModeSelect value={addPayMode} onChange={setAddPayMode} />
                </div>
                {addPayMode === 'cash' && addTotal > 0 && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                    <Label className="text-amber-900 font-bold text-xs">Cash Received</Label>
                    <Input type="number" placeholder="₹" value={addCash} onChange={e => setAddCash(e.target.value)} className="bg-white border-amber-300 h-11" />
                    {addCash !== "" && (
                      <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${addChange >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                        <span>{addChange >= 0 ? 'Change:' : 'Short:'}</span>
                        <span>₹{Math.abs(addChange)}</span>
                      </div>
                    )}
                  </div>
                )}
                {addPayMode === 'upi' && addTotal > 0 && (
                  <a href={addUpiUrl} className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors">
                    <CreditCard className="w-4 h-4" /> Open UPI App — ₹{addTotal}
                  </a>
                )}
                {selectedAddPkgs.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Special Instructions (per package)</Label>
                    {selectedAddPkgs.map(pkg => (
                      <div key={pkg.id} className="space-y-1">
                        <div className="text-xs font-semibold text-primary">{pkg.name}</div>
                        <Input
                          placeholder="e.g. No onions, extra sprouts..."
                          value={addInstructions[pkg.id] || ''}
                          onChange={e => setAddInstructions(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                          className="h-9 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Salad Days */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Salad Days (Delivery Schedule)</Label>
                  <div className="flex gap-1.5">
                    {DAYS.map((day, idx) => {
                      const isSelected = addSaladDays.length === 0 || addSaladDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleAddSaladDay(idx)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all",
                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {day[0]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {addSaladDays.length === 0
                      ? 'All days (Mon–Sat) — tap a day to exclude it'
                      : `${addSaladDays.length} day${addSaladDays.length > 1 ? 's' : ''} selected`}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCustomer} className="w-full h-14 text-lg rounded-xl font-bold">
                  {addPayMode === 'scanpay' ? 'Show QR & Activate' : 'Activate Subscription'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Notify Modal ───────────────────────────────────────────────────── */}
      <Dialog open={notifyModal.open} onOpenChange={o => !o && setNotifyModal({ ...notifyModal, open: false })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Send Notification</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-muted-foreground">Choose a message template for <span className="font-bold text-foreground">{notifyModal.customer?.name}</span>:</p>
            {['meal', 'low', 'done'].map(type => (
              <button
                key={type}
                onClick={() => setNotifyModal(prev => ({ ...prev, type }))}
                className={cn(
                  "w-full text-left p-3 rounded-xl border-2 transition-all",
                  notifyModal.type === type ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="font-bold text-sm capitalize">
                  {type === 'meal' ? 'Meal Update' : type === 'low' ? 'Renew Pack (Low)' : 'Pack Done'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {type === 'meal' ? `Update on meals used` :
                    type === 'low' ? 'Urge renewal — meals running low' :
                      'Pack complete — request renewal'}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={sendWhatsApp} className="w-full h-14 text-lg rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold">
              <MessageCircle className="w-5 h-5 mr-2" /> Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Meal Used WhatsApp Prompt ───────────────────────────────────────── */}
      <Dialog open={mealUsedModal.open} onOpenChange={o => !o && setMealUsedModal({ open: false, customer: null, used: 0, total: 0, pkgName: '' })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Meal Marked Used ✓</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-2">
            <div className="text-4xl font-black text-primary">{mealUsedModal.used} / {mealUsedModal.total}</div>
            {mealUsedModal.pkgName && <div className="text-xs text-muted-foreground">{mealUsedModal.pkgName}</div>}
            <div className="text-sm text-muted-foreground">Send a meal update to {mealUsedModal.customer?.name}?</div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button
              onClick={() => handleSendMealUpdate(mealUsedModal.customer, mealUsedModal.used, mealUsedModal.total - mealUsedModal.used, mealUsedModal.total, mealUsedModal.pkgName)}
              className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold"
            >
              <MessageCircle className="w-5 h-5 mr-2" /> Send WhatsApp Update
            </Button>
            <Button variant="outline" onClick={() => setMealUsedModal({ open: false, customer: null, used: 0, total: 0, pkgName: '' })} className="w-full h-12 rounded-xl">
              Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Skip Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={skipModal.open} onOpenChange={o => { if (!o) { setSkipModal({ open: false, customer: null, cp: null }); setSkipMode('single'); setSkipMultiDates([]); } }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Skip Meal — {skipModal.customer?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4">
            {skipModal.cp && (() => {
              const pkg = packages.find(p => p.id === skipModal.cp!.package_id);
              return pkg ? (
                <div className="p-3 bg-primary/5 rounded-xl text-sm font-semibold text-primary border border-primary/20">
                  📦 Package: {pkg.name}
                </div>
              ) : null;
            })()}

            {/* Mode selector */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              {([
                { key: 'single', label: 'Single Date' },
                { key: 'range', label: 'Range' },
                { key: 'multi', label: 'Multiple' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSkipMode(m.key)}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold transition-all",
                    skipMode === m.key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Single date */}
            {skipMode === 'single' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Date</Label>
                <Input type="date" value={skipDate} onChange={e => setSkipDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            {/* Range */}
            {skipMode === 'range' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">From</Label>
                    <Input type="date" value={skipRangeStart} onChange={e => setSkipRangeStart(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">To</Label>
                    <Input type="date" value={skipRangeEnd} onChange={e => setSkipRangeEnd(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                </div>
                {skipRangeStart && skipRangeEnd && skipRangeStart <= skipRangeEnd && (
                  <div className="text-xs text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20">
                    {(() => {
                      let count = 0;
                      let d = new Date(skipRangeStart + 'T00:00:00');
                      const end = new Date(skipRangeEnd + 'T00:00:00');
                      while (d <= end) { count++; d.setDate(d.getDate() + 1); }
                      return `${count} day${count > 1 ? 's' : ''} will be skipped`;
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Multiple dates */}
            {skipMode === 'multi' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={skipAddDate}
                    onChange={e => setSkipAddDate(e.target.value)}
                    className="flex-1 h-11 rounded-xl"
                  />
                  <Button
                    variant="outline"
                    className="h-11 px-4 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => {
                      if (skipAddDate && !skipMultiDates.includes(skipAddDate)) {
                        setSkipMultiDates(prev => [...prev, skipAddDate].sort());
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {skipMultiDates.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {skipMultiDates.map(d => (
                      <div key={d} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-semibold text-orange-800">
                          {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setSkipMultiDates(prev => prev.filter(x => x !== d))}
                          className="text-orange-600 hover:text-orange-800 font-bold text-sm leading-none ml-2"
                        >×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2 bg-muted/20 rounded-lg border border-dashed border-border">
                    Add dates using the picker above
                  </div>
                )}
                {skipMultiDates.length > 0 && (
                  <div className="text-xs text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20">
                    {skipMultiDates.length} date{skipMultiDates.length > 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-orange-50 rounded-xl text-xs text-orange-700 border border-orange-200">
              To remove a skip, tap the orange day in the schedule grid.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSkip} className="w-full h-14 text-lg rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold">
              <MessageCircle className="w-5 h-5 mr-2" /> Confirm Skip & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Modal ───────────────────────────────────────────────────── */}
      <Dialog open={cancelModal.open} onOpenChange={o => !o && setCancelModal({ open: false, customer: null, cp: null })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-red-600">Cancel Subscription</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Cancel subscription for <span className="font-bold text-foreground">{cancelModal.customer?.name}</span>?</p>
            {cancelModal.customer && (() => {
              const { used, total, packageId } = getDisplayData(cancelModal.customer);
              const pkg = packages.find(p => p.id === packageId);
              const pricePerMeal = pkg ? Math.round(pkg.price / (pkg.meals_count ?? 10)) : 0;
              const remaining = total - used;
              const refund = remaining * pricePerMeal;
              return (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="font-bold text-sm text-amber-900">Meal Return Calculation</div>
                  <div className="text-sm text-amber-800 space-y-1">
                    <div>Meals Used: <span className="font-bold">{used}/{total}</span></div>
                    <div>Remaining Meals: <span className="font-bold">{remaining}</span></div>
                    <div>Price per Meal: <span className="font-bold">₹{pricePerMeal}</span></div>
                    <div className="text-base font-black pt-1">Refund Amount: ₹{refund}</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={() => handleConfirmCancel(true)} className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold">
              <MessageCircle className="w-5 h-5 mr-2" /> Cancel & Send Refund Details
            </Button>
            <Button variant="outline" onClick={() => handleConfirmCancel(false)} className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50">
              Cancel Without Notification
            </Button>
            <Button variant="ghost" onClick={() => setCancelModal({ open: false, customer: null, cp: null })} className="w-full h-10 rounded-xl">
              Keep Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={editModal.open} onOpenChange={o => !o && setEditModal({ ...editModal, open: false })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Edit Subscriber</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-12 rounded-xl font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Primary Package</Label>
              <Select value={editPkg} onValueChange={setEditPkg}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {packages.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name} — {p.meals_count ?? 10} meals — ₹{p.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <RadioGroup value={editMode} onValueChange={setEditMode} className="flex gap-4">
                {['cash', 'upi', 'scanpay'].map(m => (
                  <div key={m} className="flex items-center space-x-2">
                    <input type="radio" id={`em-${m}`} name="editMode" value={m} checked={editMode === m} onChange={() => setEditMode(m)} className="accent-primary" />
                    <Label htmlFor={`em-${m}`} className="capitalize">{m === 'scanpay' ? 'Scan' : m}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {editModal.customer && getCustPacks(editModal.customer.id).filter(cp => cp.total - cp.used > 0).length > 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Per Package Settings</Label>
                {getCustPacks(editModal.customer.id).filter(cp => cp.total - cp.used > 0).map(cp => {
                  const pkg = packages.find(p => p.id === cp.package_id);
                  const saladDays = editSaladDaysByCp[cp.id] || [];
                  return (
                    <div key={cp.id} className="p-3 rounded-xl border border-border bg-muted/10 space-y-2.5">
                      <div className="text-xs font-bold text-primary">{pkg?.name || 'Package'} ({cp.total - cp.used} left)</div>
                      <Input
                        placeholder="e.g. No onions, extra sprouts..."
                        value={editInstructions[cp.id] || ''}
                        onChange={e => setEditInstructions(prev => ({ ...prev, [cp.id]: e.target.value }))}
                        className="h-9 rounded-lg text-sm"
                      />
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Salad Days</div>
                        <div className="flex gap-1">
                          {DAYS.map((day, idx) => {
                            const isSelected = saladDays.length === 0 || saladDays.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleEditSaladDay(cp.id, idx)}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all",
                                  isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'
                                )}
                              >
                                {day[0]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {saladDays.length === 0 ? 'All days (Mon–Sat)' : `${saladDays.length} day${saladDays.length > 1 ? 's' : ''} selected`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-800 border border-blue-200">
              Changes will also update this customer's Walk-in record.
            </div>

            {/* Add another package */}
            {editModal.customer && (
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => {
                  setEditModal({ ...editModal, open: false });
                  setAddPkgModal({ open: true, customer: editModal.customer });
                  setAddPkgPkgId(activePackages[0]?.id.toString() || "");
                  setAddPkgPayMode("cash"); setAddPkgCash(""); setAddPkgQrOpen(false);
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Another Package
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} className="w-full h-12 rounded-xl text-base font-bold">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Package to Existing Customer Modal ─────────────────────────── */}
      <Dialog open={addPkgModal.open} onOpenChange={v => { setAddPkgModal({ ...addPkgModal, open: v }); if (!v) setAddPkgQrOpen(false); }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Add Package — {addPkgModal.customer?.name}</DialogTitle>
          </DialogHeader>
          {addPkgQrOpen ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl font-black text-primary">₹{addPkgTotal}</div>
              <div className="p-3 bg-white rounded-2xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(addPkgUpiUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <a href={addPkgUpiUrl} className="flex items-center gap-2 text-sm font-bold text-blue-600 underline underline-offset-2">
                <CreditCard className="w-4 h-4" /> Open in UPI App
              </a>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 h-12 rounded-xl font-bold" onClick={handleAddPackageToCustomer}>Payment Done</Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setAddPkgQrOpen(false)}>Back</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Package</Label>
                  <Select value={addPkgPkgId} onValueChange={setAddPkgPkgId}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Choose a package" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePackages.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} — {p.meals_count ?? 10} meals — ₹{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedAddPkgPkg && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm flex justify-between">
                    <span>{selectedAddPkgPkg.name} ({selectedAddPkgPkg.meals_count ?? 10} meals)</span>
                    <span className="font-bold text-primary">₹{selectedAddPkgPkg.price}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <PaymentModeSelect value={addPkgPayMode} onChange={setAddPkgPayMode} />
                </div>
                {addPkgPayMode === 'cash' && addPkgTotal > 0 && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                    <Label className="text-amber-900 font-bold text-xs">Cash Received</Label>
                    <Input type="number" placeholder="₹" value={addPkgCash} onChange={e => setAddPkgCash(e.target.value)} className="bg-white border-amber-300 h-11" />
                    {addPkgCash !== "" && (
                      <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${(Number(addPkgCash) - addPkgTotal) >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                        <span>{(Number(addPkgCash) - addPkgTotal) >= 0 ? 'Change:' : 'Short:'}</span>
                        <span>₹{Math.abs(Number(addPkgCash) - addPkgTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
                {addPkgPayMode === 'upi' && addPkgTotal > 0 && (
                  <a href={addPkgUpiUrl} className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors">
                    <CreditCard className="w-4 h-4" /> Open UPI App — ₹{addPkgTotal}
                  </a>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleAddPackageToCustomer} className="w-full h-14 text-lg rounded-xl font-bold">
                  {addPkgPayMode === 'scanpay' ? 'Show QR & Add Package' : 'Add Package'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Instructions Modal ─────────────────────────────────────────────── */}
      <Dialog open={instrModal.open} onOpenChange={o => !o && setInstrModal({ open: false, customer: null })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Instructions — {instrModal.customer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {instrModal.customer && (() => {
              const cps = getCustPacks(instrModal.customer.id).filter(cp => cp.status === 'active');
              if (cps.length === 0) return (
                <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                  No active packages found.
                </div>
              );
              return cps.map(cp => {
                const pkg = packages.find(p => p.id === cp.package_id);
                return (
                  <div key={cp.id} className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-primary">{pkg?.name || 'Package'}</div>
                      <div className="text-xs text-muted-foreground">{cp.total - cp.used} meals left</div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. No onions, extra sprouts..."
                        value={instrEdits[cp.id] ?? ''}
                        onChange={e => setInstrEdits(prev => ({ ...prev, [cp.id]: e.target.value }))}
                        className="h-9 rounded-lg text-sm flex-1"
                      />
                      {instrEdits[cp.id] && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg border-red-200 text-red-500 hover:bg-red-50 shrink-0"
                          onClick={() => setInstrEdits(prev => ({ ...prev, [cp.id]: '' }))}
                          title="Clear instruction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {cp.instruction && instrEdits[cp.id] === '' && (
                      <div className="text-xs text-amber-600 italic">Saving will clear the existing instruction.</div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <DialogFooter>
            <Button onClick={saveInstr} className="w-full h-12 rounded-xl text-base font-bold">
              Save Instructions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── History Modal ───────────────────────────────────────────────────── */}
      <Dialog open={historyModal.open} onOpenChange={o => !o && setHistoryModal({ open: false, customer: null })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif flex items-center gap-2">
              <History className="w-5 h-5" /> {historyModal.customer?.name} — History
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {historyLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
            ) : historyLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">No activity recorded yet.</div>
            ) : (
              historyLogs.map(log => (
                <div key={log.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold text-sm capitalize">{log.action.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] text-muted-foreground text-right shrink-0">{formatIST(log.created_at)}</div>
                  </div>
                  {log.description && <div className="text-xs text-muted-foreground mt-1">{log.description}</div>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
