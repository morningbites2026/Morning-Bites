import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dbDel, dbUpd, formatIST, getISTISODate } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, CalendarDays, ReceiptText, QrCode, Banknote, CreditCard } from "lucide-react";

export default function BillReports() {
  const { bills, refresh, setEditingBill } = useStore();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [period, setPeriod] = useState("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Normalize bill_date to ISO (YYYY-MM-DD) — handles both "29/4/2026" and "29/04/2026"
  const billDateToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return dateStr;
  };

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
    if (period === "custom") {
      const bDate = billDateToISO(b.bill_date);
      if (fromDate && toDate) return bDate >= fromDate && bDate <= toDate;
      if (fromDate) return bDate >= fromDate;
      if (toDate) return bDate <= toDate;
      return true;
    }
    if (period === "today") return billDateToISO(b.bill_date) === getISTISODate();
    if (period === "week") return new Date(b.created_at) >= getWeekStart();
    if (period === "month") return new Date(b.created_at) >= getMonthStart();
    return true;
  });

  const totalRev = filteredBills.reduce((s, b) => s + b.total_amount, 0);
  const cashRev = filteredBills.filter(b => b.payment_mode === 'cash').reduce((s, b) => s + b.total_amount, 0);
  const upiRev = filteredBills.filter(b => b.payment_mode === 'upi').reduce((s, b) => s + b.total_amount, 0);
  const scanRev = filteredBills.filter(b => b.payment_mode === 'scanpay').reduce((s, b) => s + b.total_amount, 0);

  const pendingAmountBills = bills.filter(b => (b.outstanding_balance || 0) > 0 && b.outstanding_status === 'pending');
  const totalPendingAmount = pendingAmountBills.reduce((s, b) => s + (b.outstanding_balance || 0), 0);

  const customerCreditBills = bills.filter(b => (b.advance_balance || 0) > 0 && b.advance_status === 'pending');
  const totalCustomerCredit = customerCreditBills.reduce((s, b) => s + (b.advance_balance || 0), 0);

  const handleEditOpen = (bill: any) => {
    setEditingBill(bill);
    navigate('/billing');
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

  const handleMarkReceived = async (id: number) => {
    try {
      await dbUpd('bills', id, { outstanding_status: 'received' });
      toast({ title: "Pending amount marked as received" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      await dbUpd('bills', id, { advance_status: 'paid' });
      toast({ title: "Customer credit marked as refunded / adjusted" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const getModeIcon = (mode: string) => {
    if (mode === 'cash') return <Banknote className="w-4 h-4 text-green-600" />;
    if (mode === 'upi') return <CreditCard className="w-4 h-4 text-blue-600" />;
    return <QrCode className="w-4 h-4 text-purple-600" />;
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <ReceiptText className="w-5 h-5 text-primary" /> Bill Reports
      </h2>

      <div className="space-y-2">
        <Tabs value={period} onValueChange={v => { setPeriod(v); setFromDate(""); setToDate(""); }} className="w-full">
          <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-4 rounded-xl">
            <TabsTrigger value="today" className="rounded-lg text-xs">Today</TabsTrigger>
            <TabsTrigger value="week" className="rounded-lg text-xs">This Week</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg text-xs">This Month</TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg text-xs">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPeriod("custom"); }}
              className="h-9 text-sm flex-1 sm:w-40"
            />
          </div>
          <span className="text-muted-foreground self-center sm:self-auto text-xs sm:text-sm">to</span>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <Input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setPeriod("custom"); }}
              className="h-9 text-sm flex-1 sm:w-40"
            />
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-xs shrink-0" onClick={() => { setFromDate(""); setToDate(""); setPeriod("all"); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full mt-1">
        <TabsList className="w-full bg-transparent border-b border-border rounded-none p-0 h-auto justify-start gap-4 overflow-x-auto flex-nowrap hide-scrollbar">
          <TabsTrigger value="summary" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-2 text-sm whitespace-nowrap">Summary</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-2 text-sm whitespace-nowrap">History ({filteredBills.length})</TabsTrigger>
          <TabsTrigger value="pending-amount" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-2 text-sm whitespace-nowrap">Pending Amount (₹{totalPendingAmount})</TabsTrigger>
          <TabsTrigger value="customer-credit" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-2 text-sm whitespace-nowrap">Customer Credit (₹{totalCustomerCredit})</TabsTrigger>
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
                    <div className={`${m.color} h-2 rounded-full transition-all`} style={{ width: `${totalRev ? (m.rev / totalRev) * 100 : 0}%` }} />
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
                      {(bill.discount_value ?? 0) > 0 && (
                        <div className="text-xs text-green-700 mt-1">
                          Discount: {bill.discount_type === 'percent' ? `${bill.discount_value}%` : `₹${bill.discount_value}`}
                        </div>
                      )}
                      {bill.notes && (
                        <div className="text-xs italic text-muted-foreground mt-2 border-l-2 border-primary/30 pl-2">"{bill.notes}"</div>
                      )}
                      {((bill.advance_balance || 0) > 0 || (bill.outstanding_balance || 0) > 0) && (
                        <div className="flex flex-col gap-1.5 mt-3">
                          {(bill.advance_balance || 0) > 0 && (
                            <div className="flex items-center justify-between text-xs p-2 bg-green-50 rounded-lg border border-green-200">
                              <span className="font-bold text-green-800">Customer Credit: ₹{bill.advance_balance}</span>
                              {bill.advance_status === 'pending' ? (
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-green-700 hover:text-green-800 hover:bg-green-100 border-green-300" onClick={() => handleMarkPaid(bill.id)}>Refund / Adjust</Button>
                              ) : (
                                <span className="text-[10px] font-black tracking-wider text-green-600 bg-green-100 px-1.5 py-0.5 rounded">REFUNDED/ADJUSTED</span>
                              )}
                            </div>
                          )}
                          {(bill.outstanding_balance || 0) > 0 && (
                            <div className="flex items-center justify-between text-xs p-2 bg-red-50 rounded-lg border border-red-200">
                              <span className="font-bold text-red-800">Pending: ₹{bill.outstanding_balance}</span>
                              {bill.outstanding_status === 'pending' ? (
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-red-700 hover:text-red-800 hover:bg-red-100 border-red-300" onClick={() => handleMarkReceived(bill.id)}>Mark Received</Button>
                              ) : (
                                <span className="text-[10px] font-black tracking-wider text-red-600 bg-red-100 px-1.5 py-0.5 rounded">RECEIVED</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-xl font-black text-primary">₹{bill.total_amount}</div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleEditOpen(bill)}
                          title="Edit bill"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleDelete(bill.id)}
                        >
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

        <TabsContent value="pending-amount" className="mt-4">
          <div className="space-y-3 pb-8">
            {pendingAmountBills.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                <ReceiptText className="w-12 h-12 opacity-20 mb-2" />
                <p>No pending amount bills found.</p>
              </div>
            ) : (
              pendingAmountBills.map(bill => (
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
                      <div className="flex items-center justify-between text-xs p-2 bg-red-50 rounded-lg border border-red-200 mt-3 min-w-[200px]">
                        <span className="font-bold text-red-800">Pending: ₹{bill.outstanding_balance}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-red-700 hover:text-red-800 hover:bg-red-100 border-red-300" onClick={() => handleMarkReceived(bill.id)}>Mark Received</Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-xl font-black text-primary">₹{bill.total_amount}</div>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleEditOpen(bill)} title="Edit bill">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="customer-credit" className="mt-4">
          <div className="space-y-3 pb-8">
            {customerCreditBills.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                <ReceiptText className="w-12 h-12 opacity-20 mb-2" />
                <p>No customer credit bills found.</p>
              </div>
            ) : (
              customerCreditBills.map(bill => (
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
                      <div className="flex items-center justify-between text-xs p-2 bg-green-50 rounded-lg border border-green-200 mt-3 min-w-[200px]">
                        <span className="font-bold text-green-800">Customer Credit: ₹{bill.advance_balance}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-green-700 hover:text-green-800 hover:bg-green-100 border-green-300" onClick={() => handleMarkPaid(bill.id)}>Refund / Adjust</Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-xl font-black text-primary">₹{bill.total_amount}</div>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleEditOpen(bill)} title="Edit bill">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
