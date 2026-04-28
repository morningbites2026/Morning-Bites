import { useState } from "react";
import { useStore } from "@/lib/store";
import { dbIns, dbUpd, dbUpdWhere, logActivity, getActivityLogs, getPromotionHistory, formatIST, formatISTDate, getISTISODate, ActivityLog, UPI_ID } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MessageCircle, Edit, Trash2, Search, CalendarDays, History, Megaphone, QrCode, Banknote, CreditCard, RefreshCw, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Walkins() {
  const { walkins, customers, packages, promotions, refresh, searchQuery } = useStore();
  const { toast } = useToast();

  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [subWalkin, setSubWalkin] = useState<any>(null);
  const [subPkgIds, setSubPkgIds] = useState<number[]>([]);
  const [subPayMode, setSubPayMode] = useState<any>("cash");
  const [subCash, setSubCash] = useState("");
  const [subQrOpen, setSubQrOpen] = useState(false);

  const [promoteWalkin, setPromoteWalkin] = useState<any>(null);
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");

  const [historyWalkin, setHistoryWalkin] = useState<any>(null);
  const [historyLogs, setHistoryLogs] = useState<ActivityLog[]>([]);
  const [historyPromoLogs, setHistoryPromoLogs] = useState<ActivityLog[]>([]);
  const [historyTab, setHistoryTab] = useState<'activity' | 'promotions'>('activity');
  const [historyLoading, setHistoryLoading] = useState(false);

  const filteredWalkins = walkins.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.phone.includes(searchQuery)
  );

  const activePackages = packages.filter(p => p.is_active);
  const activePromotions = promotions.filter(p => p.is_active);
  const getCustomerForPhone = (ph: string) => customers.find(c => c.phone === ph);

  const selectedPkgs = activePackages.filter(p => subPkgIds.includes(p.id));
  const subTotal = selectedPkgs.reduce((s, p) => s + p.price, 0);
  const subCashNum = Number(subCash) || 0;
  const subChange = subCashNum - subTotal;
  const upiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${subTotal}&cu=INR`;

  // ─── Add / Edit Walk-in ───────────────────────────────────────────────────
  const handleSaveWalkin = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ variant: "destructive", description: "Name and phone required" });
      return;
    }
    try {
      if (editingId) {
        await dbUpd('walkins', editingId, { name, phone });
        const cust = getCustomerForPhone(phone);
        if (cust) await dbUpd('customers', cust.id, { name, phone });
        logActivity(cust?.id || null, 'edit', `Walk-in info updated: ${name} / ${phone}`);
        toast({ title: "Walk-in updated" });
      } else {
        const msg = `Hello ${name}! 🌱\n\nThank you for visiting Morning Bites today! We're happy to serve you fresh, healthy sprouts food every morning.\n\nWould you like to know about our subscription packs? Ask us in store or reply to this message!\n\nTiming: 6:30 AM to 9:00 AM\nCall us: 9099172237 / 9429929822\n\nMorning Bites 🌿`;
        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');

        const today = getISTISODate();
        await dbIns('walkins', { name, phone, visit_date: today, is_deleted: false });
        const cust = getCustomerForPhone(phone);
        logActivity(cust?.id || null, 'walkin_added', `New walk-in registered: ${name}`);
        toast({ title: "Walk-in added" });
      }
      setIsWalkinModalOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Subscribe / Renew ───────────────────────────────────────────────────
  const handleOpenSubscribe = (w: any) => {
    setSubWalkin(w);
    setSubPkgIds([]);
    setSubPayMode("cash");
    setSubCash("");
    setSubQrOpen(false);
    setIsSubModalOpen(true);
  };

  const handleSubscribe = async () => {
    if (!subWalkin || subPkgIds.length === 0) {
      toast({ variant: "destructive", description: "Please select at least one package" });
      return;
    }
    if (subPayMode === 'scanpay' && !subQrOpen) {
      setSubQrOpen(true);
      return;
    }

    const primaryPkg = selectedPkgs[0];
    const existingCust = getCustomerForPhone(subWalkin.phone);
    const today = getISTISODate();
    const dateDisplay = formatISTDate(today);
    const primaryMeals = primaryPkg?.meals_count ?? 10;

    const msg = selectedPkgs.length === 1
      ? `Hello ${subWalkin.name},\n\nWelcome to Morning Bites! 🌿\n\nYour ${primaryPkg?.name || 'Sprouts Salad'} subscription is now active!\n\n📦 Pack: ${primaryMeals} meals\n💰 Amount: ₹${primaryPkg?.price || 0}\n📅 Start date: ${dateDisplay}\n\nEnjoy fresh sprouts daily!\n✅ Healthy • Hygienic • Tasty\n\n📍 Akota Garden, Near Radha Krishan Circle, Akota, Vadodara\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!\nMorning Bites 🌿`
      : (() => {
          const pkgsList = selectedPkgs.map((p, i) => `${i + 1}. ${p.name} — ${p.meals_count ?? 10} meals — ₹${p.price}`).join('\n');
          const totalMeals = selectedPkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0);
          return `Hello ${subWalkin.name},\n\nWelcome to Morning Bites! 🌿\n\nYour subscriptions are now active!\n\n📦 Packages:\n${pkgsList}\n\n🍽️ Total meals: ${totalMeals}\n💰 Total amount: ₹${subTotal}\n📅 Start date: ${dateDisplay}\n\nEnjoy fresh sprouts daily!\n✅ Healthy • Hygienic • Tasty\n\n📍 Akota Garden, Near Radha Krishan Circle, Akota, Vadodara\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!\nMorning Bites 🌿`;
        })();
    window.open(`https://wa.me/91${subWalkin.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      let custId: number | null = null;

      if (existingCust) {
        await dbUpd('customers', existingCust.id, {
          status: 'active',
          used: 0,
          total: primaryMeals,
          renew_count: existingCust.renew_count + 1,
          last_renewed: today,
          pack_start_date: today,
          package_id: primaryPkg?.id || null,
          payment_mode: subPayMode
        });
        custId = existingCust.id;
      } else {
        const res = await dbIns<any>('customers', {
          name: subWalkin.name,
          phone: subWalkin.phone,
          type: 'subscribed',
          total: primaryMeals,
          used: 0,
          join_date: today,
          renew_count: 0,
          pack_start_date: today,
          status: 'active',
          is_deleted: false,
          preferred_days: [],
          package_id: primaryPkg?.id || null,
          payment_mode: subPayMode
        });
        custId = res[0]?.id || null;
      }

      if (custId) {
        for (const pkg of selectedPkgs) {
          await dbIns('customer_packages', {
            customer_id: custId,
            package_id: pkg.id,
            used: 0,
            total: pkg.meals_count ?? 10,
            pack_start_date: today,
            payment_mode: subPayMode,
            status: 'active',
            renew_count: existingCust ? existingCust.renew_count + 1 : 0,
          });
        }
      }

      // Reset future meal skips on renewal
      if (existingCust && custId) {
        await dbUpdWhere('meal_skips', `customer_id=eq.${custId}&skip_date=gte.${today}&unskipped=eq.false`, { unskipped: true });
      }

      const pkgNames = selectedPkgs.map(p => p.name).join(', ');
      logActivity(custId, existingCust ? 'renewed' : 'subscribed', `${existingCust ? 'Renewed' : 'Subscribed'} to ${pkgNames} for ₹${subTotal}. Payment: ${subPayMode}`);

      toast({ title: existingCust ? "Pack renewed successfully!" : "Subscribed successfully!" });
      setIsSubModalOpen(false);
      setSubQrOpen(false);
      setSubPkgIds([]);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Promote ─────────────────────────────────────────────────────────────
  const handleOpenPromote = (w: any) => {
    setPromoteWalkin(w);
    setSelectedPromoId(activePromotions.length > 0 ? activePromotions[0].id.toString() : "");
  };

  const handleSendPromotion = () => {
    if (!promoteWalkin) return;
    const promo = activePromotions.find(p => p.id.toString() === selectedPromoId);
    if (!promo && activePromotions.length > 0) {
      toast({ variant: "destructive", description: "Please select a promotion" });
      return;
    }

    const msg = promo
      ? `Hello ${promoteWalkin.name}! 🌱\n\n${promo.title}\n\n${promo.description}\n\nMorning Bites 🌿`
      : `Hello ${promoteWalkin.name}! 🌱\n\nWe're Morning Bites – your daily sprouts & healthy snack stall.\n\n✅ Get 10 fresh meals\n🍃 Healthy food every morning\n\nInterested? Visit us or reply to subscribe!\n\nMorning Bites 🌿`;

    // Open WhatsApp synchronously — no await before this
    window.open(`https://wa.me/91${promoteWalkin.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    // Log in background (no await needed)
    const cust = getCustomerForPhone(promoteWalkin.phone);
    logActivity(
      cust?.id || null,
      'promotion_sent',
      `Sent to ${promoteWalkin.name} (${promoteWalkin.phone}): ${promo?.title || 'General promotion'}`,
      {
        promotion_id: promo?.id || null,
        promotion_title: promo?.title || null,
        walkin_id: promoteWalkin.id,
        walkin_name: promoteWalkin.name,
        walkin_phone: promoteWalkin.phone,
      }
    );

    setPromoteWalkin(null);
  };

  // ─── History ─────────────────────────────────────────────────────────────
  const handleOpenHistory = async (w: any) => {
    setHistoryWalkin(w);
    setHistoryLoading(true);
    setHistoryTab('activity');

    const cust = getCustomerForPhone(w.phone);
    let logs: ActivityLog[] = [];
    if (cust) {
      logs = await getActivityLogs(cust.id);
    }

    const allPromoLogs = await getPromotionHistory();
    const walkinPromoLogs = allPromoLogs.filter(l =>
      l.meta?.walkin_phone === w.phone ||
      l.meta?.walkin_id === w.id ||
      (!cust && l.description?.includes(w.phone))
    );

    const custPromoLogs = logs.filter(l => l.action === 'promotion_sent');
    const merged = [...custPromoLogs];
    walkinPromoLogs.forEach(wl => {
      if (!merged.some(cl => cl.id === wl.id)) merged.push(wl);
    });
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setHistoryLogs(logs.filter(l => l.action !== 'promotion_sent'));
    setHistoryPromoLogs(merged);
    setHistoryLoading(false);
  };

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this walk-in?")) {
      try {
        await dbUpd('walkins', id, { is_deleted: true });
        const w = walkins.find(x => x.id === id);
        const cust = w ? getCustomerForPhone(w.phone) : null;
        if (cust) {
          await dbUpd('customers', cust.id, { is_deleted: true });
          logActivity(cust.id, 'deleted', 'Customer deleted (soft)');
        }
        toast({ title: "Deleted from walk-ins and subscriptions" });
        refresh();
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-serif">Walk-ins</h2>
        <Button
          onClick={() => { setEditingId(null); setName(""); setPhone(""); setIsWalkinModalOpen(true); }}
          className="rounded-full shadow-md font-bold px-5"
        >
          <Plus className="w-5 h-5 mr-1.5" /> Add New
        </Button>
      </div>

      <div className="space-y-4 pb-8">
        {filteredWalkins.length === 0 ? (
          <div className="text-center p-12 bg-muted/30 rounded-3xl border border-dashed border-border flex flex-col items-center">
            <Search className="w-8 h-8 text-muted-foreground opacity-50 mb-4" />
            <h3 className="font-bold text-lg mb-1">No walk-ins found</h3>
            <p className="text-muted-foreground text-sm">Add a new walk-in or clear your search.</p>
          </div>
        ) : (
          filteredWalkins.map(w => {
            const cust = getCustomerForPhone(w.phone);
            const isSubbed = cust?.status === 'active';
            const isPrevSub = cust?.status === 'cancelled';

            return (
              <Card key={w.id} className="border border-border shadow-sm hover:shadow-md transition-all overflow-hidden bg-card">
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-serif font-bold text-xl shrink-0 mt-1">
                        {w.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold font-serif text-xl leading-tight">{w.name}</div>
                        <div className="text-sm font-medium text-muted-foreground mt-0.5">{w.phone}</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-muted-foreground/80">
                          <CalendarDays className="w-3.5 h-3.5" /> {w.visit_date}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isSubbed && <Badge className="bg-primary text-primary-foreground font-bold shadow-sm">Subscribed ✓</Badge>}
                      {isPrevSub && <Badge className="bg-secondary text-secondary-foreground font-bold shadow-sm">Prev. Sub</Badge>}
                      {!isSubbed && !isPrevSub && <Badge variant="outline" className="bg-muted font-bold text-muted-foreground border-transparent">Walk-in</Badge>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                    {/* Always show Subscribe/Renew — supports assigning any package at any time */}
                    <Button
                      className={`flex-1 min-w-[120px] rounded-xl h-10 font-bold text-[13px] shadow-sm ${isSubbed ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90' : ''}`}
                      onClick={() => handleOpenSubscribe(w)}
                      variant={isSubbed ? "outline" : "default"}
                    >
                      {isSubbed
                        ? <><RefreshCw className="w-4 h-4 mr-1.5" /> Renew Pack</>
                        : <><Plus className="w-4 h-4 mr-1" /> Subscribe</>
                      }
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-1 min-w-[80px] rounded-xl h-10 font-bold text-[13px] border-secondary/50 text-secondary-foreground bg-secondary/10 hover:bg-secondary/20"
                      onClick={() => handleOpenPromote(w)}
                    >
                      <Megaphone className="w-4 h-4 mr-1.5" /> Promote
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-border bg-card hover:bg-muted"
                      onClick={() => handleOpenHistory(w)}
                      title="History"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-border bg-card hover:bg-muted"
                      onClick={() => { setEditingId(w.id); setName(w.name); setPhone(w.phone); setIsWalkinModalOpen(true); }}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                      onClick={() => handleDelete(w.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add / Edit Walk-in Modal */}
      <Dialog open={isWalkinModalOpen} onOpenChange={setIsWalkinModalOpen}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">{editingId ? "Edit Walk-in" : "Add Walk-in"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Name</Label>
              <Input placeholder="Enter name" value={name} onChange={e => setName(e.target.value)} className="h-14 rounded-xl text-lg px-4" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Phone Number</Label>
              <Input type="tel" placeholder="10-digit number" value={phone} onChange={e => setPhone(e.target.value)} className="h-14 rounded-xl text-lg px-4 font-mono tracking-wider" />
            </div>
            {!editingId && (
              <div className="p-3 bg-green-50 rounded-xl text-xs text-green-800 border border-green-200 flex items-start gap-2">
                <MessageCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>WhatsApp will open immediately on save to send a welcome message.</span>
              </div>
            )}
            {editingId && (() => {
              const editingWalkin = walkins.find(w => w.id === editingId);
              const cust = editingWalkin ? getCustomerForPhone(editingWalkin.phone) : null;
              if (!cust) return null;
              return (
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => {
                    setIsWalkinModalOpen(false);
                    if (editingWalkin) handleOpenSubscribe(editingWalkin);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Another Package
                </Button>
              );
            })()}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveWalkin} className="w-full h-14 text-lg rounded-xl shadow-lg font-bold">
              {editingId ? "Save Changes" : "Add Walk-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscribe / Renew Modal */}
      <Dialog open={isSubModalOpen} onOpenChange={v => { setIsSubModalOpen(v); if (!v) setSubQrOpen(false); }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">
              {getCustomerForPhone(subWalkin?.phone || '')?.status === 'active'
                ? `Renew Pack — ${subWalkin?.name}`
                : `Subscribe — ${subWalkin?.name}`}
            </DialogTitle>
          </DialogHeader>
          {subQrOpen ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl font-black text-primary">₹{subTotal}</div>
              <div className="p-3 bg-white rounded-2xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <p className="text-sm text-muted-foreground">Scan with any UPI app</p>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 h-12 rounded-xl font-bold" onClick={handleSubscribe}>Payment Done</Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setSubQrOpen(false)}>Back</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-6 py-4">
                {getCustomerForPhone(subWalkin?.phone || '')?.status === 'active' && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                    ⚡ This customer already has an active pack. Assigning a new package will reset their count and start fresh (renewal).
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Package(s) — tap to select one or more</Label>
                  <div className="space-y-2">
                    {activePackages.map(p => {
                      const selected = subPkgIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSubPkgIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
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

                {selectedPkgs.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm flex justify-between">
                    <span>{selectedPkgs.length} pack{selectedPkgs.length > 1 ? 's' : ''} — {selectedPkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0)} meals total</span>
                    <span className="font-bold text-primary">₹{subTotal}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Payment Mode</Label>
                  <RadioGroup value={subPayMode} onValueChange={setSubPayMode} className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
                      { value: 'upi', label: 'UPI', icon: <CreditCard className="w-4 h-4" /> },
                      { value: 'scanpay', label: 'Scan', icon: <QrCode className="w-4 h-4" /> },
                    ].map(m => (
                      <div key={m.value} className="flex">
                        <RadioGroupItem value={m.value} id={`sp-${m.value}`} className="peer sr-only" />
                        <Label htmlFor={`sp-${m.value}`} className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-border bg-card p-3 font-bold hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all text-xs">
                          {m.icon} {m.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {subPayMode === 'cash' && subTotal > 0 && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                    <Label className="text-amber-900 font-bold text-xs">Cash Received</Label>
                    <Input type="number" placeholder="₹ Amount" value={subCash} onChange={e => setSubCash(e.target.value)} className="bg-white border-amber-300 h-11" />
                    {subCash !== "" && (
                      <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${subChange >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                        <span>{subChange >= 0 ? 'Change:' : 'Short:'}</span>
                        <span>₹{Math.abs(subChange)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSubscribe} className="w-full h-14 text-lg rounded-xl shadow-lg font-bold" disabled={subPkgIds.length === 0}>
                  {subPayMode === 'scanpay' ? 'Show QR & Activate' : getCustomerForPhone(subWalkin?.phone || '')?.status === 'active' ? 'Renew Pack' : 'Activate Package'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Promote Modal */}
      <Dialog open={!!promoteWalkin} onOpenChange={v => !v && setPromoteWalkin(null)}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Send Promotion to {promoteWalkin?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {activePromotions.length > 0 ? (
              <>
                <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Select Promotion</Label>
                <div className="space-y-2">
                  {activePromotions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPromoId(p.id.toString())}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedPromoId === p.id.toString() ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    >
                      <div className="font-bold text-sm">{p.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl text-center">
                No active promotions yet. Create one in the Promotions tab.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSendPromotion}
              className="w-full h-14 text-lg rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white shadow-lg border-none font-bold"
            >
              <MessageCircle className="w-5 h-5 mr-2" /> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={!!historyWalkin} onOpenChange={v => !v && setHistoryWalkin(null)}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif flex items-center gap-2">
              <History className="w-5 h-5" /> {historyWalkin?.name} — History
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          ) : (
            <Tabs value={historyTab} onValueChange={v => setHistoryTab(v as any)} className="mt-2">
              <TabsList className="grid grid-cols-2 w-full rounded-xl">
                <TabsTrigger value="activity" className="rounded-lg text-xs font-bold">
                  <Activity className="w-3.5 h-3.5 mr-1.5" /> Trail Report ({historyLogs.length})
                </TabsTrigger>
                <TabsTrigger value="promotions" className="rounded-lg text-xs font-bold">
                  <Megaphone className="w-3.5 h-3.5 mr-1.5" /> Promotions ({historyPromoLogs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-3 space-y-2">
                {historyLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</div>
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
              </TabsContent>

              <TabsContent value="promotions" className="mt-3 space-y-2">
                {historyPromoLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">No promotions sent yet.</div>
                ) : (
                  historyPromoLogs.map(log => (
                    <div key={log.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-semibold text-sm">
                          {log.meta?.promotion_title || log.description?.split(': ').pop() || 'Promotion'}
                        </div>
                        <div className="text-[10px] text-muted-foreground text-right shrink-0">{formatIST(log.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
