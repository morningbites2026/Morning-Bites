import { useState } from "react";
import { useStore } from "@/lib/store";
import { dbIns, dbUpd, dbDel } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Edit, Trash2, Tag, UtensilsCrossed, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Menu() {
  const { menuItems, refresh } = useStore();
  const { toast } = useToast();

  const [tab, setTab] = useState<'daily' | 'week_special'>('daily');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [options, setOptions] = useState<{ name: string; price: string }[]>([{ name: "Regular", price: "" }]);
  const [category, setCategory] = useState<'daily' | 'week_special'>('daily');
  const [weekDays, setWeekDays] = useState<number[]>([]);

  const dailyItems = menuItems.filter(m => (m.category || 'daily') === 'daily').sort((a, b) => a.sort_order - b.sort_order);
  const weekSpecialItems = menuItems.filter(m => (m.category || 'daily') === 'week_special').sort((a, b) => a.sort_order - b.sort_order);

  const handleOpenNew = () => {
    setEditingId(null);
    setName("");
    setSortOrder((menuItems.length * 10).toString());
    setOptions([{ name: "Regular", price: "" }]);
    setCategory(tab);
    setWeekDays([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setName(item.name);
    setSortOrder(item.sort_order.toString());
    setOptions(item.options.map((o: any) => ({ name: o.name, price: String(o.price) })));
    setCategory(item.category || 'daily');
    setWeekDays(item.week_days || []);
    setIsModalOpen(true);
  };

  const toggleWeekDay = (d: number) => {
    setWeekDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", description: "Name required" });
      return;
    }
    if (options.length === 0) {
      toast({ variant: "destructive", description: "Add at least one option" });
      return;
    }

    try {
      const data: any = {
        name,
        sort_order: Number(sortOrder),
        options: options.map(o => ({ name: o.name, price: Number(o.price) || 0 })),
        category,
        week_days: category === 'week_special' ? weekDays : []
      };
      if (!editingId) data.is_active = true;

      if (editingId) {
        await dbUpd('menu_items', editingId, data);
        toast({ title: "Menu item updated" });
      } else {
        await dbIns('menu_items', data);
        toast({ title: "Menu item added" });
      }
      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this menu item?")) {
      try {
        await dbDel('menu_items', id);
        toast({ title: "Deleted" });
        refresh();
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      }
    }
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try {
      await dbUpd('menu_items', id, { is_active: !current });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const renderItems = (items: typeof menuItems) => (
    <div className="space-y-3 pb-8">
      {items.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed">
          No items yet. Tap "Add Item" to add one.
        </div>
      ) : (
        items.map(item => (
          <Card key={item.id} className={cn("border-border shadow-sm transition-opacity", !item.is_active && 'opacity-50')}>
            <CardContent className="p-4 flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  {(item.category || 'daily') === 'week_special' && (item.week_days || []).length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold">
                      {(item.week_days || []).map(d => DAY_NAMES[d]).join(', ')}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {item.options.map((opt, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-muted/30 p-1.5 px-3 rounded-md">
                      <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> {opt.name}
                      </span>
                      <span className="font-bold">₹{opt.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <Switch
                  checked={item.is_active}
                  onCheckedChange={() => handleToggleActive(item.id, item.is_active)}
                  className="data-[state=checked]:bg-green-500"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenEdit(item)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-primary" /> Menu Management
        </h2>
        <Button onClick={handleOpenNew} className="rounded-full shadow-md">
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('daily')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2",
            tab === 'daily' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <UtensilsCrossed className="w-4 h-4" /> Daily Menu ({dailyItems.length})
        </button>
        <button
          onClick={() => setTab('week_special')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2",
            tab === 'week_special' ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className="w-4 h-4" /> Week Special ({weekSpecialItems.length})
        </button>
      </div>

      {tab === 'daily' ? renderItems(dailyItems) : renderItems(weekSpecialItems)}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input placeholder="e.g. Sprouts Salad" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <RadioGroup value={category} onValueChange={(v: any) => setCategory(v)} className="grid grid-cols-2 gap-2">
                <div>
                  <RadioGroupItem value="daily" id="cat-daily" className="peer sr-only" />
                  <Label htmlFor="cat-daily" className="flex items-center justify-center gap-2 rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all text-sm font-semibold">
                    <UtensilsCrossed className="w-4 h-4" /> Daily
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="week_special" id="cat-ws" className="peer sr-only" />
                  <Label htmlFor="cat-ws" className="flex items-center justify-center gap-2 rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 peer-data-[state=checked]:text-purple-700 cursor-pointer transition-all text-sm font-semibold">
                    <Star className="w-4 h-4" /> Week Special
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {category === 'week_special' && (
              <div className="space-y-2">
                <Label>Available on Days</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_NAMES.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekDay(i)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all",
                        weekDays.includes(i)
                          ? "bg-purple-600 border-purple-600 text-white"
                          : "border-border text-muted-foreground hover:border-purple-300"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Leave empty to show on all days</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label>Options (Size / Variant)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-full"
                  onClick={() => setOptions([...options, { name: "", price: "" }])}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center bg-muted/20 p-2 rounded-lg border border-border/50">
                    <div className="flex-1">
                      <Input
                        placeholder="Name (e.g. Regular)"
                        value={opt.name}
                        onChange={e => {
                          const n = [...options]; n[i].name = e.target.value; setOptions(n);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Price"
                        value={opt.price}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const n = [...options]; n[i] = { ...n[i], price: val }; setOptions(n);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    {options.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => { const n = [...options]; n.splice(i, 1); setOptions(n); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full h-12 text-lg rounded-xl shadow-lg">Save Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
