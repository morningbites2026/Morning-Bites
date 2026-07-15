import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, Search, Calendar, Info, IndianRupee, X } from "lucide-react";

export default function RecipeCosting() {
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense
  } = useStore();

  // --- Logger Form State ---
  const [expenseTitle, setExpenseTitle] = useState<string>("");
  const [expenseDescription, setExpenseDescription] = useState<string>("");
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- Filter State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default: last 30 days
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  });
  const [toDate, setToDate] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  });

  // --- Form Handlers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseDescription.trim() || !expenseAmount) return;

    setIsSaving(true);
    try {
      if (editingId) {
        await updateExpense(
          editingId,
          expenseTitle.trim(),
          expenseDescription.trim(),
          Number(expenseAmount),
          expenseDate
        );
        setEditingId(null);
      } else {
        await addExpense(
          expenseTitle.trim(),
          expenseDescription.trim(),
          Number(expenseAmount),
          expenseDate
        );
      }
      setExpenseTitle("");
      setExpenseDescription("");
      setExpenseAmount("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (e: any) => {
    setEditingId(e.id);
    setExpenseTitle(e.title || "");
    setExpenseDescription(e.description);
    setExpenseAmount(e.amount.toString());
    setExpenseDate(e.expense_date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setExpenseTitle("");
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExpense(id);
      if (editingId === id) {
        handleCancelEdit();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Filtered Expenses ---
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses
      .filter(e => {
        // Date match (IST)
        if (fromDate && e.expense_date < fromDate) return false;
        if (toDate && e.expense_date > toDate) return false;
        
        // Keyword match
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (e.title || "").toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
  }, [expenses, fromDate, toDate, searchQuery]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300 pb-8">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <IndianRupee className="w-5 h-5 text-primary" /> Expenses
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* --- LEFT COLUMN: Log / Edit Expense Form --- */}
        <div className="md:col-span-4">
          <Card className="border border-border shadow-sm sticky top-20">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">
                {editingId ? "Edit Expense" : "Log Expense"}
              </CardTitle>
              <CardDescription className="text-xs">
                {editingId ? "Modify the expense details below." : "Enter daily store expense details."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Title</Label>
                  <Input
                    placeholder="e.g. Vegetables, Packaging, Rent"
                    value={expenseTitle}
                    onChange={e => setExpenseTitle(e.target.value)}
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Description</Label>
                  <Textarea
                    placeholder="e.g. Tomato, Salad Box, Milk"
                    value={expenseDescription}
                    onChange={e => setExpenseDescription(e.target.value)}
                    className="rounded-xl min-h-[80px]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expense Date</Label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 rounded-xl h-11 text-xs font-semibold shadow-sm"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : editingId ? "Save Changes" : "Log Expense"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="rounded-xl h-11 text-xs font-semibold border-border"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT COLUMN: Expenses Filter & Log List --- */}
        <div className="md:col-span-8 space-y-4">
          {/* Filters Card */}
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search title or description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs rounded-lg"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expense Log List Card */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Expense Log</CardTitle>
                <CardDescription className="text-xs">
                  Showing {filteredExpenses.length} entries for selected period
                </CardDescription>
              </div>
              <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-transparent py-1 px-3.5 rounded-full font-bold">
                Total: ₹{totalFilteredAmount}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {filteredExpenses.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground text-xs">
                  No expenses logged matching the selected filters.
                </div>
              ) : (
                <div className="divide-y divide-border border-t border-border max-h-[500px] overflow-y-auto bg-muted/5 dark:bg-card">
                  {filteredExpenses.map(e => (
                    <div key={e.id} className="p-3.5 flex justify-between items-center text-xs hover:bg-muted/10 transition-colors">
                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <div className="font-bold text-sm text-foreground truncate">{e.title || "Untitled Expense"}</div>
                        <div className="text-muted-foreground truncate">{e.description}</div>
                        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                          <Calendar className="w-3 h-3" />
                          {new Date(e.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-foreground text-sm">₹{e.amount}</div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(e)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(e.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informational notice */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex gap-3 text-xs text-blue-800">
            <Info className="w-5 h-5 shrink-0 text-blue-600" />
            <div className="space-y-1">
              <div className="font-bold">Calculations Info</div>
              <p className="leading-relaxed">
                Expenses entered here are saved instantly to the database and are automatically subtracted from monthly revenue calculations on the Dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
