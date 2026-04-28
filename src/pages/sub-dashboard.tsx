import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { CalendarDays, AlertCircle, Sun, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";
import { getISTISODate } from "@/lib/supabase";

export default function SubDashboard() {
  const { customers, mealSkips } = useStore();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [listTab, setListTab] = useState<'today' | 'tomorrow'>('today');

  const today = new Date();
  const todayIso = getISTISODate();
  const dayIndex = (today.getDay() + 6) % 7;
  const todayStr = today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIndex = (tomorrow.getDay() + 6) % 7;
  const tomorrowIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(tomorrow);

  const activeSubs = customers.filter(c => c.status === 'active');

  const isScheduled = (c: any, dIndex: number) =>
    c.preferred_days.length === 0 || c.preferred_days.includes(dIndex);

  const todaySkips = mealSkips.filter(s => s.skip_date === todayIso && !s.unskipped);
  const tomorrowSkips = mealSkips.filter(s => s.skip_date === tomorrowIso && !s.unskipped);
  const skipCustomerIds = new Set(todaySkips.map(s => s.customer_id));
  const tomorrowSkipIds = new Set(tomorrowSkips.map(s => s.customer_id));

  const todayPacks = activeSubs.filter(c => isScheduled(c, dayIndex) && !skipCustomerIds.has(c.id));
  const tomorrowPacks = activeSubs.filter(c => isScheduled(c, tomorrowIndex) && !tomorrowSkipIds.has(c.id));

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDateForDayIndex = (dayIdx: number) => {
    const d = new Date(today);
    const diff = dayIdx - dayIndex;
    d.setDate(d.getDate() + diff);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getISOForDayIndex = (dayIdx: number) => {
    const d = new Date(today);
    const diff = dayIdx - dayIndex;
    d.setDate(d.getDate() + diff);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  };

  const weekGrid = days.map((d, i) => {
    const dayIso = getISOForDayIndex(i);
    const daySkipIds = new Set(
      mealSkips.filter(s => s.skip_date === dayIso && !s.unskipped).map(s => s.customer_id)
    );
    return {
      day: d,
      index: i,
      count: activeSubs.filter(c => isScheduled(c, i) && !daySkipIds.has(c.id)).length,
      dateStr: getDateForDayIndex(i),
      dayIso,
      skipIds: daySkipIds
    };
  });

  const selectedDayIso = selectedDay !== null ? getISOForDayIndex(selectedDay) : '';
  const selectedDaySkipIds = new Set(
    mealSkips.filter(s => s.skip_date === selectedDayIso && !s.unskipped).map(s => s.customer_id)
  );
  const selectedDayCustomers = selectedDay !== null
    ? activeSubs.filter(c => isScheduled(c, selectedDay) && !selectedDaySkipIds.has(c.id))
    : [];

  const currentList = listTab === 'today' ? todayPacks : tomorrowPacks;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Schedule Dashboard</h2>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> {todayStr}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border bg-primary text-primary-foreground shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Today's Packs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black">{todayPacks.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tomorrow's Prep</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold">{tomorrowPacks.length}</div>
          </CardContent>
        </Card>
      </div>

      {todaySkips.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm text-orange-800 dark:text-orange-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Skipped Today ({todaySkips.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-xs text-orange-700 dark:text-orange-500 space-y-1">
              {todaySkips.map(skip => {
                const c = customers.find(c => c.id === skip.customer_id);
                return <div key={skip.id}>• {c?.name || 'Unknown'}</div>;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm">
        <CardHeader className="p-4 bg-muted/30">
          <CardTitle className="text-sm">Weekly Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {weekGrid.map(d => (
              <div
                key={d.day}
                onClick={() => setSelectedDay(d.index)}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all",
                  d.index === dayIndex
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted/50'
                )}
              >
                <div className="text-xs text-muted-foreground font-medium">{d.day}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{d.dateStr}</div>
                <div className={cn("text-xl font-bold mt-1", d.index === dayIndex ? 'text-primary' : '')}>
                  {d.count}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <div className="flex border-b border-border">
          <button
            onClick={() => setListTab('today')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2",
              listTab === 'today'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="w-4 h-4" /> Today ({todayPacks.length})
          </button>
          <button
            onClick={() => setListTab('tomorrow')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2",
              listTab === 'tomorrow'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sunrise className="w-4 h-4" /> Tomorrow ({tomorrowPacks.length})
          </button>
        </div>
        <CardContent className="p-0 divide-y divide-border">
          {currentList.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No packs scheduled for {listTab === 'today' ? 'today' : 'tomorrow'}.
            </div>
          ) : (
            currentList.map(c => (
              <div key={c.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </div>
                <div className="text-xs text-muted-foreground">{c.used} / {c.total} used</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedDay !== null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDay !== null ? days[selectedDay] : ''} — {selectedDay !== null ? getDateForDayIndex(selectedDay) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="font-medium text-sm mb-2 text-muted-foreground">
              {selectedDayCustomers.length} customer{selectedDayCustomers.length !== 1 ? 's' : ''} scheduled
            </div>
            <div className="divide-y divide-border border rounded-lg">
              {selectedDayCustomers.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No customers scheduled.</div>
              ) : (
                selectedDayCustomers.map(c => (
                  <div key={c.id} className="p-3 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.total - c.used} left</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
