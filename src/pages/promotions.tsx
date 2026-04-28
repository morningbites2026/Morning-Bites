import { useState } from "react";
import { useStore } from "@/lib/store";
import { dbIns, dbUpd, formatIST, getPromotionHistory, ActivityLog } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone, CalendarDays, Trash2, History, User } from "lucide-react";

export default function Promotions() {
  const { promotions, refresh } = useStore();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [historyModal, setHistoryModal] = useState<{ open: boolean; promo: any }>({ open: false, promo: null });
  const [historyLogs, setHistoryLogs] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ variant: "destructive", description: "Title and description are required." });
      return;
    }
    setIsSaving(true);
    try {
      await dbIns('promotions', { title, description, is_active: true, is_deleted: false });
      toast({ title: "Promotion created!" });
      setIsModalOpen(false);
      setTitle("");
      setDescription("");
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await dbUpd('promotions', id, { is_active: !current });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleDelete = async (promo: any) => {
    if (!window.confirm(`Delete "${promo.title}"? This cannot be undone.`)) return;
    try {
      await dbUpd('promotions', promo.id, { is_deleted: true });
      toast({ title: "Promotion deleted" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleHistory = async (promo: any) => {
    setHistoryModal({ open: true, promo });
    setHistoryLoading(true);
    const all = await getPromotionHistory();
    const filtered = all.filter(log =>
      log.meta?.promotion_id === promo.id ||
      log.description?.includes(promo.title)
    );
    setHistoryLogs(filtered);
    setHistoryLoading(false);
  };

  const getRecipient = (log: ActivityLog) => {
    if (log.meta?.walkin_name) return `${log.meta.walkin_name}${log.meta.walkin_phone ? ` · ${log.meta.walkin_phone}` : ''}`;
    const match = log.description?.match(/Sent to (.+?) \((.+?)\)/);
    if (match) return `${match[1]} · ${match[2]}`;
    return null;
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" /> Promotions
        </h2>
        <Button onClick={() => setIsModalOpen(true)} className="rounded-full shadow-md">
          <Plus className="w-4 h-4 mr-1" /> Create
        </Button>
      </div>

      <div className="space-y-3 pb-8">
        {promotions.length === 0 ? (
          <div className="text-center p-12 bg-muted/30 rounded-3xl border border-dashed flex flex-col items-center">
            <Megaphone className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
            <h3 className="font-bold text-lg mb-1">No promotions yet</h3>
            <p className="text-muted-foreground text-sm">Create a promotion to send to walk-in customers.</p>
          </div>
        ) : (
          promotions.map(promo => (
            <Card key={promo.id} className="border-border shadow-sm overflow-hidden">
              <div className={`h-1.5 w-full ${promo.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}></div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base truncate">{promo.title}</h3>
                      <Badge className={promo.is_active ? "bg-green-100 text-green-800 text-[10px] font-bold shrink-0" : "bg-muted text-muted-foreground text-[10px] shrink-0"}>
                        {promo.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{promo.description}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/70">
                      <CalendarDays className="w-3 h-3" />
                      {formatIST(promo.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={() => handleToggle(promo.id, promo.is_active)}
                      className="data-[state=checked]:bg-green-500"
                    />
                    <span className="text-[10px] text-muted-foreground">{promo.is_active ? 'On' : 'Off'}</span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => handleHistory(promo)}
                        title="Send history"
                      >
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                        onClick={() => handleDelete(promo)}
                        title="Delete promotion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> New Promotion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Promotion Title</Label>
              <Input
                placeholder="e.g. Weekend Special Offer"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message / Description</Label>
              <Textarea
                placeholder="Write the promotion message that will be sent to customers on WhatsApp..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="resize-none min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">This message will be sent as: "Hello [Name]! {title}\n\n{description}\n\nMorning Bites"</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 text-lg rounded-xl shadow-lg font-bold">
              Save Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModal.open} onOpenChange={o => !o && setHistoryModal({ open: false, promo: null })}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" /> {historyModal.promo?.title} — History
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {historyLoading ? (
              <div className="text-sm text-muted-foreground text-center py-6">Loading...</div>
            ) : historyLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                This promotion hasn't been sent yet.
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-3">
                  Sent {historyLogs.length} time{historyLogs.length !== 1 ? 's' : ''}
                </div>
                {historyLogs.map(log => {
                  const recipient = getRecipient(log);
                  return (
                    <div key={log.id} className="p-3 bg-muted/30 rounded-xl border border-border flex justify-between items-start gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          {recipient ? (
                            <div className="text-sm font-medium truncate">{recipient}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground truncate">{log.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right shrink-0 whitespace-nowrap">
                        {formatIST(log.created_at)}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
