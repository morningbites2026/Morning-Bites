import { useState, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calculator, ShoppingBag, BarChart3, TrendingUp, TrendingDown, DollarSign, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface TempIngredient {
  id: string; // unique frontend temp id
  material_id: string; // material.id or "OTHER"
  custom_name?: string;
  qty: number;
  unit: string;
  price: number;
}

export default function RecipeCosting() {
  const {
    menuItems,
    materials,
    recipeCosts,
    recipeIngredients,
    expenses,
    packages,
    bills,
    customerPackages,
    addMaterial,
    saveRecipe,
    addExpense
  } = useStore();

  // --- TAB 1: Recipe Costing Builder State ---
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number | null>(null);
  const [selectedOptionName, setSelectedOptionName] = useState<string>("Default");
  const [tempIngredients, setTempIngredients] = useState<TempIngredient[]>([]);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  // Get active option names for selected menu item
  const selectedMenuItem = useMemo(() => {
    return menuItems.find(m => m.id === selectedMenuItemId);
  }, [menuItems, selectedMenuItemId]);

  const menuItemOptions = useMemo(() => {
    return selectedMenuItem?.options || [];
  }, [selectedMenuItem]);

  // Load existing recipe costing when item/option changes
  const loadExistingRecipe = (itemId: number, optName: string) => {
    const existingHeader = recipeCosts.find(rc => rc.menu_item_id === itemId && rc.option_name === optName);
    if (existingHeader) {
      const ings = recipeIngredients.filter(ri => ri.recipe_cost_id === existingHeader.id);
      setTempIngredients(ings.map(ing => ({
        id: ing.id.toString(),
        material_id: ing.material_id ? ing.material_id.toString() : "OTHER",
        custom_name: ing.material_id ? undefined : ing.material_name,
        qty: ing.qty,
        unit: ing.unit,
        price: ing.price
      })));
    } else {
      setTempIngredients([]);
    }
  };

  const handleMenuItemChange = (val: string) => {
    const id = Number(val);
    setSelectedMenuItemId(id);
    const item = menuItems.find(m => m.id === id);
    const defaultOpt = item?.options && item.options.length > 0 ? item.options[0].name : "Default";
    setSelectedOptionName(defaultOpt);
    loadExistingRecipe(id, defaultOpt);
  };

  const handleOptionChange = (val: string) => {
    setSelectedOptionName(val);
    if (selectedMenuItemId) {
      loadExistingRecipe(selectedMenuItemId, val);
    }
  };

  // Add new ingredient row
  const addIngredientRow = () => {
    setTempIngredients(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        material_id: "",
        qty: 0,
        unit: "gm",
        price: 0
      }
    ]);
  };

  // Remove ingredient row
  const removeIngredientRow = (id: string) => {
    setTempIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  // Update ingredient row field
  const updateIngredientRow = (id: string, updates: Partial<TempIngredient>) => {
    setTempIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, ...updates } : ing));
  };

  // Calculate total costing
  const totalCost = useMemo(() => {
    return tempIngredients.reduce((sum, ing) => sum + (Number(ing.price) || 0), 0);
  }, [tempIngredients]);

  // Selected Option Sale Price
  const selectedOptionPrice = useMemo(() => {
    if (!selectedMenuItem) return 0;
    if (selectedOptionName === "Default") return selectedMenuItem.options[0]?.price || 0;
    return selectedMenuItem.options.find(o => o.name === selectedOptionName)?.price || 0;
  }, [selectedMenuItem, selectedOptionName]);

  const grossMargin = selectedOptionPrice - totalCost;
  const grossMarginPercent = selectedOptionPrice > 0 ? (grossMargin / selectedOptionPrice) * 100 : 0;

  // Save the recipe
  const handleSaveRecipe = async () => {
    if (!selectedMenuItemId) return;
    setIsSavingRecipe(true);

    try {
      const processedIngredients = [];

      for (const ing of tempIngredients) {
        let matId: number | null = null;
        let matName = "";

        if (ing.material_id === "OTHER" && ing.custom_name?.trim()) {
          // Add custom material dynamically
          const newMat = await addMaterial(ing.custom_name.trim());
          matId = newMat.id;
          matName = newMat.name;
        } else {
          const mat = materials.find(m => m.id.toString() === ing.material_id);
          if (mat) {
            matId = mat.id;
            matName = mat.name;
          } else {
            matName = ing.custom_name || "Unknown";
          }
        }

        processedIngredients.push({
          material_id: matId,
          material_name: matName,
          qty: Number(ing.qty) || 0,
          unit: ing.unit,
          price: Number(ing.price) || 0
        });
      }

      await saveRecipe(selectedMenuItemId, selectedOptionName, totalCost, processedIngredients);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingRecipe(false);
    }
  };


  // --- TAB 2: Expense Logger State ---
  const [expenseDescription, setExpenseDescription] = useState<string>("");
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [isLoggingExpense, setIsLoggingExpense] = useState(false);

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDescription.trim() || !expenseAmount) return;

    setIsLoggingExpense(true);
    try {
      await addExpense(
        expenseDescription.trim(),
        Number(expenseAmount),
        expenseDate
      );
      setExpenseDescription("");
      setExpenseAmount("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingExpense(false);
    }
  };


  // --- TAB 3: Profitability Reports State ---
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  // Helper to map package cost
  const getRecipeCostForPackage = useCallback((pkgId: number) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return 0;
    // Match package name with menu item name
    const menuItem = menuItems.find(mi => pkg.name.toLowerCase().includes(mi.name.toLowerCase()));
    if (!menuItem) return 0;
    // Match option
    const option = menuItem.options.find(opt => pkg.name.toLowerCase().includes(opt.name.toLowerCase())) || menuItem.options[0];
    const rc = recipeCosts.find(r => r.menu_item_id === menuItem.id && r.option_name === (option?.name || "Default"));
    return rc ? rc.total_cost : 0;
  }, [packages, menuItems, recipeCosts]);

  // Generate Reports calculations
  const reportData = useMemo(() => {
    const today = new Date();
    let startDate = new Date();

    if (reportPeriod === "daily") {
      startDate.setHours(0, 0, 0, 0);
    } else if (reportPeriod === "weekly") {
      startDate.setDate(today.getDate() - 7);
    } else {
      startDate.setMonth(today.getMonth() - 1);
    }

    // Convert "D/M/YYYY" or "DD/MM/YYYY" to Date object
    const parseBillDate = (dateStr: string) => {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
      return new Date(dateStr);
    };

    // Filter Direct bills in period
    const filteredBills = bills.filter(b => {
      const bDate = b.bill_date ? parseBillDate(b.bill_date) : new Date(b.created_at);
      return bDate >= startDate && bDate <= today;
    });

    // Direct Bills Revenue
    const directBillsRevenue = filteredBills.reduce((sum, b) => sum + b.total_amount, 0);

    // Direct Bills COGS
    let directBillsCogs = 0;
    filteredBills.forEach(b => {
      b.items.forEach(item => {
        const menuItem = menuItems.find(mi => mi.name === item.name);
        if (menuItem) {
          const rc = recipeCosts.find(r => r.menu_item_id === menuItem.id && r.option_name === item.option);
          if (rc) {
            directBillsCogs += rc.total_cost * item.qty;
          }
        }
      });
    });

    // Subscriptions Revenue & COGS (Accrual cash basis)
    const filteredSubPacks = customerPackages.filter(cp => {
      const pDate = new Date(cp.pack_start_date + 'T00:00:00');
      return pDate >= startDate && pDate <= today && cp.status !== 'cancelled';
    });

    const subscriptionRevenue = filteredSubPacks.reduce((sum, cp) => {
      const pkg = packages.find(p => p.id === cp.package_id);
      return sum + (pkg?.price || 0);
    }, 0);

    const subscriptionCogs = filteredSubPacks.reduce((sum, cp) => {
      const mealCost = getRecipeCostForPackage(cp.package_id);
      return sum + (mealCost * cp.total);
    }, 0);

    // Expenses in period
    const filteredExpenses = expenses.filter(e => {
      const eDate = new Date(e.expense_date + 'T00:00:00');
      return eDate >= startDate && eDate <= today;
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculations
    const totalRevenue = directBillsRevenue + subscriptionRevenue;
    const totalCogs = directBillsCogs + subscriptionCogs;
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = totalRevenue - totalCogs - totalExpenses;

    return {
      revenue: totalRevenue,
      cogs: totalCogs,
      bulkPurchases: totalExpenses,
      grossProfit,
      netProfit,
      margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      billsCount: filteredBills.length,
      subsCount: filteredSubPacks.length,
      purchasesList: filteredExpenses
    };
  }, [bills, customerPackages, expenses, recipeCosts, packages, menuItems, reportPeriod, getRecipeCostForPackage]);


  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-8">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" /> Recipe & Purchase Flow
      </h2>

      <Tabs defaultValue="costing" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 grid grid-cols-3 rounded-xl">
          <TabsTrigger value="costing" className="rounded-lg text-xs flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> Recipe Costing
          </TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-lg text-xs flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" /> Purchase Logger
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg text-xs flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> Profit Reports
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: Recipe Costing Builder --- */}
        <TabsContent value="costing" className="mt-4 space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Recipe Costing Builder</CardTitle>
              <CardDescription className="text-xs">
                Select a menu item and options to define its recipe raw cost and profit margin.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Menu Item</Label>
                  <Select onValueChange={handleMenuItemChange} value={selectedMenuItemId?.toString() || ""}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.map(item => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {menuItemOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Option / Pack Size</Label>
                    <Select onValueChange={handleOptionChange} value={selectedOptionName}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItemOptions.map(opt => (
                          <SelectItem key={opt.name} value={opt.name}>
                            {opt.name} (₹{opt.price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {selectedMenuItemId && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold">Ingredients</Label>
                    <Button size="sm" onClick={addIngredientRow} variant="outline" className="rounded-full gap-1 h-8 text-xs border-primary/20 text-primary">
                      <Plus className="w-3.5 h-3.5" /> Add Ingredient
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {tempIngredients.length === 0 ? (
                      <div className="text-center p-6 text-muted-foreground bg-muted/10 rounded-xl border border-dashed text-xs">
                        No ingredients added yet. Click "+ Add Ingredient" to start.
                      </div>
                    ) : (
                      tempIngredients.map((ing, idx) => (
                        <div key={ing.id} className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                value={ing.material_id}
                                onValueChange={(val) => {
                                  updateIngredientRow(ing.id, {
                                    material_id: val,
                                    custom_name: val === "OTHER" ? "" : undefined
                                  });
                                }}
                              >
                                <SelectTrigger className="h-9 rounded-lg">
                                  <SelectValue placeholder="Select material" />
                                </SelectTrigger>
                                <SelectContent>
                                  {materials.map(m => (
                                    <SelectItem key={m.id} value={m.id.toString()}>
                                      {m.name}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="OTHER" className="font-bold text-primary">
                                    + Add Custom Material (Other)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => removeIngredientRow(ing.id)}
                              className="h-9 w-9 rounded-lg border-red-200 text-red-500 hover:bg-red-50 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {ing.material_id === "OTHER" && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Custom Material Name</Label>
                              <Input
                                placeholder="e.g. Avocado"
                                value={ing.custom_name || ""}
                                onChange={(e) => updateIngredientRow(ing.id, { custom_name: e.target.value })}
                                className="h-8 text-xs rounded-lg border-primary/20"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Qty</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={ing.qty || ""}
                                onChange={(e) => updateIngredientRow(ing.id, { qty: Number(e.target.value) })}
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Unit</Label>
                              <Select
                                value={ing.unit}
                                onValueChange={(val) => updateIngredientRow(ing.id, { unit: val })}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["gm", "kg", "ml", "liter", "piece", "packet"].map(u => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Price (₹)</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={ing.price || ""}
                                onChange={(e) => updateIngredientRow(ing.id, { price: Number(e.target.value) })}
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {tempIngredients.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {/* Calculations Summary Card */}
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="border-border bg-muted/10 shadow-none">
                          <CardContent className="p-3 text-center space-y-1">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Sale Price</div>
                            <div className="text-lg font-black text-foreground">₹{selectedOptionPrice}</div>
                          </CardContent>
                        </Card>
                        <Card className={cn("border-border shadow-none bg-muted/10")}>
                          <CardContent className="p-3 text-center space-y-1">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Cost</div>
                            <div className="text-lg font-black text-primary">₹{totalCost}</div>
                          </CardContent>
                        </Card>
                        <Card className={cn("border-border shadow-none col-span-2", grossMargin >= 0 ? "bg-green-50/55 border-green-200" : "bg-red-50/55 border-red-200")}>
                          <CardContent className="p-3 flex justify-between items-center">
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Net Profit margin</div>
                              <div className="text-xl font-black flex items-center gap-1">
                                {grossMargin >= 0 ? (
                                  <TrendingUp className="w-5 h-5 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-red-600" />
                                )}
                                <span className={grossMargin >= 0 ? "text-green-700" : "text-red-700"}>
                                  ₹{grossMargin.toFixed(2)} ({grossMarginPercent.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Button
                        className="w-full rounded-xl h-12 text-sm shadow-md"
                        onClick={handleSaveRecipe}
                        disabled={isSavingRecipe}
                      >
                        {isSavingRecipe ? "Saving Recipe..." : "Save Recipe Costing"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: Expense Logger --- */}
        <TabsContent value="purchases" className="mt-4 space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Log Expense</CardTitle>
              <CardDescription className="text-xs">
                Log daily store expenses.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <form onSubmit={handleLogExpense} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-semibold">Description</Label>
                    <Input
                      placeholder="e.g. Tomato, Salad Box, Milk"
                      value={expenseDescription}
                      onChange={e => setExpenseDescription(e.target.value)}
                      className="h-10 rounded-xl"
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
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl h-11 text-xs font-semibold shadow-md"
                  disabled={isLoggingExpense}
                >
                  {isLoggingExpense ? "Logging Expense..." : "Log Expense"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Expenses List */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {expenses.length === 0 ? (
                 <div className="text-center p-8 text-muted-foreground text-xs">
                   No expenses logged yet.
                 </div>
              ) : (
                <div className="divide-y divide-border border-t border-border max-h-64 overflow-y-auto">
                  {expenses.map(e => (
                    <div key={e.id} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-sm">{e.description}</div>
                        <div className="text-muted-foreground mt-0.5">{new Date(e.expense_date).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div className="font-bold text-foreground text-sm">₹{e.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 3: Profitability Reports & Charts --- */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="bg-muted p-1 rounded-xl flex shadow-inner border border-border">
            {(["daily", "weekly", "monthly"] as const).map(p => (
              <button
                key={p}
                onClick={() => setReportPeriod(p)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                  reportPeriod === p
                    ? "bg-white dark:bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border shadow-sm col-span-2 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 flex flex-col gap-1 items-center text-center">
                <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-primary" /> Net profit ({reportPeriod})
                </div>
                <div className={cn("text-3xl font-black mt-1", reportData.netProfit >= 0 ? "text-green-600" : "text-red-500")}>
                  ₹{reportData.netProfit.toFixed(0)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Margin: <span className="font-bold text-foreground">{reportData.margin.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex flex-col gap-1">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gross revenue</div>
                <div className="text-xl font-bold text-foreground">₹{reportData.revenue.toFixed(0)}</div>
                <div className="text-[9px] text-muted-foreground">
                  Bills: {reportData.billsCount} | Subs: {reportData.subsCount}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex flex-col gap-1">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Recipe COGS</div>
                <div className="text-xl font-bold text-primary">₹{reportData.cogs.toFixed(0)}</div>
                <div className="text-[9px] text-muted-foreground">Cost of Goods Sold</div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm col-span-2">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Store expenses</div>
                  <div className="text-lg font-bold text-amber-600">₹{reportData.bulkPurchases.toFixed(0)}</div>
                </div>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  {reportData.purchasesList.length} expenses
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Expenses Detail breakdown in report */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Expense Log in Period</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reportData.purchasesList.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-xs">
                  No expenses logged in this period.
                </div>
              ) : (
                <div className="divide-y divide-border border-t border-border max-h-60 overflow-y-auto">
                  {reportData.purchasesList.map(e => (
                    <div key={e.id} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold">{e.description}</div>
                        <div className="text-muted-foreground mt-0.5">{new Date(e.expense_date).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div className="font-bold text-foreground">₹{e.amount}</div>
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
                **Revenue** integrates direct Walk-in bills & Active Subscriptions. **Recipe COGS** is generated by applying your saved recipe cost price to item sales counts & active subscriptions. **Store expenses** represent expenses entered in Tab 2.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
