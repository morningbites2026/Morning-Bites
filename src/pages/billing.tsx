import { useState } from "react";
import { useStore } from "@/lib/store";
import { dbIns, getISTISODate, formatISTDate } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UPI_ID } from "@/lib/supabase";
import { Plus, Minus, Receipt, QrCode, Banknote, CreditCard, ChevronDown, ChevronRight, Tag, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Billing() {
  const { menuItems, refresh } = useStore();
  const { toast } = useToast();

  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'scanpay'>('cash');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cashReceived, setCashReceived] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState("");
  const [customTotal, setCustomTotal] = useState("");
  const [billDate, setBillDate] = useState(getISTISODate());

  const todayDayIdx = (new Date().getDay() + 6) % 7;

  const activeMenuItems = menuItems
    .filter(m => {
      if (!m.is_active) return false;
      if ((m.category || 'daily') === 'week_special') {
        const days = m.week_days || [];
        return days.length === 0 || days.includes(todayDayIdx);
      }
      return true;
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  const handleQtyChange = (itemId: number, optIdx: number, delta: number) => {
    const key = `${itemId}-${optIdx}`;
    setQuantities(prev => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: next };
    });
  };

  const toggleGroup = (itemId: number) => {
    setExpandedGroup(prev => prev === itemId ? null : itemId);
  };

  const cartItems: Array<{ name: string; option: string; price: number; qty: number }> = [];
  let subtotal = 0;
  activeMenuItems.forEach(item => {
    item.options.forEach((opt, idx) => {
      const qty = quantities[`${item.id}-${idx}`] || 0;
      if (qty > 0) {
        cartItems.push({ name: item.name, option: opt.name, price: opt.price, qty });
        subtotal += opt.price * qty;
      }
    });
  });

  const discountNum = Number(discountValue) || 0;
  const discountAmount = discountType === 'percent'
    ? Math.round(subtotal * discountNum / 100)
    : discountNum;

  const autoTotal = Math.max(0, subtotal - discountAmount);
  const finalTotal = customTotal !== "" ? Number(customTotal) || 0 : autoTotal;

  const cashReceivedNum = Number(cashReceived) || 0;
  const change = cashReceivedNum - finalTotal;

  const handleGenerateBill = async () => {
    if (cartItems.length === 0) {
      toast({ variant: "destructive", description: "Add at least one item." });
      return;
    }
    if (paymentMode === 'scanpay' && !showQrModal) {
      setShowQrModal(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await dbIns('bills', {
        customer_name: customerName || null,
        items: cartItems,
        total_amount: finalTotal,
        payment_mode: paymentMode,
        notes: notes || null,
        bill_date: formatISTDate(billDate)
      });
      toast({ title: "Bill generated successfully" });
      setCustomerName("");
      setNotes("");
      setPaymentMode("cash");
      setQuantities({});
      setCashReceived("");
      setDiscountValue("");
      setCustomTotal("");
      setBillDate(getISTISODate());
      setShowQrModal(false);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const upiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${finalTotal}&cu=INR`;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" /> New Bill
        </h2>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Customer Name (Optional)</Label>
              <Input
                placeholder="Enter name"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Bill Date</Label>
              <Input
                type="date"
                value={billDate}
                onChange={e => setBillDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {/* Menu Items — grouped with collapse/expand */}
          <div className="space-y-2 pt-4 border-t border-border">
            <Label className="text-base">Menu Items</Label>
            <div className="flex flex-col gap-1.5">
              {activeMenuItems.map(item => {
                const itemQty = item.options.reduce((s, _, idx) => s + (quantities[`${item.id}-${idx}`] || 0), 0);
                const isOpen = expandedGroup === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-semibold text-sm">{item.name}</span>
                        {(item.category || 'daily') === 'week_special' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold">Week Special</span>
                        )}
                      </div>
                      {itemQty > 0 && (
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{itemQty} added</span>
                      )}
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1.5 p-2 bg-background">
                        {item.options.map((opt, idx) => {
                          const qty = quantities[`${item.id}-${idx}`] || 0;
                          return (
                            <div key={idx} className="flex items-center justify-between bg-muted/20 p-2 rounded-md">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{opt.name}</span>
                                <span className="text-xs text-muted-foreground">₹{opt.price}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary/10 hover:text-primary"
                                  onClick={() => handleQtyChange(item.id, idx, -1)}
                                  disabled={qty === 0}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <span className="w-6 text-center font-bold text-lg">{qty}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary/10 hover:text-primary"
                                  onClick={() => handleQtyChange(item.id, idx, 1)}
                                >
                                  <Plus className="w-4 h-4" />
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
          </div>

          {/* Cart Summary */}
          {cartItems.length > 0 && (
            <div className="bg-muted/20 rounded-xl border border-border p-3 space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Cart</div>
              {cartItems.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span>{it.qty}× {it.name} <span className="text-muted-foreground">({it.option})</span></span>
                  <span className="font-semibold">₹{it.price * it.qty}</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border flex justify-between text-sm font-bold">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-2 border-t border-border">
            {/* Discount */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Discount (Optional)</Label>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-border overflow-hidden">
                  {(['amount', 'percent'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setDiscountType(t); setDiscountValue(""); setCustomTotal(""); }}
                      className={cn("px-3 py-2 text-xs font-bold transition-all", discountType === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}
                    >
                      {t === 'amount' ? '₹' : '%'}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder={discountType === 'amount' ? "₹ discount" : "% discount"}
                  value={discountValue}
                  onChange={e => { setDiscountValue(e.target.value); setCustomTotal(""); }}
                  className="flex-1"
                />
              </div>
              {discountAmount > 0 && (
                <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                  Discount: −₹{discountAmount} {discountType === 'percent' ? `(${discountNum}% of ₹${subtotal})` : ''}
                </div>
              )}
            </div>

            {/* Total — editable */}
            <div className="space-y-2">
              <Label className="text-base text-muted-foreground">Total Amount</Label>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-black text-primary w-24">₹{finalTotal}</div>
                <div className="flex-1 space-y-1">
                  <Input
                    type="number"
                    placeholder="Override total (optional)"
                    value={customTotal}
                    onChange={e => setCustomTotal(e.target.value)}
                    className="text-sm h-9"
                  />
                  <div className="text-[10px] text-muted-foreground">Edit to override calculated total</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Payment Mode</Label>
              <RadioGroup
                value={paymentMode}
                onValueChange={(val: any) => setPaymentMode(val)}
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { value: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
                  { value: 'upi', label: 'UPI', icon: <CreditCard className="w-4 h-4" /> },
                  { value: 'scanpay', label: 'Scan & Pay', icon: <QrCode className="w-4 h-4" /> },
                ].map(m => (
                  <div key={m.value}>
                    <RadioGroupItem value={m.value} id={`pm-${m.value}`} className="peer sr-only" />
                    <Label
                      htmlFor={`pm-${m.value}`}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all text-xs font-semibold"
                    >
                      {m.icon}
                      {m.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {paymentMode === 'cash' && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-900/50 space-y-3">
                <Label className="text-amber-900 dark:text-amber-500 font-bold">Cash Received</Label>
                <Input
                  type="number"
                  placeholder="₹ Amount received"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="bg-white dark:bg-black/50 border-amber-300 dark:border-amber-800 h-12 text-lg font-bold"
                />
                {cashReceived !== "" && finalTotal > 0 && (
                  <div className={`flex justify-between items-center font-medium p-2 rounded-lg ${change >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                    <span>{change >= 0 ? 'Change to return:' : 'Amount short:'}</span>
                    <span className="text-xl font-bold">₹{Math.abs(change)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any special requests..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button
            className="w-full text-lg h-14 rounded-xl shadow-lg transition-all"
            onClick={handleGenerateBill}
            disabled={isSubmitting || cartItems.length === 0}
          >
            {paymentMode === 'scanpay' ? "Generate & Show QR" : "Generate Bill"}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md text-center max-w-[90%] w-full rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-center">Scan & Pay</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-6 py-6">
            <div className="text-4xl font-black text-primary">₹{finalTotal}</div>
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`}
                alt="UPI QR Code"
                className="w-48 h-48"
              />
            </div>
            <div className="text-sm text-muted-foreground">Scan with any UPI app</div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-3">
            <Button className="w-full h-12 text-lg rounded-xl" onClick={handleGenerateBill} disabled={isSubmitting}>
              Payment Done
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => { setShowQrModal(false); setPaymentMode('cash'); }}>
              Change to Cash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
