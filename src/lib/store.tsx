import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { dbGet, Customer, Walkin, MenuItem, Bill, MealSkip, Package, Promotion, Preorder, CustomerPackage, Material, RecipeCost, RecipeIngredient, MaterialPurchase, dbIns, dbDel, dbUpd } from "./supabase";
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
  materials: Material[];
  recipeCosts: RecipeCost[];
  recipeIngredients: RecipeIngredient[];
  materialPurchases: MaterialPurchase[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  editingBill: Bill | null;
  setEditingBill: (b: Bill | null) => void;
  addMaterial: (name: string) => Promise<Material>;
  saveRecipe: (menuItemId: number, optionName: string, totalCost: number, ingredients: Omit<RecipeIngredient, 'id' | 'recipe_cost_id' | 'created_at'>[]) => Promise<void>;
  addPurchase: (materialName: string, price: number, qty: number, unit: string, date: string) => Promise<void>;
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
  const [materials, setMaterials] = useState<Material[]>([]);
  const [recipeCosts, setRecipeCosts] = useState<RecipeCost[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [materialPurchases, setMaterialPurchases] = useState<MaterialPurchase[]>([]);
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
      } catch (err: any) {
        console.error("Failed to load customer_packages:", err);
        setCustomerPackages([]);
      }

      try {
        const mats = await dbGet<Material>('materials');
        setMaterials(mats);
      } catch (err: any) {
        console.error("Failed to load materials:", err);
        setMaterials([]);
      }

      try {
        const rc = await dbGet<RecipeCost>('recipe_costs');
        setRecipeCosts(rc);
      } catch (err: any) {
        console.error("Failed to load recipe_costs:", err);
        setRecipeCosts([]);
      }

      try {
        const ri = await dbGet<RecipeIngredient>('recipe_ingredients');
        setRecipeIngredients(ri);
      } catch (err: any) {
        console.error("Failed to load recipe_ingredients:", err);
        setRecipeIngredients([]);
      }

      try {
        const mp = await dbGet<MaterialPurchase>('material_purchases');
        setMaterialPurchases(mp);
      } catch (err: any) {
        console.error("Failed to load material_purchases:", err);
        setMaterialPurchases([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err);
      toast({ variant: "destructive", title: "Error loading data", description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const addMaterial = useCallback(async (name: string) => {
    try {
      const existing = materials.find(m => m.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      const res = await dbIns<Material>('materials', { name });
      if (res && res.length > 0) {
        setMaterials(prev => [...prev, res[0]]);
        return res[0];
      }
      throw new Error("Failed to create material");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error adding material", description: err.message });
      throw err;
    }
  }, [materials, toast]);

  const saveRecipe = useCallback(async (
    menuItemId: number,
    optionName: string,
    totalCost: number,
    ingredients: Omit<RecipeIngredient, 'id' | 'recipe_cost_id' | 'created_at'>[]
  ) => {
    try {
      const existing = recipeCosts.find(rc => rc.menu_item_id === menuItemId && rc.option_name === optionName);
      let recipeCostId: number;

      if (existing) {
        await dbUpd('recipe_costs', existing.id, { total_cost: totalCost });
        recipeCostId = existing.id;

        const oldIngs = recipeIngredients.filter(ri => ri.recipe_cost_id === existing.id);
        await Promise.all(oldIngs.map(oi => dbDel('recipe_ingredients', oi.id)));
      } else {
        const res = await dbIns<RecipeCost>('recipe_costs', {
          menu_item_id: menuItemId,
          option_name: optionName,
          total_cost: totalCost
        });
        if (!res || res.length === 0) throw new Error("Failed to create recipe costing header");
        recipeCostId = res[0].id;
      }

      if (ingredients.length > 0) {
        await Promise.all(ingredients.map(ing => 
          dbIns<RecipeIngredient>('recipe_ingredients', {
            recipe_cost_id: recipeCostId,
            material_id: ing.material_id,
            material_name: ing.material_name,
            qty: ing.qty,
            unit: ing.unit,
            price: ing.price
          })
        ));
      }

      await loadData();
      toast({ title: "Success", description: "Recipe costing saved successfully" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error saving recipe", description: err.message });
      throw err;
    }
  }, [recipeCosts, recipeIngredients, loadData, toast]);

  const addPurchase = useCallback(async (
    materialName: string,
    price: number,
    qty: number,
    unit: string,
    date: string
  ) => {
    try {
      let matId: number | null = null;
      const existingMat = materials.find(m => m.name.toLowerCase() === materialName.toLowerCase());
      if (existingMat) {
        matId = existingMat.id;
      } else {
        const resMat = await dbIns<Material>('materials', { name: materialName });
        if (resMat && resMat.length > 0) {
          matId = resMat[0].id;
          setMaterials(prev => [...prev, resMat[0]]);
        }
      }

      await dbIns<MaterialPurchase>('material_purchases', {
        material_id: matId,
        material_name: materialName,
        price,
        qty,
        unit,
        purchase_date: date
      });

      await loadData();
      toast({ title: "Success", description: "Purchase logged successfully" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error adding purchase", description: err.message });
      throw err;
    }
  }, [materials, loadData, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <StoreContext.Provider value={{
      customers, walkins, menuItems, bills, preorders, mealSkips, packages, promotions, customerPackages,
      materials, recipeCosts, recipeIngredients, materialPurchases,
      isLoading, error, refresh: loadData,
      searchQuery, setSearchQuery,
      editingBill, setEditingBill,
      addMaterial, saveRecipe, addPurchase
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
