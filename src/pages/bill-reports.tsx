import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { dbUpd, dbDel, formatIST, getISTDateDisplay, UPI_ID } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, CalendarDays, ReceiptText, QrCode, Banknote, CreditCard, Plus, Minus } from "lucide-react";

export default function BillReports() {
  const { bills, menuItems, refresh } = useStore();
  const { toast } = useToast();

  const [period, setPeriod] = useState("today");
  const [dateFilter, setDateFilter] = useState("");

  const [editBill, setEditBill] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editMode, setEditMode] = useState<any>("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<Array<{ name: string; option: string; price: number; qty: number }>>([]);
  const [editQrOpen, setEditQrOpen] = useState(false);

  const today = getISTDateDisplay();

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(d.setDate(diff));
  };

  const getMonthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };

  const filteredBills = bills.filter(b => {
    if (dateFilter) {
      const billDate = new Date(b.created_at);
      const filterDate = new Date(dateFilter);
      return billDate.toDateString() === filterDate.toDateString();
    }
    if (period === "today") return b.bill_date === today;
    if (period === "week") {
      const billDate = new Date(b.created_at);
      return billDate >= getWeekStart();
    }
    if (period === "month") {
      const billDate = new Date(b.created_at);
      return billDate >= getMonthStart();
    }
    return true;
  });

  const totalRev = filteredBills.reduce((s, b) => s + b.total_amount, 0);
  const cashRev = filteredBills.filter(b => b.payment_mode === 'cash').reduce((s, b) => s + b.total_amount, 0);
  const upiRev = filteredBills.filter(b => b.payment_mode === 'upi').reduce((s, b) => s + b.total_amount, 0);
  const scanRev = filteredBills.filter(b => b.payment_mode === 'scanpay').reduce((s, b) => s + b.total_amount, 0);

  const handleEditOpen = (bill: any) => {
    setEditBill(bill);
    setEditName(bill.customer_name || "");
    setEditMode(bill.payment_mode);
    setEditNotes(bill.notes || "");
    setEditItems(JSON.parse(JSON.stringify(bill.items)));
    setEditQrOpen(false);
  };

  const editTotal = editItems.reduce((s, it) => s + it.price * it.qty, 0);

  const handleEditQtyChange = (idx: number, delta: number) => {
    if (idx < 0) return;
    setEditItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: Math.max(0, next[idx].qty + delta) };
      return next.filter((_, i) => i !== idx || next[idx].qty > 0);
    });
  };

  const handleAddMenuItemToEdit = (menuItem: any, optIdx: number) => {
    const opt = menuItem.options[optIdx];
    const existing = editItems.findIndex(it => it.name === menuItem.name && it.option === opt.name);
    if (existing >= 0) {
      const next = [...editItems];
      next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
      setEditItems(next);
    } else {
      setEditItems(prev => [...prev, { name: menuItem.name, option: opt.name, price: opt.price, qty: 1 }]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editBill) return;
    if (editMode === 'scanpay' && !editQrOpen) {
      setEditQrOpen(true);
      return;
    }
    try {
      await dbUpd('bills', editBill.id, {
        customer_name: editName || null,
        items: editItems,
        total_amount: editTotal,
        payment_mode: editMode,
        notes: editNotes || null
      });
      toast({ title: "Bill updated" });
      setEditBill(null);
      setEditQrOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this bill?")) {
      try {
        await dbDel('bills', id);
        toast({ title: "Bill deleted" });
        refresh();
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      }
    }
  };

  const getModeIcon = (mode: string) => {
    if (mode === 'cash') return <Banknote className="w-4 h-4 text-green-600" />;
    if (mode === 'upi') return <CreditCard className="w-4 h-4 text-blue-600" />;
    return <QrCode className="w-4 h-4 text-purple-600" />;
  };

  const activeMenuItems = menuItems.filter(m => m.is_active);
  const upiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${editTotal}&cu=INR`;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <ReceiptText className="w-5 h-5 text-primary" /> Bill Reports
      </h2>

      <div className="space-y-2">
        <Tabs value={period} onValueChange={v => { setPeriod(v); setDateFilter(""); }} className="w-full">
          <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-4 rounded-xl">
            <TabsTrigger value="today" className="rounded-lg text-xs">Today</TabsTrigger>
            <TabsTrigger value="week" className="rounded-lg text-xs">This Week</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg text-xs">This Month</TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg text-xs">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPeriod("all"); }}
            className="h-9 text-sm flex-1"
            placeholder="Filter by date"
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setDateFilter("")}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full mt-1">
        <TabsList className="w-full bg-transparent border-b border-border rounded-none p-0 h-auto justify-start gap-4">
          <TabsTrigger value="summary" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-2 text-sm">Summary</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-2 text-sm">History ({filteredBills.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border bg-primary text-primary-foreground shadow-md">
              <CardContent className="p-4">
                <div className="text-sm font-medium opacity-90">Total Revenue</div>
                <div className="text-2xl font-black mt-1">₹{totalRev}</div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Total Bills</div>
                <div className="text-2xl font-bold mt-1 text-foreground">{filteredBills.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="p-4 pb-2 bg-muted/30">
              <CardTitle className="text-sm">Revenue by Payment Mode</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                { label: 'Cash', icon: <Banknote className="w-4 h-4 text-green-600" />, rev: cashRev, color: 'bg-green-500' },
                { label: 'UPI', icon: <CreditCard className="w-4 h-4 text-blue-600" />, rev: upiRev, color: 'bg-blue-500' },
                { label: 'Scan & Pay', icon: <QrCode className="w-4 h-4 text-purple-600" />, rev: scanRev, color: 'bg-purple-500' },
              ].map(m => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 font-medium">{m.icon} {m.label}</div>
                    <div className="font-bold">₹{m.rev}</div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`${m.color} h-2 rounded-full transition-all`} style={{ width: `${totalRev ? (m.rev / totalRev) * 100 : 0}%` }}></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="space-y-3 pb-8">
            {filteredBills.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                <ReceiptText className="w-12 h-12 opacity-20 mb-2" />
                <p>No bills found for this period.</p>
              </div>
            ) : (
              filteredBills.map(bill => (
                <Card key={bill.id} className="border-border shadow-sm overflow-hidden">
                  <div className="p-3 bg-muted/30 flex justify-between items-center border-b border-border">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <CalendarDays className="w-3 h-3" />
                        {bill.bill_date}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">
                        {formatIST(bill.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getModeIcon(bill.payment_mode)}
                      <span className="text-xs uppercase tracking-wider font-bold opacity-70">{bill.payment_mode}</span>
                    </div>
                  </div>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-base">{bill.customer_name || "Walk-in"}</div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {bill.items.map((it, idx) => (
                          <div key={idx}>{it.qty}× {it.name} ({it.option}) — ₹{it.price * it.qty}</div>
                        ))}
                      </div>
                      {bill.notes && (
                        <div className="text-xs italic text-muted-foreground mt-2 border-l-2 border-primary/30 pl-2">"{bill.notes}"</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-xl font-black text-primary">₹{bill.total_amount}</div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleEditOpen(bill)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDelete(bill.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editBill} onOpenChange={(o) => !o && setEditBill(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl w-[92%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4" /> Edit Bill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Walk-in" />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>

              {/* Legacy items: in bill but no longer in active menu */}
              {editItems.filter(it => !activeMenuItems.some(m => m.name === it.name)).map((it, _) => {
                const realIdx = editItems.indexOf(it);
                return (
                  <div key={realIdx} className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{it.name} ({it.option})</div>
                      <div className="text-xs text-muted-foreground">₹{it.price} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleEditQtyChange(realIdx, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-5 text-center font-bold text-sm">{it.qty}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleEditQtyChange(realIdx, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Menu items — same layout as billing screen */}
              <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                {activeMenuItems.map(item => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{item.name}</span>
                    </div>
                    {item.options.map((opt, optIdx) => {
                      const existingIdx = editItems.findIndex(it => it.name === item.name && it.option === opt.name);
                      const qty = existingIdx >= 0 ? editItems[existingIdx].qty : 0;
                      return (
                        <div key={optIdx} className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{opt.name}</span>
                            <span className="text-xs text-muted-foreground">₹{opt.price}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleEditQtyChange(existingIdx, -1)} disabled={qty === 0}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-5 text-center font-bold text-sm">{qty}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleAddMenuItemToEdit(item, optIdx)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-border">
              <Label className="text-muted-foreground">New Total</Label>
              <span className="text-2xl font-black text-primary">₹{editTotal}</span>
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <RadioGroup value={editMode} onValueChange={setEditMode} className="grid grid-cols-3 gap-2">
                {['cash', 'upi', 'scanpay'].map(m => (
                  <div key={m}>
                    <RadioGroupItem value={m} id={`em-${m}`} className="peer sr-only" />
                    <Label htmlFor={`em-${m}`} className="flex items-center justify-center rounded-xl border-2 border-muted bg-popover p-2.5 hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all text-xs font-semibold capitalize">
                      {m === 'scanpay' ? 'Scan' : m}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Edit Notes / Description</Label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Add a note about this edit..."
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} className="w-full h-12 rounded-xl text-base font-bold">
              {editMode === 'scanpay' && !editQrOpen ? "Show QR & Save" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editQrOpen} onOpenChange={setEditQrOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl w-[90%] text-center p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-center">Scan & Pay</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-3xl font-black text-primary">₹{editTotal}</div>
            <div className="p-3 bg-white rounded-2xl border">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`} alt="QR" className="w-40 h-40" />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button className="w-full h-12 rounded-xl font-bold" onClick={handleSaveEdit}>Payment Done – Save Bill</Button>
            <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => setEditQrOpen(false)}>Back</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
