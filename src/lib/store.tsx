import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { dbGet, Customer, Walkin, MenuItem, Bill, MealSkip, Package, Promotion, Preorder, CustomerPackage } from "./supabase";
import { useToast } from "@/hooks/use-toast";

type StoreState = {
  customers: Customer[];
  walkins: Walkin[];
  menuItems: MenuItem[];
  bills: Bill[];
  preorders: Preorder[];
  mealSkips: MealSkip[];
  packages: Package[];
  promotions: Promotion[];
  customerPackages: CustomerPackage[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  editingBill: Bill | null;
  setEditingBill: (b: Bill | null) => void;
};

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [mealSkips, setMealSkips] = useState<MealSkip[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [c, w, m, b, po, s] = await Promise.all([
        dbGet<Customer>('customers', 'select=*&is_deleted=eq.false'),
        dbGet<Walkin>('walkins', 'select=*&is_deleted=eq.false'),
        dbGet<MenuItem>('menu_items'),
        dbGet<Bill>('bills'),
        (async () => {
          try { return await dbGet<Preorder>('preorders'); } catch { return [] as Preorder[]; }
        })(),
        dbGet<MealSkip>('meal_skips'),
      ]);
      setCustomers(c);
      setWalkins(w);
      setMenuItems(m);
      setBills(b);
      setPreorders(po);
      setMealSkips(s);

      // packages: filter by is_deleted when column exists, fall back to unfiltered
      try {
        const p = await dbGet<Package>('packages', 'select=*&is_deleted=eq.false');
        setPackages(p);
      } catch {
        try { setPackages(await dbGet<Package>('packages')); } catch { setPackages([]); }
      }

      // promotions: filter by is_deleted when column exists, fall back to unfiltered
      try {
        const promo = await dbGet<Promotion>('promotions', 'select=*&is_deleted=eq.false');
        setPromotions(promo);
      } catch {
        try { setPromotions(await dbGet<Promotion>('promotions')); } catch { setPromotions([]); }
      }

      try {
        const cp = await dbGet<CustomerPackage>('customer_packages');
        setCustomerPackages(cp);
      } catch {
        setCustomerPackages([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err);
      toast({ variant: "destructive", title: "Error loading data", description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <StoreContext.Provider value={{
      customers, walkins, menuItems, bills, preorders, mealSkips, packages, promotions, customerPackages,
      isLoading, error, refresh: loadData,
      searchQuery, setSearchQuery,
      editingBill, setEditingBill
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
