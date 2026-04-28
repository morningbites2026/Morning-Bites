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
import { Check, Undo2, SkipForward, RefreshCw, Trash2, Edit, MessageCircle, ChevronLeft, ChevronRight, History, Plus, Banknote, CreditCard, QrCode, Ban } from "lucide-react";
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

// WhatsApp message builders
const buildMealUpdateMsg = (name: string, used: number, remaining: number, total: number) =>
  `Hello ${name},\n\nHere is your Morning Bites meal update:\n✅ Meals used so far: ${used}\n🥗 Meals remaining: ${remaining}\n📦 Total meals in pack: ${total}\n\nEnjoy your fresh sprouts every morning and stay healthy!\n\nTiming: 6:30 AM to 9:00 AM\nCall us: 9099172237 / 9429929822\n\nThank you,\nMorning Bites 🌿`;

const buildRenewPackMsg = (name: string, remaining: number, total: number, price: number) =>
  `Hello ${name},\n\nYou currently have ${remaining} meal(s) remaining.\n\nRenew your pack today!\n🎉 ${total} fresh sprout meals for just ₹${price}!\n\n📍 Akota Garden, Vadodara\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nThank you,\nMorning Bites 🌿`;

const buildPackDoneMsg = (name: string, total: number, price: number) =>
  `Hello ${name},\n\nAll ${total} meals have been used.\n\nRenew today!\n🎉 ${total} fresh sprout meals for just ₹${price}!\n\n📍 Akota Garden, Vadodara\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nThank you,\nMorning Bites 🌿`;

const buildActiveSubMsg = (name: string, pkgName: string, total: number, price: number, startDate: string) =>
  `Hello ${name},\n\nWelcome to Morning Bites! 🌿\n\nYour ${pkgName} subscription is now active!\n\n📦 Pack: ${total} meals\n💰 Amount: ₹${price}\n📅 Start date: ${startDate}\n\nEnjoy fresh sprouts daily!\n✅ Healthy • Hygienic • Tasty\n\n📍 Akota Garden, Near Radha Krishan Circle, Akota, Vadodara\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!\nMorning Bites 🌿`;

const buildActiveSubMsgMulti = (name: string, pkgs: Package[], startDate: string) => {
  const pkgsList = pkgs.map((p, i) => `${i + 1}. ${p.name} — ${p.meals_count ?? 10} meals — ₹${p.price}`).join('\n');
  const totalPrice = pkgs.reduce((s, p) => s + p.price, 0);
  const totalMeals = pkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0);
  return `Hello ${name},\n\nWelcome to Morning Bites! 🌿\n\nYour subscriptions are now active!\n\n📦 Packages:\n${pkgsList}\n\n🍽️ Total meals: ${totalMeals}\n💰 Total amount: ₹${totalPrice}\n📅 Start date: ${startDate}\n\nEnjoy fresh sprouts daily!\n✅ Healthy • Hygienic • Tasty\n\n📍 Akota Garden, Near Radha Krishan Circle, Akota, Vadodara\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!\nMorning Bites 🌿`;
};

