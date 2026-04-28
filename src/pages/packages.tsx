import { useState } from "react";
import { useStore } from "@/lib/store";
import { dbIns, dbUpd } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Package as PackageIcon, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Packages() {
  const { packages, refresh } = useStore();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mealsCount, setMealsCount] = useState("10");

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setMealsCount("10");
    setIsModalOpen(true);
  };

  const openEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setName(pkg.name);
    setDescription(pkg.description || "");
    setPrice(String(pkg.price));
    setMealsCount(String(pkg.meals_count ?? 10));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price) {
      toast({ variant: "destructive", description: "Name and price are required." });
      return;
    }

    try {
      const data = {
        name,
        description: description || null,
        price: Number(price),
        meals_count: Number(mealsCount) || 10,
      };

      if (editingId) {
        await dbUpd('packages', editingId, data);
        toast({ title: "Package updated" });
      } else {
        await dbIns('packages', { ...data, is_active: true });
        toast({ title: "Package added" });
      }
      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleDelete = async (pkg: any) => {
    if (!window.confirm(`Delete "${pkg.name}"? It will be hidden from all package lists.`)) return;
    try {
      await dbUpd('packages', pkg.id, { is_deleted: true });
      toast({ title: "Package deleted" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleToggleActive = async (pkg: any) => {
    const action = pkg.is_active ? "deactivate" : "activate";
    if (!pkg.is_active || window.confirm(`Deactivate "${pkg.name}"? Existing subscriptions using this package won't be affected.`)) {
      try {
        await dbUpd('packages', pkg.id, { is_active: !pkg.is_active });
        toast({ title: `Package ${action}d` });
        refresh();
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      }
    }
  };

  const sortedPackages = [...packages].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PackageIcon className="w-5 h-5 text-primary" /> Packages
        </h2>
        <Button onClick={openAdd} className="rounded-full shadow-md">
          <Plus className="w-4 h-4 mr-1" /> Add Package
        </Button>
      </div>

      <div className="space-y-4 pb-8">
        {sortedPackages.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">No packages yet.</div>
        ) : (
          sortedPackages.map(pkg => (
            <Card key={pkg.id} className={cn("border-border shadow-sm overflow-hidden transition-opacity", !pkg.is_active && 'opacity-50')}>
              <div className={cn("h-2 w-full bg-gradient-to-r", pkg.is_active ? "from-primary to-secondary" : "from-muted to-muted-foreground/30")} />
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <div className="px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-bold text-sm">
                        ₹{pkg.price}
                      </div>
                      <div className="px-3 py-1 bg-primary/10 text-primary rounded-full font-bold text-sm">
                        {pkg.meals_count ?? 10} meals
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{pkg.is_active ? 'Active' : 'Inactive'}</span>
                      <Switch
                        checked={pkg.is_active}
                        onCheckedChange={() => handleToggleActive(pkg)}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => openEdit(pkg)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                      onClick={() => handleDelete(pkg)}
                      title="Delete package"
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Package" : "Add New Package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input placeholder="e.g. Sprouts Salad Pack" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Number of Meals</Label>
                <Input type="number" placeholder="10" value={mealsCount} onChange={e => setMealsCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input type="number" placeholder="350" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Details about this package..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full h-12 text-lg rounded-xl shadow-lg">
              {editingId ? "Save Changes" : "Save Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
