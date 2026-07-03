import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { getActivityLogs, formatIST, formatISTDate, CustomerPackage, ActivityLog } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Package as PackageIcon, 
  CreditCard, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  FileText,
  Undo2,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SubscriberDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { customers, customerPackages, packages } = useStore();
  const { toast } = useToast();

  const customerId = Number(id);
  const customer = customers.find(c => c.id === customerId);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedPkgIds, setExpandedPkgIds] = useState<Record<number, boolean>>({});
  const [expandedCycleIds, setExpandedCycleIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!customerId) return;

    setLoadingLogs(true);
    getActivityLogs(customerId)
      .then(l => {
        // Sort logs chronologically descending
        setLogs(l.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      })
      .catch(err => {
        toast({ variant: "destructive", description: "Failed to fetch activity logs" });
      })
      .finally(() => {
        setLoadingLogs(false);
      });
  }, [customerId, toast]);

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h3 className="text-xl font-bold">Subscriber Not Found</h3>
        <p className="text-muted-foreground text-sm">The subscriber details could not be loaded.</p>
        <Button onClick={() => setLocation("/subscribed")} className="rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Subscribed
        </Button>
      </div>
    );
  }

  // Get packages for this customer (not cancelled in getCustPacks, but here we want to show all including cancelled/done)
  let custCps = [...customerPackages.filter(cp => Number(cp.customer_id) === customerId)];

  // Fallback: If no customer packages are in the db, reconstruct them using logs and customer properties
  if (custCps.length === 0) {
    const subscriptionLogs = logs.filter(l => l.action === 'subscribed' || l.action === 'renewed')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // oldest first

    if (subscriptionLogs.length > 0) {
      subscriptionLogs.forEach((log, index) => {
        const desc = log.description || '';
        const matchedPkg = packages.find(p => desc.toLowerCase().includes(p.name.toLowerCase()));
        const pkgId = matchedPkg?.id || customer.package_id || 1;
        const total = matchedPkg?.meals_count || 10;
        
        let payMode: 'cash' | 'upi' | 'scanpay' = 'cash';
        if (desc.toLowerCase().includes('payment: upi')) payMode = 'upi';
        else if (desc.toLowerCase().includes('payment: scanpay') || desc.toLowerCase().includes('payment: scan')) payMode = 'scanpay';

        const isLatest = index === subscriptionLogs.length - 1;
        const status = isLatest ? (customer.used >= customer.total ? 'done' : 'active') : 'done';
        const used = isLatest ? customer.used : total;

        custCps.push({
          id: -1 - index,
          customer_id: customerId,
          package_id: pkgId,
          used: used,
          total: total,
          pack_start_date: log.created_at.split('T')[0],
          payment_mode: payMode,
          status: status,
          renew_count: index,
          last_renewed: log.created_at.split('T')[0],
          preferred_days: isLatest ? (customer.preferred_days || []) : [],
          instruction: '',
          created_at: log.created_at
        });
      });
    }
  }

  // Always ensure the active package from the customers table is included if not already represented in custCps
  if (customer.package_id && !custCps.some(cp => cp.package_id === customer.package_id && cp.status === 'active')) {
    custCps.push({
      id: -999, // special ID for primary active package fallback
      customer_id: customerId,
      package_id: customer.package_id,
      used: customer.used,
      total: customer.total,
      pack_start_date: customer.pack_start_date || customer.join_date,
      payment_mode: customer.payment_mode || 'cash',
      status: customer.used >= customer.total ? 'done' : 'active',
      renew_count: customer.renew_count || 0,
      last_renewed: customer.last_renewed,
      preferred_days: customer.preferred_days || [],
      instruction: '',
      created_at: (customer.pack_start_date || customer.join_date) + 'T00:00:00Z'
    });
  }

  // Sort by date descending
  custCps.sort((a, b) => new Date(b.created_at || b.pack_start_date).getTime() - new Date(a.created_at || a.pack_start_date).getTime());

  // Group customer packages by package_id
  const packageGroups: Record<number, CustomerPackage[]> = {};
  custCps.forEach(cp => {
    if (!packageGroups[cp.package_id]) {
      packageGroups[cp.package_id] = [];
    }
    packageGroups[cp.package_id].push(cp);
  });

  const togglePackage = (pkgId: number) => {
    setExpandedPkgIds(prev => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  const toggleCycle = (cpId: number) => {
    setExpandedCycleIds(prev => ({ ...prev, [cpId]: !prev[cpId] }));
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full h-10 w-10 border-border bg-card shadow-sm hover:bg-muted"
          onClick={() => setLocation("/subscribed")}
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold font-serif">Subscriber Profile</h2>
          <p className="text-xs text-muted-foreground font-medium">Detailed history & subscriptions</p>
        </div>
      </div>

      {/* Subscriber Profile Card */}
      <Card className="border border-border shadow-sm overflow-hidden bg-gradient-to-br from-card to-muted/20">
        <div className={cn(
          "h-2 w-full",
          customer.status === 'cancelled' ? 'bg-orange-400' : 'bg-primary'
        )} />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold font-serif text-2xl leading-tight text-foreground">{customer.name}</h3>
                <div className="text-sm font-semibold text-muted-foreground mt-1 flex items-center gap-1">
                  <span>{customer.phone}</span>
                  <span>•</span>
                  <a 
                    href={`https://wa.me/91${customer.phone}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-primary hover:underline"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex flex-col items-start md:items-end">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Joining Date</div>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {formatISTDate(customer.join_date)}
                </div>
              </div>

              <div className="h-8 w-px bg-border hidden md:block" />

              <div className="flex flex-col items-start md:items-end">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</div>
                <div className="mt-1">
                  {customer.status === 'cancelled' ? (
                    <Badge variant="destructive" className="font-bold">Cancelled</Badge>
                  ) : (
                    <Badge className="bg-green-500 hover:bg-green-600 text-white font-bold">Active</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold font-serif flex items-center gap-2 text-foreground">
          <PackageIcon className="w-5 h-5 text-primary" /> Packages & Renewal Cycles
        </h3>

        {Object.keys(packageGroups).length === 0 ? (
          <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-3xl border border-dashed border-border font-medium">
            No subscription records found for this user.
          </div>
        ) : (
          Object.entries(packageGroups).map(([pkgIdStr, pkgCps]) => {
            const pkgId = Number(pkgIdStr);
            const pkg = packages.find(p => p.id === pkgId);
            const isExpanded = expandedPkgIds[pkgId] !== false; // default expanded

            // Sort chronologically ascending to calculate cycle indices
            const chronologicalCps = [...pkgCps].reverse();

            return (
              <Card key={pkgId} className="border border-border shadow-sm overflow-hidden">
                {/* Package Group Header */}
                <div 
                  onClick={() => togglePackage(pkgId)}
                  className="p-5 flex justify-between items-center cursor-pointer bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10">
                      <PackageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg leading-tight text-foreground">{pkg?.name || 'Custom Package'}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pkgCps.length} cycle{pkgCps.length > 1 ? 's' : ''} total
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Package Group Body (Cycles List) */}
                {isExpanded && (
                  <div className="p-5 space-y-5 bg-card/50">
                    {pkgCps.map((cp, idx) => {
                      const cycleIndex = chronologicalCps.findIndex(x => x.id === cp.id) + 1;
                      const isCycleExpanded = expandedCycleIds[cp.id] !== undefined ? expandedCycleIds[cp.id] : (cp.status === 'active');
                      const progressPercent = cp.total > 0 ? (cp.used / cp.total) * 100 : 0;

                      // Filter activity logs for this cycle
                      const cycleStart = new Date(cp.created_at || cp.pack_start_date).getTime();
                      // Find the next cycle chronologically of the same package to set cut-off
                      const currentChronIndex = chronologicalCps.findIndex(x => x.id === cp.id);
                      const nextCp = chronologicalCps[currentChronIndex + 1];
                      const cycleEnd = nextCp ? new Date(nextCp.created_at || nextCp.pack_start_date).getTime() : Infinity;

                      const cycleLogs = logs.filter(log => {
                        const logTime = new Date(log.created_at).getTime();
                        return logTime >= cycleStart && logTime < cycleEnd;
                      });

                      return (
                        <div key={cp.id} className="border border-border/80 rounded-2xl overflow-hidden shadow-sm bg-card transition-all hover:border-border">
                          {/* Cycle Header */}
                          <div 
                            onClick={() => toggleCycle(cp.id)}
                            className="p-4 flex flex-wrap justify-between items-center cursor-pointer bg-muted/20 hover:bg-muted/30 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black px-2.5 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                                {cp.renew_count === 0 ? 'Initial Pack' : `Cycle #${cycleIndex}`}
                              </span>
                              <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatISTDate(cp.pack_start_date)}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 ml-auto">
                              {cp.status === 'active' && cp.used >= cp.total ? (
                                <Badge className="bg-gray-200 text-gray-700 font-bold hover:bg-gray-200">Pack Done</Badge>
                              ) : cp.status === 'active' && (cp.total - cp.used) <= 2 ? (
                                <Badge className="bg-secondary text-secondary-foreground font-bold hover:bg-secondary">Low: {cp.total - cp.used} left</Badge>
                              ) : cp.status === 'active' ? (
                                <Badge className="bg-primary/10 text-primary border-primary/20 font-bold hover:bg-primary/10">{cp.total - cp.used} left</Badge>
                              ) : cp.status === 'cancelled' ? (
                                <Badge variant="destructive" className="font-bold">Cancelled</Badge>
                              ) : (
                                <Badge className="bg-gray-200 text-gray-700 font-bold hover:bg-gray-200 uppercase">{cp.status}</Badge>
                              )}

                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                                {isCycleExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </div>

                          {/* Cycle Details */}
                          {isCycleExpanded && (
                            <div className="p-4 border-t border-border/60 space-y-4 bg-card/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left stats */}
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                      <span>Meals Consumed</span>
                                      <span className="text-foreground">{cp.used} / {cp.total}</span>
                                    </div>
                                    <Progress 
                                      value={progressPercent} 
                                      className={cn(
                                        "h-2.5 bg-muted",
                                        cp.used >= cp.total ? '[&>div]:bg-gray-400' : (cp.total - cp.used) <= 2 ? '[&>div]:bg-secondary' : '[&>div]:bg-primary'
                                      )} 
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 bg-muted/30 rounded-xl border border-border/50">
                                      <div className="text-muted-foreground font-semibold">Payment Mode</div>
                                      <div className="font-bold text-foreground mt-0.5 uppercase flex items-center gap-1.5">
                                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                                        {cp.payment_mode}
                                      </div>
                                    </div>
                                    <div className="p-2.5 bg-muted/30 rounded-xl border border-border/50">
                                      <div className="text-muted-foreground font-semibold">Total Price</div>
                                      <div className="font-bold text-foreground mt-0.5 text-sm">
                                        ₹{pkg?.price || 0}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Right config (delivery preferences & instructions) */}
                                <div className="space-y-3 text-xs">
                                  <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-2">
                                    <div className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">Delivery Days</div>
                                    <div className="flex gap-1">
                                      {DAYS.map((day, dIdx) => {
                                        const cpPrefDays = cp.preferred_days;
                                        const isActive = !cpPrefDays || cpPrefDays.length === 0 || cpPrefDays.includes(dIdx);
                                        return (
                                          <div 
                                            key={dIdx}
                                            className={cn(
                                              "flex-1 py-1 text-center rounded-md font-bold border text-[10px]",
                                              isActive 
                                                ? "bg-primary/10 border-primary/20 text-primary" 
                                                : "bg-transparent border-transparent text-muted-foreground/50"
                                            )}
                                          >
                                            {day[0]}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {cp.instruction ? (
                                    <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl space-y-1">
                                      <div className="text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Special Instruction
                                      </div>
                                      <div className="text-amber-900 dark:text-amber-300 font-medium text-xs">
                                        {cp.instruction}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-muted/10 border border-dashed rounded-xl text-center text-muted-foreground/60 italic text-xs">
                                      No special instructions
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Cycle Logs Timeline */}
                              <div className="pt-2 border-t border-border/40 space-y-2.5">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" /> Cycle Log & Usage History
                                </div>

                                {loadingLogs ? (
                                  <div className="text-center p-4 bg-muted/10 rounded-xl text-muted-foreground/60 italic text-xs">
                                    Loading activity logs...
                                  </div>
                                ) : cycleLogs.length === 0 ? (
                                  <div className="text-center p-4 bg-muted/10 rounded-xl text-muted-foreground/60 italic text-xs">
                                    No activity logs in this cycle.
                                  </div>
                                ) : (
                                  <div className="relative pl-3 border-l-2 border-primary/20 ml-1.5 space-y-3.5 py-1">
                                    {cycleLogs.map(log => {
                                      let actionIcon = <HelpCircle className="w-3 h-3 text-muted-foreground" />;
                                      if (log.action === 'meal_used') actionIcon = <CheckCircle2 className="w-3 h-3 text-green-500" />;
                                      if (log.action === 'meal_undo') actionIcon = <Undo2 className="w-3 h-3 text-amber-500" />;
                                      if (log.action === 'renewed') actionIcon = <RefreshCw className="w-3 h-3 text-blue-500" />;
                                      if (log.action === 'subscribed') actionIcon = <PackageIcon className="w-3 h-3 text-purple-500" />;
                                      if (log.action === 'edit') actionIcon = <FileText className="w-3 h-3 text-gray-500" />;

                                      return (
                                        <div key={log.id} className="relative flex flex-col gap-0.5">
                                          {/* Bullet icon */}
                                          <div className="absolute -left-[19px] top-1.5 bg-background p-0.5 rounded-full border border-border">
                                            {actionIcon}
                                          </div>
                                          
                                          <div className="text-xs font-medium text-foreground leading-snug">
                                            {log.description}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground font-semibold">
                                            {formatIST(log.created_at)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