export default function Subscribed() {
  const { customers, packages, walkins, mealSkips, customerPackages, refresh, searchQuery } = useStore();
  const { toast } = useToast();

  const [filter, setFilter] = useState("all");

  const [notifyModal, setNotifyModal] = useState<{ open: boolean; customer: any; type: string; cp: CustomerPackage | null }>({ open: false, customer: null, type: "", cp: null });
  const [skipModal, setSkipModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [skipDate, setSkipDate] = useState(getISTISODate());
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
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPkgIds, setAddPkgIds] = useState<number[]>([]);
  const [addPayMode, setAddPayMode] = useState("cash");
  const [addCash, setAddCash] = useState("");
  const [addQrOpen, setAddQrOpen] = useState(false);

  const [historyModal, setHistoryModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [historyLogs, setHistoryLogs] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [mealUsedModal, setMealUsedModal] = useState<{ open: boolean; customer: any; used: number; total: number; pkgName: string }>({ open: false, customer: null, used: 0, total: 0, pkgName: '' });

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

    const msg = selectedAddPkgs.length === 1
      ? buildActiveSubMsg(addName, primaryPkg?.name || 'Sprouts Salad', primaryMeals, primaryPkg?.price || 0, dateDisplay)
      : buildActiveSubMsgMulti(addName, selectedAddPkgs, dateDisplay);
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
        await dbIns('walkins', { name: addName, phone: addPhone, visit_date: today, is_deleted: false });
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
          });
        }
      }

      const pkgNames = selectedAddPkgs.map(p => p.name).join(', ');
      logActivity(custId, existingCust ? 'renewed' : 'subscribed', `${existingCust ? 'Renewed' : 'Subscribed'} to ${pkgNames} for ₹${addTotal}. Payment: ${addPayMode}`);

      toast({ title: existingCust ? "Pack renewed!" : "Customer added and subscribed!" });
      setAddModal(false);
      setAddQrOpen(false);
      setAddName(""); setAddPhone(""); setAddPkgIds([]); setAddPayMode("cash"); setAddCash("");
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
  const handleUseMeal = async (c: any, cp: CustomerPackage | null) => {
    const currentUsed = cp ? cp.used : c.used;
    const currentTotal = cp ? cp.total : c.total;
    if (currentUsed >= currentTotal) return;

    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { used: cp.used + 1 });
        await dbUpd('customers', c.id, { used: c.used + 1 });
      } else {
        await dbUpd('customers', c.id, { used: c.used + 1 });
      }
      const newUsed = currentUsed + 1;
      await logActivity(c.id, 'meal_used', `Meal used. Now ${newUsed}/${currentTotal}`);
      const pkg = packages.find(p => p.id === (cp ? cp.package_id : c.package_id));
      refresh();
      setMealUsedModal({ open: true, customer: c, used: newUsed, total: currentTotal, pkgName: pkg?.name || '' });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleSendMealUpdate = (customer: any, used: number, remaining: number, total: number) => {
    const msg = buildMealUpdateMsg(customer.name, used, remaining, total);
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
  const handleRenew = async (c: any, cp: CustomerPackage | null) => {
    if (!window.confirm(`Renew pack for ${c.name}?`)) return;

    const pkgId = cp ? cp.package_id : c.package_id;
    const pkg = packages.find(p => p.id === pkgId);
    const today = getISTISODate();
    const dateDisplay = formatISTDate(today);
    const mealsCount = pkg?.meals_count ?? cp?.total ?? 10;

    const msg = buildActiveSubMsg(c.name, pkg?.name || 'Sprouts Salad', mealsCount, pkg?.price || 0, dateDisplay);
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, {
          used: 0,
          total: mealsCount,
          renew_count: cp.renew_count + 1,
          last_renewed: today,
          pack_start_date: today,
          status: 'active'
        });
        await dbUpd('customers', c.id, {
          used: 0, total: mealsCount,
          renew_count: c.renew_count + 1,
          last_renewed: today, pack_start_date: today, status: 'active'
        });
      } else {
        await dbUpd('customers', c.id, {
          used: 0, total: mealsCount,
          renew_count: c.renew_count + 1,
          last_renewed: today, pack_start_date: today, status: 'active'
        });
      }
      // Clear all future skips on renewal
      await dbUpdWhere('meal_skips', `customer_id=eq.${c.id}&skip_date=gte.${today}&unskipped=eq.false`, { unskipped: true });

      logActivity(c.id, 'renewed', `Pack renewed (×${c.renew_count + 1}). Package: ${pkg?.name || 'unknown'}`);
      toast({ title: "Pack renewed successfully!" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
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
      const msg = `Hello ${c.name},\n\nYour Morning Bites subscription has been cancelled.\n\n📊 Meals Used: ${used}/${total}\n💰 Refund Amount: ₹${refundAmount} (${total - used} meals × ₹${pricePerMeal})\n\nWe hope to see you again! 🌿\n\nMorning Bites`;
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

    let msg = "";
    if (notifyModal.type === 'meal') {
      msg = buildMealUpdateMsg(c.name, used, remaining, total);
    } else if (notifyModal.type === 'low') {
      msg = buildRenewPackMsg(c.name, remaining, total, price);
    } else if (notifyModal.type === 'done') {
      msg = buildPackDoneMsg(c.name, total, price);
    }
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setNotifyModal({ open: false, customer: null, type: "", cp: null });
  };

  // ─── Skip ─────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    const c = skipModal.customer;
    if (!c || !skipDate) return;

    const d = new Date(skipDate + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-IN');
    const msg = `Hello ${c.name},\n\nConfirmed — your Morning Bites pack is skipped for:\n\n📅 ${dayName}, ${dateStr}\n\nYour remaining meals stay the same. See you on your next day!\n\nMorning Bites 🌿`;
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      await dbIns('meal_skips', { customer_id: c.id, skip_date: skipDate, notified: true, unskipped: false });
      logActivity(c.id, 'meal_skipped', `Meal skipped for ${skipDate}`);
      setSkipModal({ open: false, customer: null });
      toast({ title: "Meal skipped & WhatsApp opened" });
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

  // ─── Preferred days ───────────────────────────────────────────────────────
  const handleTogglePrefDay = async (c: any, dayIdx: number) => {
    let newPrefs = [...(c.preferred_days || [])];
    if (newPrefs.length === 0) {
      newPrefs = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
    } else {
      if (newPrefs.includes(dayIdx)) {
        newPrefs = newPrefs.filter(d => d !== dayIdx);
      } else {
        newPrefs.push(dayIdx);
      }
    }
    if (newPrefs.length === 6) newPrefs = [];
    try {
      await dbUpd('customers', c.id, { preferred_days: newPrefs });
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
      await logActivity(c.id, 'edit', `Info updated: name=${editName}, phone=${editPhone}, pkg=${editPkg}, mode=${editMode}`);
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
    const logs = await getActivityLogs(c.id);
    setHistoryLogs(logs);
    setHistoryLoading(false);
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
            setAddPkgIds([]); setAddPayMode("cash"); setAddCash("");
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
                      {custPacks.length > 1 ? (
                        <Select
                          value={(selectedCpId[c.id] || custPacks[0]?.id)?.toString()}
                          onValueChange={v => setSelectedCpId(p => ({ ...p, [c.id]: Number(v) }))}
                        >
                          <SelectTrigger className="h-7 text-xs border-primary/20 text-primary w-auto min-w-[100px] max-w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {custPacks.map(xcp => {
                              const xpkg = packages.find(p => p.id === xcp.package_id);
                              return (
                                <SelectItem key={xcp.id} value={xcp.id.toString()}>
                                  {xpkg?.name || 'Pack'} ({xcp.total - xcp.used} left)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : pkg ? (
                        <div className="text-[11px] font-semibold text-primary/80 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                          {pkg.name}
                        </div>
                      ) : null}

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
                        const isScheduled = c.preferred_days.length === 0 || c.preferred_days.includes(i);
                        const skip = mealSkips.find(s => s.customer_id === c.id && s.skip_date === d.iso && !s.unskipped);
                        const isSkipped = !!skip;
                        const isToday = d.iso === getISTISODate();
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              if (isSkipped && skip) {
                                handleUnskip(skip.id, c.id);
                              } else {
                                handleTogglePrefDay(c, i);
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
                      <Button
                        onClick={() => handleUseMeal(c, cp)}
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
                        onClick={() => { setSkipModal({ open: true, customer: c }); setSkipDate(getISTISODate()); }}
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
      <Dialog open={addModal} onOpenChange={v => { setAddModal(v); if (!v) setAddQrOpen(false); }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Add Subscriber</DialogTitle>
          </DialogHeader>
          {addQrOpen ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl font-black text-primary">₹{addTotal}</div>
              <div className="p-3 bg-white rounded-2xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(addUpiUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
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
              onClick={() => handleSendMealUpdate(mealUsedModal.customer, mealUsedModal.used, mealUsedModal.total - mealUsedModal.used, mealUsedModal.total)}
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
      <Dialog open={skipModal.open} onOpenChange={o => !o && setSkipModal({ ...skipModal, open: false })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Skip Meal</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <Label>Skip Date</Label>
              <Input type="date" value={skipDate} onChange={e => setSkipDate(e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="p-3 bg-primary/5 rounded-xl text-sm text-primary border border-primary/20">
              A skip confirmation message will be sent to {skipModal.customer?.name} on WhatsApp.
            </div>
            <div className="p-3 bg-orange-50 rounded-xl text-xs text-orange-700 border border-orange-200">
              To remove a skip later, tap the orange day in the schedule grid.
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
