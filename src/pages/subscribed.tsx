import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { dbUpd, dbIns, dbUpdWhere, logActivity, getActivityLogs, formatIST, formatISTDate, getISTISODate, ActivityLog, UPI_ID, CustomerPackage, Package, getScheduleMode, getStartingSaladKey } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Undo2, SkipForward, RefreshCw, Trash2, Edit, MessageCircle, ChevronLeft, ChevronRight, History, Plus, Banknote, CreditCard, QrCode, Ban, AlertCircle, Pause, Play, CalendarCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PaymentModeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-3 gap-2">
      {[
        { value: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
        { value: 'upi', label: 'UPI', icon: <CreditCard className="w-4 h-4" /> },
        { value: 'scanpay', label: 'Scan', icon: <QrCode className="w-4 h-4" /> },
      ].map(m => (
        <div key={m.value}>
          <RadioGroupItem value={m.value} id={`pm-sub-${m.value}`} className="peer sr-only" />
          <Label htmlFor={`pm-sub-${m.value}`} className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all text-xs font-semibold">
            {m.icon}{m.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

const cleanMsgPkgName = (name?: string) => {
  if (!name) return "";
  if (name.toLowerCase().startsWith("custom:")) {
    return "Your customized salad package";
  }
  return name;
};

const buildMealUpdateMsg = (name: string, used: number, remaining: number, total: number, pkgName?: string, todayUsed?: number) => {
  const cleanName = cleanMsgPkgName(pkgName);
  return `Hello ${name},\n\nHere is your meal update${cleanName ? ` for *${cleanName}*` : ''}:\n✅ Meals used so far: ${used}\n🥗 Meals remaining: ${remaining}\n📦 Total meals in pack: ${total}\n\nEnjoy your fresh meals every morning and stay healthy!\n\nTiming: 6:30 AM to 9:00 AM\nCall us: 9099172237 / 9429929822\n\nThank you!`;
};

const buildRenewPackMsg = (name: string, remaining: number, total: number, price: number, pkgName?: string) => {
  const cleanName = cleanMsgPkgName(pkgName);
  return `Hello ${name},\n\nYou currently have ${remaining} meal(s) remaining${cleanName ? ` in your *${cleanName}*` : ''}.\n\nRenew your pack today!\n🎉 ${total} fresh meals for just ₹${price}!\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nThank you!`;
};

const buildPackDoneMsg = (name: string, total: number, price: number, pkgName?: string) => {
  const cleanName = cleanMsgPkgName(pkgName);
  return `Hello ${name},\n\nAll ${total} meals${cleanName ? ` in your *${cleanName}*` : ''} have been used.\n\nRenew today!\n🎉 ${total} fresh meals for just ₹${price}!\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nThank you!`;
};

const buildActiveSubMsg = (name: string, pkgName: string, total: number, price: number, startDate: string) => {
  const cleanName = cleanMsgPkgName(pkgName);
  return `Hello ${name},\n\nYour ${cleanName} subscription is now active!\n\n📦 Pack: ${total} meals\n💰 Amount: ₹${price}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;
};

const buildActiveSubMsgMulti = (name: string, pkgs: Package[], startDate: string) => {
  const pkgsList = pkgs.map((p, i) => {
    const cleanName = cleanMsgPkgName(p.name);
    return `${i + 1}. ${cleanName} — ${p.meals_count ?? 10} meals — ₹${p.price}`;
  }).join('\n');
  const totalPrice = pkgs.reduce((s, p) => s + p.price, 0);
  const totalMeals = pkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0);
  return `Hello ${name},\n\nYour subscriptions are now active!\n\n📦 Packages:\n${pkgsList}\n\n🍽️ Total meals: ${totalMeals}\n💰 Total amount: ₹${totalPrice}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;
};

const buildRenewalMsg = (name: string, pkgName: string, total: number, price: number, startDate: string) => {
  const cleanName = cleanMsgPkgName(pkgName);
  return `Hello ${name},\n\nYour subscription has been renewed!\n\n🔄 Renewal\n📦 Package: ${cleanName}\n🍽️ Meals: ${total}\n💰 Amount: ₹${price}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;
};

const buildRenewalMsgMulti = (name: string, pkgs: Package[], startDate: string) => {
  const pkgsList = pkgs.map((p, i) => {
    const cleanName = cleanMsgPkgName(p.name);
    return `${i + 1}. ${cleanName} — ${p.meals_count ?? 10} meals — ₹${p.price}`;
  }).join('\n');
  const totalPrice = pkgs.reduce((s, p) => s + p.price, 0);
  const totalMeals = pkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0);
  return `Hello ${name},\n\nYour subscriptions have been renewed!\n\n🔄 Renewal\n📦 Packages:\n${pkgsList}\n\n🍽️ Total meals: ${totalMeals}\n💰 Total amount: ₹${totalPrice}\n📅 Start date: ${startDate}\n\nEnjoy fresh food daily!\n✅ Healthy • Hygienic • Tasty\n\n⏰ 6:30 AM to 9:00 AM\n📞 9099172237 / 9429929822\n\nSee you tomorrow morning!`;
};
const getUnionOfSchedules = (saladScheds: Record<string, any>, saladKeys: string[]) => {
  if (!saladKeys || saladKeys.length === 0) return [];
  let hasAllDays = false;
  const unionSet = new Set<number>();
  for (const key of saladKeys) {
    const sched = (Array.isArray(saladScheds[key]) ? saladScheds[key] : []) as number[];
    if (sched.length === 0) {
      hasAllDays = true;
      break;
    }
    sched.forEach(d => unionSet.add(d));
  }
  if (hasAllDays || unionSet.size === 6) return [];
  return Array.from(unionSet).sort();
};

const getPackageSaladOptions = (pkg?: Package | null) => {
  if (!pkg) return [];
  if (pkg.salad_options && pkg.salad_options.length > 0) {
    return pkg.salad_options;
  }
  if (pkg.salad_ids && pkg.salad_ids.length > 0) {
    return pkg.salad_ids.map(id => ({ id, option: "Regular" }));
  }
  return [];
};

function getISTTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

export default function Subscribed() {
  const { customers, packages, walkins, mealSkips, customerPackages, menuItems, preorders, refresh, searchQuery } = useStore();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const tomorrowCount = useMemo(() => {
    const targetDate = getISTTomorrowISO();
    const tomorrowISO = targetDate;
    const d = new Date(targetDate + 'T00:00:00');
    const tomorrowDayIdx = (d.getDay() + 6) % 7; // 0=Mon, 5=Sat

    const activeSubs = customers.filter(c => (c.status === 'active' || c.status === 'hold') && !c.is_deleted);

    const tomorrowCustomers = activeSubs.filter(c => {
      if (c.status !== 'active') return false;
      // Check if the customer has any customer packages
      const hasAnyCustPacks = customerPackages.some(cp => Number(cp.customer_id) === c.id);
      
      let isScheduledForAnyPack = false;
      
      if (hasAnyCustPacks) {
        // If they have entries in customer_packages, only look at their active custom packages
        const custPacks = customerPackages.filter(cp => Number(cp.customer_id) === c.id && cp.status === 'active');
        isScheduledForAnyPack = custPacks.some(cp => {
          if (cp.used >= cp.total) return false;

          const mode = getScheduleMode(cp);
          if (mode === 'default') {
            const cpPrefDays = cp.preferred_days;
            const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
            return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
          }
          
          if (cp.salad_schedules && Object.keys(cp.salad_schedules).length > 0) {
            const schedArrays = Object.values(cp.salad_schedules).filter((v: any) => Array.isArray(v)) as number[][];
            if (schedArrays.length > 0) {
              return schedArrays.some((days: number[]) => days.length === 0 || days.includes(tomorrowDayIdx));
            }
          }

          const cpPrefDays = cp.preferred_days;
          const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
          return effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
        });
      } else if (c.package_id && c.used < c.total && c.status === 'active') {
        // Legacy fallback (only when no customer_packages exist)
        const effectivePrefDays = c.preferred_days || [];
        isScheduledForAnyPack = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
      }

      if (!isScheduledForAnyPack) return false;

      // Check no skip for tomorrow (package-agnostic — any skip counts)
      const isSkipped = mealSkips.some(s => Number(s.customer_id) === c.id && s.skip_date === tomorrowISO && !s.unskipped);
      return !isSkipped;
    });

    const tomorrowPreorderSalads = preorders.filter(po => {
      if (po.pickup_date !== tomorrowISO || po.is_fulfilled || po.is_cancelled) return false;
      const saladItems = po.items.filter((it: any) => {
        const mi = menuItems.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        return mi?.type === 'salad';
      });
      return saladItems.length > 0;
    }).map(po => {
      const saladItems = po.items.filter((it: any) => {
        const mi = menuItems.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        return mi?.type === 'salad';
      });
      return { ...po, saladItems };
    });

    const groupMap = new Map<string, { id: string; name: string; type: 'salad' | 'package'; customers: any[] }>();

    // 1. Group subscription customers
    tomorrowCustomers.forEach(c => {
      const hasAnyCustPacks = customerPackages.some(cp => Number(cp.customer_id) === c.id);

      if (hasAnyCustPacks) {
        const custPacks = customerPackages.filter(cp => Number(cp.customer_id) === c.id && cp.status === 'active' && cp.used < cp.total);
        custPacks.forEach(cp => {
          const pkg = packages.find(p => p.id === cp.package_id);
          if (!pkg) return;

          const pkgSaladOptions = getPackageSaladOptions(pkg);
          if (pkgSaladOptions.length > 0) {
            const mode = getScheduleMode(cp);
            if (mode === 'default') {
              const cpPrefDays = cp.preferred_days;
              const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
              const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
              if (isScheduled) {
                const freq = cp.frequency || 1;
                const deliveryIndex = Math.floor(cp.used / freq);
                const startSaladKey = getStartingSaladKey(cp);
                let startIdx = 0;
                if (startSaladKey) {
                  const foundIdx = pkgSaladOptions.findIndex((opt: any) => `${opt.id}:${opt.option}` === startSaladKey);
                  if (foundIdx >= 0) startIdx = foundIdx;
                }
                const rotatedSaladIdx = (deliveryIndex + startIdx) % pkgSaladOptions.length;
                const opt = pkgSaladOptions[rotatedSaladIdx];
                if (opt) {
                  const saladKey = `${opt.id}:${opt.option}`;
                  const saladItem = menuItems.find(mi => mi.id === opt.id);
                  const baseName = saladItem ? saladItem.name : `Salad ID ${opt.id}`;
                  const name = opt.option && opt.option.toLowerCase() !== 'regular'
                    ? `${baseName} – ${opt.option}`
                    : baseName;
                  const groupId = `salad-${saladKey}`;
                  if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
                  }
                  groupMap.get(groupId)!.customers.push({
                    isPreorder: false,
                    customer: c,
                    cp,
                    instruction: cp.instruction || '',
                    used: cp.used,
                    total: cp.total,
                    qty: freq
                  });
                }
              }
            } else {
              pkgSaladOptions.forEach((opt: any) => {
                const saladKey = `${opt.id}:${opt.option}`;
                const saladSched = cp.salad_schedules || {};
                const days = saladSched[saladKey] || [];
                const isScheduled = days.length === 0 || days.includes(tomorrowDayIdx);
                if (isScheduled) {
                  const saladItem = menuItems.find(mi => mi.id === opt.id);
                  const baseName = saladItem ? saladItem.name : `Salad ID ${opt.id}`;
                  const name = opt.option && opt.option.toLowerCase() !== 'regular'
                    ? `${baseName} – ${opt.option}`
                    : baseName;
                  const groupId = `salad-${saladKey}`;
                  if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
                  }
                  groupMap.get(groupId)!.customers.push({
                    isPreorder: false,
                    customer: c,
                    cp,
                    instruction: cp.instruction || '',
                    used: cp.used,
                    total: cp.total,
                    qty: (cp.salad_frequencies && cp.salad_frequencies[saladKey]) || cp.frequency || 1
                  });
                }
              });
            }
          } else {
            // Fallback for package without salads
            const cpPrefDays = cp.preferred_days;
            const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
            const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
            if (isScheduled) {
              const groupId = `pkg-${pkg.id}`;
              if (!groupMap.has(groupId)) {
                groupMap.set(groupId, { id: groupId, name: pkg.name, type: 'package', customers: [] });
              }
              groupMap.get(groupId)!.customers.push({
                isPreorder: false,
                customer: c,
                cp,
                instruction: cp.instruction || '',
                used: cp.used,
                total: cp.total,
                qty: cp.frequency || 1
              });
            }
          }
        });
      } else {
        // Legacy fallback
        if (c.package_id && c.used < c.total && c.status === 'active') {
          const pkg = packages.find(p => p.id === c.package_id);
          if (pkg) {
            const effectivePrefDays = c.preferred_days || [];
            const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(tomorrowDayIdx);
            if (isScheduled) {
              const pkgSaladOptions = getPackageSaladOptions(pkg);
              if (pkgSaladOptions.length > 0) {
                pkgSaladOptions.forEach((opt: any) => {
                  const saladKey = `${opt.id}:${opt.option}`;
                  const saladItem = menuItems.find(mi => mi.id === opt.id);
                  const baseName = saladItem ? saladItem.name : `Salad ID ${opt.id}`;
                  const name = opt.option && opt.option.toLowerCase() !== 'regular'
                    ? `${baseName} – ${opt.option}`
                    : baseName;
                  const groupId = `salad-${saladKey}`;
                  if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
                  }
                  groupMap.get(groupId)!.customers.push({
                    isPreorder: false,
                    customer: c,
                    cp: null,
                    instruction: '',
                    used: c.used,
                    total: c.total
                  });
                });
              } else {
                const groupId = `pkg-${pkg.id}`;
                if (!groupMap.has(groupId)) {
                  groupMap.set(groupId, { id: groupId, name: pkg.name, type: 'package', customers: [] });
                }
                groupMap.get(groupId)!.customers.push({
                  isPreorder: false,
                  customer: c,
                  cp: null,
                  instruction: '',
                  used: c.used,
                  total: c.total
                });
              }
            }
          }
        }
      }
    });

    // 2. Group pre-order customers
    tomorrowPreorderSalads.forEach(po => {
      po.saladItems.forEach((it: any) => {
        const saladItem = menuItems.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        if (!saladItem) return;

        const option = it.option || "Regular";
        const saladKey = `${saladItem.id}:${option}`;
        const baseName = saladItem.name;
        const name = option && option.toLowerCase() !== 'regular'
          ? `${baseName} – ${option}`
          : baseName;
        const groupId = `salad-${saladKey}`;

        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, { id: groupId, name, type: 'salad', customers: [] });
        }
        groupMap.get(groupId)!.customers.push({
          isPreorder: true,
          customerName: po.customer_name || "One-time Customer",
          phone: po.phone || "",
          qty: it.qty,
          notes: po.notes || ""
        });
      });
    });

    const prepGroups = Array.from(groupMap.values());
    const prepCount = prepGroups.reduce((sum, g) => sum + g.customers.reduce((gSum, c) => gSum + (c.qty || 1), 0), 0);

    return prepCount;
  }, [customers, customerPackages, mealSkips, packages, preorders, menuItems]);

  const [filter, setFilter] = useState("all");

  const [notifyModal, setNotifyModal] = useState<{ open: boolean; customer: any; type: string; cp: CustomerPackage | null }>({ open: false, customer: null, type: "", cp: null });
  const [skipModal, setSkipModal] = useState<{ open: boolean; customer: any; cp: CustomerPackage | null }>({ open: false, customer: null, cp: null });
  const [skipDate, setSkipDate] = useState(getISTISODate());
  const [skipMode, setSkipMode] = useState<'single' | 'range' | 'multi'>('single');
  const [skipRangeStart, setSkipRangeStart] = useState(getISTISODate());
  const [skipRangeEnd, setSkipRangeEnd] = useState(getISTISODate());
  const [skipMultiDates, setSkipMultiDates] = useState<string[]>([]);
  const [skipAddDate, setSkipAddDate] = useState(getISTISODate());
  const [editModal, setEditModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPkg, setEditPkg] = useState("");
  const [editMode, setEditMode] = useState<any>("");
  const [weekOffset, setWeekOffset] = useState<Record<number, number>>({});

  // selected customer_package id per customer card
  const [selectedCpId, setSelectedCpId] = useState<Record<number, number>>({});

  // Add package to existing customer (from edit modal)
  const [addPkgModal, setAddPkgModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [addPkgPkgId, setAddPkgPkgId] = useState("");
  const [addPkgPayMode, setAddPkgPayMode] = useState("cash");
  const [addPkgCash, setAddPkgCash] = useState("");
  const [addPkgQrOpen, setAddPkgQrOpen] = useState(false);
  const [addPkgSaladDays, setAddPkgSaladDays] = useState<number[]>([]);
  const [addPkgSaladSchedules, setAddPkgSaladSchedules] = useState<Record<string, number[]>>({});
  const [addPkgInstruction, setAddPkgInstruction] = useState("");

  const [cancelModal, setCancelModal] = useState<{ open: boolean; customer: any; cp: CustomerPackage | null }>({ open: false, customer: null, cp: null });

  const [addModal, setAddModal] = useState(false);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPkgIds, setAddPkgIds] = useState<number[]>([]);
  const [addPayMode, setAddPayMode] = useState("cash");
  const [addCash, setAddCash] = useState("");
  const [addQrOpen, setAddQrOpen] = useState(false);
  const [addInstructions, setAddInstructions] = useState<Record<number, string>>({});
  const [editInstructions, setEditInstructions] = useState<Record<number, string>>({});
  const [editSaladDaysByCp, setEditSaladDaysByCp] = useState<Record<number, number[]>>({});
  const [editSaladSchedulesByCp, setEditSaladSchedulesByCp] = useState<Record<number, Record<string, number[]>>>({});
  const [addType, setAddType] = useState<'existing' | 'customize'>('existing');
  const [addCustomSaladDays, setAddCustomSaladDays] = useState<Record<number, number[]>>({});
  const [addSaladSchedules, setAddSaladSchedules] = useState<Record<number, Record<string, number[]>>>({});
  const [addPkgScheduleModes, setAddPkgScheduleModes] = useState<Record<number, 'set_schedule' | 'default'>>({});
  const [customScheduleMode, setCustomScheduleMode] = useState<'set_schedule' | 'default'>('set_schedule');
  const [addPkgScheduleMode, setAddPkgScheduleMode] = useState<'set_schedule' | 'default'>('set_schedule');
  const [editScheduleModesByCp, setEditScheduleModesByCp] = useState<Record<number, 'set_schedule' | 'default'>>({});
  const [addPkgStartSaladKeys, setAddPkgStartSaladKeys] = useState<Record<number, string>>({});
  const [customStartSaladKey, setCustomStartSaladKey] = useState<string>("");
  const [addPkgStartSaladKey, setAddPkgStartSaladKey] = useState<string>("");
  const [editStartSaladKeysByCp, setEditStartSaladKeysByCp] = useState<Record<number, string>>({});

  // Customize tab fields
  const [customPkgIds, setCustomPkgIds] = useState<number[]>([]);
  const [customPkgFrequencies, setCustomPkgFrequencies] = useState<Record<number, number>>({});
  const [editSaladFrequenciesByCp, setEditSaladFrequenciesByCp] = useState<Record<number, Record<string, number>>>({});
  const [editTotalsByCp, setEditTotalsByCp] = useState<Record<number, number>>({});
  const [editPricesByCp, setEditPricesByCp] = useState<Record<number, number>>({});
  const [addPkgFrequencies, setAddPkgFrequencies] = useState<Record<number, number>>({});
  const [addPkgFrequency, setAddPkgFrequency] = useState<number>(1);

  const customSaladKeys = useMemo(() => {
    const keys: string[] = [];
    customPkgIds.forEach(pkgId => {
      const pkg = packages.find(p => p.id === pkgId);
      if (!pkg) return;
      const opts = getPackageSaladOptions(pkg);
      opts.forEach(opt => {
        const key = `${opt.id}:${opt.option}`;
        if (!keys.includes(key)) {
          keys.push(key);
        }
      });
    });
    return keys;
  }, [customPkgIds, packages]);

  const [customSaladSchedules, setCustomSaladSchedules] = useState<Record<string, number[]>>({});
  const [customMealsCount, setCustomMealsCount] = useState<string>("10");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [customPayMode, setCustomPayMode] = useState<"cash" | "upi" | "scanpay">("cash");
  const [customIsActive, setCustomIsActive] = useState<boolean>(true);

  const totalCustomDailyFreq = useMemo(() => {
    let sum = 0;
    customPkgIds.forEach(id => {
      sum += (customPkgFrequencies[id] || 1);
    });
    return sum;
  }, [customPkgIds, customPkgFrequencies]);

  const customMealsCountNum = Number(customMealsCount) || 0;
  const isCustomMealsInvalid = useMemo(() => {
    if (addType !== 'customize' || customPkgIds.length === 0) return false;
    if (totalCustomDailyFreq <= 0 || customMealsCountNum <= 0) return false;
    return customMealsCountNum % totalCustomDailyFreq !== 0;
  }, [addType, customPkgIds.length, totalCustomDailyFreq, customMealsCountNum]);

  useEffect(() => {
    if (addType !== 'customize' || customPkgIds.length === 0) return;
    let totalFreq = 0;
    customPkgIds.forEach(id => {
      totalFreq += (customPkgFrequencies[id] || 1);
    });
    const meals = Number(customMealsCount) || 0;
    if (totalFreq > 0 && meals > 0 && meals % totalFreq === 0) {
      const days = meals / totalFreq;
      let calcPrice = 0;
      customPkgIds.forEach(id => {
        const pkg = packages.find(p => p.id === id);
        if (pkg) {
          const freq = customPkgFrequencies[id] || 1;
          const baseP = pkg.price || 0;
          const baseM = pkg.meals_count ?? 10;
          const perMeal = baseP / (baseM || 10);
          calcPrice += days * freq * perMeal;
        }
      });
      setCustomPrice(Math.round(calcPrice).toString());
    }
  }, [customPkgIds, customPkgFrequencies, customMealsCount, packages, addType]);

  const saladMenuItems = useMemo(() => {
    return menuItems.filter(m => m.type === 'salad' && m.is_active);
  }, [menuItems]);

  const saladVariants = useMemo(() => {
    const list: Array<{ id: number; name: string; option: string }> = [];
    saladMenuItems.forEach(item => {
      if (item.options && item.options.length > 0) {
        item.options.forEach((opt: any) => {
          list.push({ id: item.id, name: `${item.name} – ${opt.name}`, option: opt.name });
        });
      } else {
        list.push({ id: item.id, name: item.name, option: 'Regular' });
      }
    });
    return list;
  }, [saladMenuItems]);

  const toggleEditSaladScheduleDay = (cpId: number, saladKey: string, dayIdx: number) => {
    setEditSaladSchedulesByCp(prev => {
      const cpSched = prev[cpId] || {};
      const currentSaladDays = cpSched[saladKey] || [];
      let nextSaladDays: number[];
      if (currentSaladDays.length === 0) {
        nextSaladDays = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
      } else if (currentSaladDays.includes(dayIdx)) {
        nextSaladDays = currentSaladDays.filter(d => d !== dayIdx);
      } else {
        nextSaladDays = [...currentSaladDays, dayIdx].sort();
      }
      if (nextSaladDays.length === 6) nextSaladDays = [];
      return {
        ...prev,
        [cpId]: {
          ...cpSched,
          [saladKey]: nextSaladDays
        }
      };
    });
  };

  const toggleSaladScheduleDay = (pkgId: number, saladKey: string, dayIdx: number) => {
    setAddSaladSchedules(prev => {
      const pkgSched = prev[pkgId] || {};
      const currentSaladDays = pkgSched[saladKey] || [];
      let nextSaladDays: number[];
      if (currentSaladDays.length === 0) {
        nextSaladDays = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
      } else if (currentSaladDays.includes(dayIdx)) {
        nextSaladDays = currentSaladDays.filter(d => d !== dayIdx);
      } else {
        nextSaladDays = [...currentSaladDays, dayIdx].sort();
      }
      if (nextSaladDays.length === 6) nextSaladDays = [];
      return {
        ...prev,
        [pkgId]: {
          ...pkgSched,
          [saladKey]: nextSaladDays
        }
      };
    });
  };

  const toggleCustomSaladScheduleDay = (saladKey: string, dayIdx: number) => {
    setCustomSaladSchedules(prev => {
      const currentSaladDays = prev[saladKey] || [];
      let nextSaladDays: number[];
      if (currentSaladDays.length === 0) {
        nextSaladDays = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
      } else if (currentSaladDays.includes(dayIdx)) {
        nextSaladDays = currentSaladDays.filter(d => d !== dayIdx);
      } else {
        nextSaladDays = [...currentSaladDays, dayIdx].sort();
      }
      if (nextSaladDays.length === 6) nextSaladDays = [];
      return {
        ...prev,
        [saladKey]: nextSaladDays
      };
    });
  };

  const toggleAddPkgSaladScheduleDay = (saladKey: string, dayIdx: number) => {
    setAddPkgSaladSchedules(prev => {
      const currentSaladDays = prev[saladKey] || [];
      let nextSaladDays: number[];
      if (currentSaladDays.length === 0) {
        nextSaladDays = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
      } else if (currentSaladDays.includes(dayIdx)) {
        nextSaladDays = currentSaladDays.filter(d => d !== dayIdx);
      } else {
        nextSaladDays = [...currentSaladDays, dayIdx].sort();
      }
      if (nextSaladDays.length === 6) nextSaladDays = [];
      return {
        ...prev,
        [saladKey]: nextSaladDays
      };
    });
  };


  const [historyModal, setHistoryModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [historyLogs, setHistoryLogs] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [instrModal, setInstrModal] = useState<{ open: boolean; customer: any }>({ open: false, customer: null });
  const [instrEdits, setInstrEdits] = useState<Record<number, string>>({});

  const [mealUsedModal, setMealUsedModal] = useState<{ open: boolean; customer: any; used: number; total: number; pkgName: string; qty?: number }>({ open: false, customer: null, used: 0, total: 0, pkgName: '', qty: 1 });
  const [useMealQty, setUseMealQty] = useState<{ [key: number]: number | string }>({});

  // ─── helpers ──────────────────────────────────────────────────────────────
  const activeSubs = customers.filter(c => !c.is_deleted);

  const getCustPacks = (customerId: number) =>
    customerPackages.filter(cp => Number(cp.customer_id) === customerId && cp.status !== 'cancelled')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getSelectedCp = (c: any): CustomerPackage | null => {
    const cps = getCustPacks(c.id);
    if (cps.length === 0) return null;
    const selected = cps.find(cp => cp.id === selectedCpId[c.id]);
    if (selected) return selected;
    const firstActive = cps.find(cp => cp.total - cp.used > 0 && cp.status === 'active');
    return firstActive || cps[0];
  };

  const getDisplayData = (c: any) => {
    const cp = getSelectedCp(c);
    return {
      cp,
      used: cp ? cp.used : c.used,
      total: cp ? cp.total : c.total,
      packageId: cp ? cp.package_id : c.package_id,
    };
  };

  const activePackages = packages.filter(p => p.is_active);

  const filteredSubs = activeSubs.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.phone.includes(searchQuery)) return false;
    const { cp, used, total } = getDisplayData(c);
    const isCpOnHold = (cp ? cp.status : c.status) === 'hold';

    if (filter === "active") return !isCpOnHold && used < total;
    if (filter === "hold") return isCpOnHold && used < total;
    if (filter === "low") return (total - used) <= 2 && used < total;
    if (filter === "done") return used >= total;
    if (filter === "new") return c.renew_count === 0 && used < total;
    if (filter === "renewed") return c.renew_count > 0 && used < total;
    return true;
  });

  const selectedAddPkgs = activePackages.filter(p => addPkgIds.includes(p.id));
  const addTotal = addType === 'customize'
    ? (Number(customPrice) || 0)
    : selectedAddPkgs.reduce((s, p) => s + p.price, 0);

  const upiTotal = addType === 'customize'
    ? (customPayMode !== 'cash' ? addTotal : 0)
    : (addPayMode !== 'cash' ? addTotal : 0);

  const cashTotal = addType === 'customize'
    ? (customPayMode === 'cash' ? addTotal : 0)
    : (addPayMode === 'cash' ? addTotal : 0);

  const addCashNum = Number(addCash) || 0;
  const addChange = addCashNum - cashTotal;
  const addUpiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${upiTotal}&cu=INR`;

  const hasScanPay = addType === 'customize'
    ? customPayMode === 'scanpay'
    : addPayMode === 'scanpay';

  const selectedAddPkgPkg = activePackages.find(p => p.id.toString() === addPkgPkgId);
  const addPkgTotal = selectedAddPkgPkg?.price || 0;
  const addPkgUpiUrl = `upi://pay?pa=${UPI_ID}&pn=Morning+Bites&am=${addPkgTotal}&cu=INR`;

  // ─── Add customer ─────────────────────────────────────────────────────────
  const handleAddCustomer = async () => {
    if (!addName.trim() || !addPhone.trim()) {
      toast({ variant: "destructive", description: "Name and phone are required" });
      return;
    }

    if (addType === 'customize') {
      if (customSaladKeys.length === 0) {
        toast({ variant: "destructive", description: "Please select at least one salad" });
        return;
      }
      if (!customMealsCount.trim() || Number(customMealsCount) <= 0) {
        toast({ variant: "destructive", description: "Number of meals must be greater than 0" });
        return;
      }
      if (totalCustomDailyFreq > 0 && customMealsCountNum % totalCustomDailyFreq !== 0) {
        toast({
          variant: "destructive",
          description: `Total meals must be a multiple of ${totalCustomDailyFreq} (e.g. ${totalCustomDailyFreq}, ${totalCustomDailyFreq * 2}, ${totalCustomDailyFreq * 3}, ${totalCustomDailyFreq * 4}...)`
        });
        return;
      }
      if (!customPrice.trim() || Number(customPrice) < 0) {
        toast({ variant: "destructive", description: "Price must be at least 0" });
        return;
      }
    } else {
      if (addPkgIds.length === 0) {
        toast({ variant: "destructive", description: "At least one package is required" });
        return;
      }
    }

    if (hasScanPay && !addQrOpen) {
      setAddQrOpen(true);
      return;
    }

    const today = getISTISODate();
    const dateDisplay = formatISTDate(today);
    const existingCust = customers.find(c => c.phone === addPhone);

    let msg = "";
    if (addType === 'customize') {
      const selectedVariants = saladVariants.filter(sv => customSaladKeys.includes(`${sv.id}:${sv.option}`));
      const saladNames = selectedVariants.map(sv => sv.name).join(', ');
      msg = isRenewalMode
        ? buildRenewalMsg(addName, saladNames, Number(customMealsCount), Number(customPrice), dateDisplay)
        : buildActiveSubMsg(addName, saladNames, Number(customMealsCount), Number(customPrice), dateDisplay);
    } else {
      const primaryPkg = selectedAddPkgs[0];
      const primaryMeals = primaryPkg?.meals_count ?? 10;
      msg = isRenewalMode
        ? (selectedAddPkgs.length === 1
            ? buildRenewalMsg(addName, primaryPkg?.name || 'Sprouts Salad', primaryMeals, primaryPkg?.price || 0, dateDisplay)
            : buildRenewalMsgMulti(addName, selectedAddPkgs, dateDisplay))
        : (selectedAddPkgs.length === 1
            ? buildActiveSubMsg(addName, primaryPkg?.name || 'Sprouts Salad', primaryMeals, primaryPkg?.price || 0, dateDisplay)
            : buildActiveSubMsgMulti(addName, selectedAddPkgs, dateDisplay));
    }
    window.open(`https://wa.me/91${addPhone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      let custId: number | null = null;

      if (addType === 'customize') {
        const selectedVariants = saladVariants.filter(sv => customSaladKeys.includes(`${sv.id}:${sv.option}`));
        if (selectedVariants.length === 0) throw new Error("Selected salad variants not found");
        
        // 1. Create a custom package in the packages table
        const customPkgRes = await dbIns<any>('packages', {
          name: `Custom: ${selectedVariants.map(sv => sv.name).join(', ')}`,
          price: Number(customPrice),
          meals_count: Number(customMealsCount),
          is_active: false,
          salad_options: selectedVariants.map(sv => ({ id: sv.id, option: sv.option })),
          salad_ids: selectedVariants.map(sv => sv.id)
        });
        const newPkg = customPkgRes[0];
        if (!newPkg) throw new Error("Failed to create custom package");

        // Calculate union of preferred days
        const customPkgSaladDays = getUnionOfSchedules(customSaladSchedules, customSaladKeys);

        // 2. Insert or update customer
        if (existingCust) {
          await dbUpd('customers', existingCust.id, {
            name: addName, status: customIsActive ? 'active' : 'hold', used: 0, total: Number(customMealsCount),
            renew_count: existingCust.renew_count + 1,
            last_renewed: today, pack_start_date: today,
            package_id: newPkg.id, payment_mode: customPayMode
          });
          custId = existingCust.id;
          await dbUpdWhere('meal_skips', `customer_id=eq.${custId}&skip_date=gte.${today}&unskipped=eq.false`, { unskipped: true });
        } else {
          const res = await dbIns<any>('customers', {
            name: addName, phone: addPhone, type: 'subscribed',
            total: Number(customMealsCount), used: 0, join_date: today, renew_count: 0,
            pack_start_date: today, status: customIsActive ? 'active' : 'hold', is_deleted: false,
            preferred_days: customPkgSaladDays, package_id: newPkg.id, payment_mode: customPayMode
          });
          custId = res[0]?.id || null;
        }

        // 3. Insert customer_packages
        const saladFrequencies: Record<string, number> = {};
        customPkgIds.forEach(pkgId => {
          const pkg = packages.find(p => p.id === pkgId);
          if (!pkg) return;
          const freq = customPkgFrequencies[pkgId] || 1;
          const opts = getPackageSaladOptions(pkg);
          opts.forEach(opt => {
            const key = `${opt.id}:${opt.option}`;
            saladFrequencies[key] = freq;
          });
        });

        const customStartSalad = customStartSaladKey || customSaladKeys[0];
        const customSaladSchedsWithMode = { ...customSaladSchedules, schedule_mode: customScheduleMode, start_salad_key: customStartSalad };
        await dbIns('customer_packages', {
          customer_id: custId,
          package_id: newPkg.id,
          used: 0,
          total: Number(customMealsCount),
          pack_start_date: today,
          payment_mode: customPayMode,
          status: customIsActive ? 'active' : 'hold',
          renew_count: existingCust ? existingCust.renew_count + 1 : 0,
          instruction: addInstructions[newPkg.id] || '',
          preferred_days: customPkgSaladDays,
          salad_schedules: customSaladSchedsWithMode,
          schedule_mode: customScheduleMode,
          start_salad_key: customStartSalad,
          frequency: 1,
          salad_frequencies: saladFrequencies,
        });

        logActivity(custId, existingCust ? 'renewed' : 'subscribed', `${existingCust ? 'Renewed' : 'Subscribed'} to Custom Salad Subscription (${selectedVariants.map(sv => sv.name).join(', ')}) for ₹${customPrice}. Payment: ${customPayMode}`);
      } else {
        // Standard existing package flow
        const primaryPkg = selectedAddPkgs[0];
        const primaryMeals = primaryPkg?.meals_count ?? 10;
        const primaryPkgPayMode = addPayMode;
        const primaryPkgSaladOptions = getPackageSaladOptions(primaryPkg);
        const primaryPkgSaladKeys = primaryPkgSaladOptions.map(opt => `${opt.id}:${opt.option}`);
        const primaryPkgSaladDays = primaryPkgSaladKeys.length > 0
          ? getUnionOfSchedules(addSaladSchedules[primaryPkg.id] || {}, primaryPkgSaladKeys)
          : (addCustomSaladDays[primaryPkg.id] || []);

        if (existingCust) {
          await dbUpd('customers', existingCust.id, {
            name: addName, status: 'active', used: 0, total: primaryMeals,
            renew_count: existingCust.renew_count + 1,
            last_renewed: today, pack_start_date: today,
            package_id: primaryPkg?.id || null, payment_mode: primaryPkgPayMode
          });
          custId = existingCust.id;
          await dbUpdWhere('meal_skips', `customer_id=eq.${custId}&skip_date=gte.${today}&unskipped=eq.false`, { unskipped: true });
        } else {
          const res = await dbIns<any>('customers', {
            name: addName, phone: addPhone, type: 'subscribed',
            total: primaryMeals, used: 0, join_date: today, renew_count: 0,
            pack_start_date: today, status: 'active', is_deleted: false,
            preferred_days: primaryPkgSaladDays, package_id: primaryPkg?.id || null, payment_mode: primaryPkgPayMode
          });
          custId = res[0]?.id || null;
        }

        if (custId) {
          for (const pkg of selectedAddPkgs) {
            const mode = addPkgScheduleModes[pkg.id] || 'set_schedule';
            const pkgSaladOptions = getPackageSaladOptions(pkg);
            const startSalad = addPkgStartSaladKeys[pkg.id] || (pkgSaladOptions.length > 0 ? `${pkgSaladOptions[0].id}:${pkgSaladOptions[0].option}` : undefined);
            const saladScheds = { ...(addSaladSchedules[pkg.id] || {}), schedule_mode: mode, ...(startSalad ? { start_salad_key: startSalad } : {}) };
            const pkgSaladKeys = pkgSaladOptions.map(opt => `${opt.id}:${opt.option}`);
            const pkgSaladDays = pkgSaladKeys.length > 0
              ? getUnionOfSchedules(saladScheds, pkgSaladKeys)
              : (addCustomSaladDays[pkg.id] || []);

            const freq = addPkgFrequencies[pkg.id] || 1;
            const saladFrequencies: Record<string, number> = {};
            pkgSaladOptions.forEach(opt => {
              saladFrequencies[`${opt.id}:${opt.option}`] = freq;
            });

            await dbIns('customer_packages', {
              customer_id: custId,
              package_id: pkg.id,
              used: 0,
              total: pkg.meals_count ?? 10,
              pack_start_date: today,
              payment_mode: addPayMode,
              status: 'active',
              renew_count: existingCust ? existingCust.renew_count + 1 : 0,
              instruction: addInstructions[pkg.id] || '',
              preferred_days: pkgSaladDays,
              salad_schedules: saladScheds,
              schedule_mode: mode,
              ...(startSalad ? { start_salad_key: startSalad } : {}),
              frequency: freq,
              salad_frequencies: saladFrequencies,
            });
          }
        }

        const pkgNames = selectedAddPkgs.map(p => p.name).join(', ');
        logActivity(custId, existingCust ? 'renewed' : 'subscribed', `${existingCust ? 'Renewed' : 'Subscribed'} to ${pkgNames} for ₹${addTotal}. Payment: ${addPayMode}`);
      }

      toast({ title: isRenewalMode ? "Subscription renewed!" : existingCust ? "Pack renewed!" : "Customer added and subscribed!" });
      setAddModal(false);
      setAddQrOpen(false);
      setIsRenewalMode(false);
      setAddName(""); setAddPhone(""); setAddPkgIds([]); setAddPayMode("cash"); setAddCash("");
      setAddInstructions({});
      setAddType("existing"); setAddCustomSaladDays({});
      setCustomPkgIds([]); setCustomPkgFrequencies({}); setAddPkgFrequencies({}); setCustomSaladSchedules({}); setCustomMealsCount("10");
      setCustomPrice(""); setCustomPayMode("cash"); setCustomIsActive(true);
      setAddPkgScheduleModes({}); setCustomScheduleMode('set_schedule'); setAddPkgScheduleMode('set_schedule');
      setAddPkgStartSaladKeys({}); setCustomStartSaladKey(""); setAddPkgStartSaladKey(""); setEditStartSaladKeysByCp({});
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Add package to existing customer ─────────────────────────────────────
  const handleAddPackageToCustomer = async () => {
    const c = addPkgModal.customer;
    if (!c || !addPkgPkgId) {
      toast({ variant: "destructive", description: "Select a package" });
      return;
    }
    if (addPkgPayMode === 'scanpay' && !addPkgQrOpen) {
      setAddPkgQrOpen(true);
      return;
    }

    const pkg = activePackages.find(p => p.id.toString() === addPkgPkgId);
    const today = getISTISODate();
    const dateDisplay = formatISTDate(today);
    const mealsCount = pkg?.meals_count ?? 10;

    const msg = buildActiveSubMsg(c.name, pkg?.name || 'Sprouts Salad', mealsCount, pkg?.price || 0, dateDisplay);
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      const pkgSaladOptions = getPackageSaladOptions(pkg);
      const pkgSaladKeys = pkgSaladOptions.map(opt => `${opt.id}:${opt.option}`);
      const pkgSaladDays = pkgSaladKeys.length > 0
        ? getUnionOfSchedules(addPkgSaladSchedules, pkgSaladKeys)
        : addPkgSaladDays;

      const freq = addPkgFrequency || 1;
      const saladFrequencies: Record<string, number> = {};
      pkgSaladOptions.forEach(opt => {
        saladFrequencies[`${opt.id}:${opt.option}`] = freq;
      });

      const startSalad = addPkgStartSaladKey || (pkgSaladOptions.length > 0 ? `${pkgSaladOptions[0].id}:${pkgSaladOptions[0].option}` : undefined);
      const addPkgSaladSchedsWithMode = { ...addPkgSaladSchedules, schedule_mode: addPkgScheduleMode, ...(startSalad ? { start_salad_key: startSalad } : {}) };
      await dbIns('customer_packages', {
        customer_id: c.id,
        package_id: Number(addPkgPkgId),
        used: 0,
        total: mealsCount,
        pack_start_date: today,
        payment_mode: addPkgPayMode,
        status: 'active',
        renew_count: 0,
        preferred_days: pkgSaladDays,
        instruction: addPkgInstruction,
        salad_schedules: addPkgSaladSchedsWithMode,
        schedule_mode: addPkgScheduleMode,
        ...(startSalad ? { start_salad_key: startSalad } : {}),
        frequency: freq,
        salad_frequencies: saladFrequencies,
      });

      logActivity(c.id, 'pkg_added', `Additional package added: ${pkg?.name} for ₹${pkg?.price}`);
      toast({ title: "Package added!" });
      setAddPkgModal({ open: false, customer: null });
      setAddPkgQrOpen(false);
      setAddPkgPkgId(""); setAddPkgPayMode("cash"); setAddPkgCash("");
      setAddPkgSaladDays([]); setAddPkgInstruction(""); setAddPkgSaladSchedules({});
      setAddPkgFrequency(1);
      setAddPkgScheduleMode('set_schedule');
      setAddPkgStartSaladKey("");
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Mark meal used ───────────────────────────────────────────────────────
  const handleUseMeal = async (c: any, cp: CustomerPackage | null, qty: number = 1) => {
    const currentUsed = cp ? cp.used : c.used;
    const currentTotal = cp ? cp.total : c.total;
    if (currentUsed + qty > currentTotal) return;

    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { used: cp.used + qty });
        await dbUpd('customers', c.id, { used: c.used + qty });
      } else {
        await dbUpd('customers', c.id, { used: c.used + qty });
      }
      const pkg = packages.find(p => p.id === (cp ? cp.package_id : c.package_id));
      const newUsed = currentUsed + qty;
      const saladName = pkg?.name || 'Meal';
      await logActivity(
        c.id,
        'meal_used',
        `${qty > 1 ? qty + ' ' + saladName + 's' : saladName} used. Now ${newUsed}/${currentTotal}`,
        { package_name: pkg?.name, package_id: cp ? cp.package_id : c.package_id, qty }
      );
      refresh();
      setMealUsedModal({ open: true, customer: c, used: newUsed, total: currentTotal, pkgName: pkg?.name || '', qty });
      setUseMealQty(p => ({ ...p, [c.id]: 1 }));
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const handleSendMealUpdate = (customer: any, used: number, remaining: number, total: number, pkgName: string, qty?: number) => {
    const msg = buildMealUpdateMsg(customer.name, used, remaining, total, pkgName || undefined, qty);
    window.open(`https://wa.me/91${customer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setMealUsedModal({ open: false, customer: null, used: 0, total: 0, pkgName: '', qty: 1 });
  };

  // ─── Undo meal ────────────────────────────────────────────────────────────
  const handleUndo = async (c: any, cp: CustomerPackage | null) => {
    const currentUsed = cp ? cp.used : c.used;
    if (currentUsed === 0) return;
    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { used: cp.used - 1 });
        await dbUpd('customers', c.id, { used: Math.max(0, c.used - 1) });
      } else {
        await dbUpd('customers', c.id, { used: c.used - 1 });
      }
      await logActivity(c.id, 'meal_undo', `Meal use undone. Now ${currentUsed - 1}/${cp ? cp.total : c.total}`);
      toast({ title: "Meal use undone" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Renew ────────────────────────────────────────────────────────────────
  const handleRenew = (c: any, cp: CustomerPackage | null) => {
    const pkgId = cp ? cp.package_id : c.package_id;
    setIsRenewalMode(true);
    setAddModal(true);
    setAddQrOpen(false);
    setAddName(c.name);
    setAddPhone(c.phone);
    setAddPkgIds(pkgId ? [pkgId] : []);
    setAddPayMode(cp?.payment_mode || c.payment_mode || 'cash');
    setAddCash('');
    setAddInstructions({});
    if (pkgId) {
      setAddCustomSaladDays({ [pkgId]: cp?.preferred_days || c.preferred_days || [] });
    } else {
      setAddCustomSaladDays({});
    }
    setAddType("existing");
  };

  // ─── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = (c: any, cp: CustomerPackage | null) => {
    setCancelModal({ open: true, customer: c, cp });
  };

  const handleConfirmCancel = async (sendReturn: boolean) => {
    const { customer: c, cp } = cancelModal;
    if (!c) return;

    if (sendReturn) {
      const pkgId = cp ? cp.package_id : c.package_id;
      const pkg = packages.find(p => p.id === pkgId);
      const pricePerMeal = pkg ? Math.round(pkg.price / (pkg.meals_count ?? 10)) : 0;
      const used = cp ? cp.used : c.used;
      const total = cp ? cp.total : c.total;
      const refundAmount = (total - used) * pricePerMeal;
      const msg = `Hello ${c.name},\n\nYour subscription has been cancelled.\n\n📊 Meals Used: ${used}/${total}\n💰 Refund Amount: ₹${refundAmount} (${total - used} meals × ₹${pricePerMeal})\n\nWe hope to see you again!`;
      window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { status: 'cancelled' });
        const remaining = getCustPacks(c.id).filter(x => x.id !== cp.id);
        if (remaining.length === 0) {
          await dbUpd('customers', c.id, { status: 'cancelled' });
        }
      } else {
        await dbUpd('customers', c.id, { status: 'cancelled' });
      }
      logActivity(c.id, 'cancelled', 'Subscription cancelled.');
      toast({ title: "Subscription cancelled" });
      setCancelModal({ open: false, customer: null, cp: null });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (c: any) => {
    if (window.confirm("Delete this customer? They will be removed from both Subscribed and Walk-ins.")) {
      try {
        await dbUpd('customers', c.id, { is_deleted: true });
        const walkin = walkins.find(w => w.phone === c.phone);
        if (walkin) await dbUpd('walkins', walkin.id, { is_deleted: true });
        await logActivity(c.id, 'deleted', 'Customer deleted (soft)');
        toast({ title: "Customer deleted" });
        refresh();
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      }
    }
  };

  // ─── Hold / Unhold ─────────────────────────────────────────────────────────
  const handleToggleHold = async (c: any, cp: CustomerPackage | null) => {
    try {
      const isHold = cp ? cp.status === 'hold' : c.status === 'hold';
      const newStatus = isHold ? 'active' : 'hold';
      
      const pkgId = cp ? cp.package_id : c.package_id;
      const pkg = packages.find(p => p.id === pkgId);
      const pkgName = pkg?.name || "Salad";

      if (cp) {
        await dbUpd('customer_packages', cp.id, { status: newStatus });
      } else {
        await dbUpd('customers', c.id, { status: newStatus });
      }

      await logActivity(
        c.id,
        newStatus === 'hold' ? 'hold_package' : 'unhold_package',
        `Package "${pkgName}" ${newStatus === 'hold' ? 'put on hold' : 'activated/unheld'}`
      );

      toast({
        title: newStatus === 'hold' ? "Package put on hold" : "Package activated",
        description: `"${pkgName}" for ${c.name} is now ${newStatus === 'hold' ? 'on hold' : 'active'}.`
      });

      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Notify ───────────────────────────────────────────────────────────────
  const sendWhatsApp = () => {
    const c = notifyModal.customer;
    const cp = notifyModal.cp;
    if (!c) return;

    const pkgId = cp ? cp.package_id : c.package_id;
    const pkg = packages.find(p => p.id === pkgId);
    const used = cp ? cp.used : c.used;
    const total = cp ? cp.total : c.total;
    const remaining = total - used;
    const price = pkg?.price || 0;
    const pkgName = pkg?.name;

    let msg = "";
    if (notifyModal.type === 'meal') {
      msg = buildMealUpdateMsg(c.name, used, remaining, total, pkgName);
    } else if (notifyModal.type === 'low') {
      msg = buildRenewPackMsg(c.name, remaining, total, price, pkgName);
    } else if (notifyModal.type === 'done') {
      msg = buildPackDoneMsg(c.name, total, price, pkgName);
    }
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setNotifyModal({ open: false, customer: null, type: "", cp: null });
  };

  // ─── Skip ─────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    const c = skipModal.customer;
    const skipCp = skipModal.cp;
    if (!c) return;

    let datesToSkip: string[] = [];
    if (skipMode === 'single') {
      if (!skipDate) return;
      datesToSkip = [skipDate];
    } else if (skipMode === 'range') {
      if (!skipRangeStart || !skipRangeEnd || skipRangeStart > skipRangeEnd) {
        toast({ variant: "destructive", description: "Select a valid date range" });
        return;
      }
      let d = new Date(skipRangeStart + 'T00:00:00');
      const end = new Date(skipRangeEnd + 'T00:00:00');
      while (d <= end) {
        datesToSkip.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d));
        d.setDate(d.getDate() + 1);
      }
    } else {
      if (skipMultiDates.length === 0) {
        toast({ variant: "destructive", description: "Add at least one date" });
        return;
      }
      datesToSkip = [...skipMultiDates];
    }

    const pkg = skipCp ? packages.find(p => p.id === skipCp.package_id) : null;
    const pkgLine = pkg ? `\n📦 Package: ${pkg.name}` : '';

    let msg = '';
    if (skipMode === 'single') {
      const d = new Date(datesToSkip[0] + 'T00:00:00');
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
      const dateStr = d.toLocaleDateString('en-IN');
      msg = `Hello ${c.name},\n\nConfirmed — your pack is skipped for:\n\n📅 ${dayName}, ${dateStr}${pkgLine}\n\nYour remaining meals stay the same. See you on your next day!`;
    } else if (skipMode === 'range') {
      const start = new Date(datesToSkip[0] + 'T00:00:00').toLocaleDateString('en-IN');
      const end = new Date(datesToSkip[datesToSkip.length - 1] + 'T00:00:00').toLocaleDateString('en-IN');
      msg = `Hello ${c.name},\n\nConfirmed — your pack is skipped from:\n\n📅 ${start} to ${end} (${datesToSkip.length} days)${pkgLine}\n\nYour remaining meals stay the same.`;
    } else {
      const dateLines = datesToSkip.map(d => `📅 ${new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}`).join('\n');
      msg = `Hello ${c.name},\n\nConfirmed — your pack is skipped on:\n\n${dateLines}${pkgLine}\n\nYour remaining meals stay the same.`;
    }
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');

    try {
      for (const date of datesToSkip) {
        await dbIns('meal_skips', {
          customer_id: c.id,
          skip_date: date,
          notified: true,
          unskipped: false,
          customer_package_id: skipCp?.id ?? null,
        });
      }
      logActivity(c.id, 'meal_skipped', `${datesToSkip.length} day(s) skipped${pkg ? ` (${pkg.name})` : ''}: ${datesToSkip.join(', ')}`);
      setSkipModal({ open: false, customer: null, cp: null });
      setSkipMode('single');
      setSkipMultiDates([]);
      toast({ title: `${datesToSkip.length} day${datesToSkip.length > 1 ? 's' : ''} skipped & WhatsApp opened` });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Unskip ───────────────────────────────────────────────────────────────
  const handleUnskip = async (skipId: number, customerId: number) => {
    try {
      await dbUpd('meal_skips', skipId, { unskipped: true });
      logActivity(customerId, 'meal_unskipped', 'Skip removed');
      toast({ title: "Skip removed" });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Preferred days (per package when cp provided, else per customer) ────
  const handleTogglePrefDay = async (c: any, dayIdx: number, cp: CustomerPackage | null) => {
    const currentPrefs = cp ? [...(cp.preferred_days ?? [])] : [...(c.preferred_days || [])];
    let newPrefs = currentPrefs;
    if (newPrefs.length === 0) {
      newPrefs = [0, 1, 2, 3, 4, 5].filter(d => d !== dayIdx);
    } else if (newPrefs.includes(dayIdx)) {
      newPrefs = newPrefs.filter(d => d !== dayIdx);
    } else {
      newPrefs.push(dayIdx);
    }
    if (newPrefs.length === 6) newPrefs = [];
    try {
      if (cp) {
        await dbUpd('customer_packages', cp.id, { preferred_days: newPrefs });
      } else {
        await dbUpd('customers', c.id, { preferred_days: newPrefs });
      }
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (c: any) => {
    setEditModal({ open: true, customer: c });
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditPkg(c.package_id ? c.package_id.toString() : "");
    setEditMode(c.payment_mode);
    const cps = getCustPacks(c.id);
    const instr: Record<number, string> = {};
    const saladDays: Record<number, number[]> = {};
    const saladScheds: Record<number, Record<number, number[]>> = {};
    const freqs: Record<number, Record<string, number>> = {};
    const totals: Record<number, number> = {};
    const prices: Record<number, number> = {};
    const modes: Record<number, 'set_schedule' | 'default'> = {};
    const startKeys: Record<number, string> = {};
    cps.forEach(cp => {
      instr[cp.id] = cp.instruction || '';
      saladDays[cp.id] = cp.preferred_days || [];
      saladScheds[cp.id] = cp.salad_schedules || {};
      freqs[cp.id] = cp.salad_frequencies || {};
      totals[cp.id] = cp.total;
      modes[cp.id] = getScheduleMode(cp);
      startKeys[cp.id] = getStartingSaladKey(cp) || '';
      const pkg = packages.find(p => p.id === cp.package_id);
      const perMeal = pkg ? (pkg.price / (pkg.meals_count || 10)) : 0;
      prices[cp.id] = pkg ? Math.round(cp.total * perMeal) : 0;
    });
    setEditInstructions(instr);
    setEditSaladDaysByCp(saladDays);
    setEditSaladSchedulesByCp(saladScheds);
    setEditSaladFrequenciesByCp(freqs);
    setEditTotalsByCp(totals);
    setEditPricesByCp(prices);
    setEditScheduleModesByCp(modes);
    setEditStartSaladKeysByCp(startKeys);
  };

  const saveEdit = async () => {
    const c = editModal.customer;
    if (!c) return;
    try {
      const cps = getCustPacks(c.id);

      // 1. Validation check for daily frequency multiples across edited packages
      for (const cp of cps) {
        const pkg = packages.find(p => p.id === cp.package_id);
        const editedTotal = editTotalsByCp[cp.id] ?? cp.total;
        const remaining = editedTotal - cp.used;
        const cpSaladFreqs = editSaladFrequenciesByCp[cp.id] || cp.salad_frequencies || {};
        let totalDailyFreq = 0;
        const saladOpts = getPackageSaladOptions(pkg);
        if (saladOpts.length > 0) {
          saladOpts.forEach((opt: any) => {
            const key = `${opt.id}:${opt.option}`;
            totalDailyFreq += (cpSaladFreqs[key] ?? cp.frequency ?? 1);
          });
        } else {
          totalDailyFreq = cpSaladFreqs['pkg'] ?? cp.frequency ?? 1;
        }

        if (totalDailyFreq > 0 && remaining > 0 && remaining % totalDailyFreq !== 0) {
          toast({
            variant: "destructive",
            description: `Remaining meals (${remaining}) for ${pkg?.name || 'package'} must be a multiple of daily frequency (${totalDailyFreq} pack(s)/day)`
          });
          return;
        }
      }

      await dbUpd('customers', c.id, {
        name: editName, phone: editPhone,
        package_id: editPkg ? Number(editPkg) : null,
        payment_mode: editMode
      });
      const walkin = walkins.find(w => w.phone === c.phone || w.phone === editPhone);
      if (walkin) await dbUpd('walkins', walkin.id, { name: editName, phone: editPhone });
      
      let totalPriceDiff = 0;
      for (const cp of cps) {
        const pkg = packages.find(p => p.id === cp.package_id);
        const perMeal = pkg ? (pkg.price / (pkg.meals_count || 10)) : 0;
        const origPrice = pkg ? Math.round(cp.total * perMeal) : 0;
        const editedPrice = editPricesByCp[cp.id] ?? origPrice;
        totalPriceDiff += (editedPrice - origPrice);

        const updates: Record<string, unknown> = {};
        if (editTotalsByCp[cp.id] !== undefined) updates.total = editTotalsByCp[cp.id];
        if (editInstructions[cp.id] !== undefined) updates.instruction = editInstructions[cp.id];
        
        const curMode = editScheduleModesByCp[cp.id] ?? getScheduleMode(cp);
        updates.schedule_mode = curMode;

        const pkgSaladOptions = getPackageSaladOptions(pkg);
        const editStartSalad = editStartSaladKeysByCp[cp.id] || (pkgSaladOptions.length > 0 ? `${pkgSaladOptions[0].id}:${pkgSaladOptions[0].option}` : undefined);
        if (editStartSalad) {
          updates.start_salad_key = editStartSalad;
        }

        const saladFreqs = editSaladFrequenciesByCp[cp.id];
        if (saladFreqs !== undefined) {
          updates.salad_frequencies = saladFreqs;
          const values = Object.values(saladFreqs);
          if (values.length > 0) {
            updates.frequency = Math.max(...values);
          }
        }

        const saladScheds = editSaladSchedulesByCp[cp.id] !== undefined ? editSaladSchedulesByCp[cp.id] : (cp.salad_schedules || {});
        const updatedScheds = { ...saladScheds, schedule_mode: curMode, ...(editStartSalad ? { start_salad_key: editStartSalad } : {}) };
        updates.salad_schedules = updatedScheds;
        
        const pkgSaladKeys = pkgSaladOptions.map(opt => `${opt.id}:${opt.option}`);
        updates.preferred_days = pkgSaladKeys.length > 0
          ? getUnionOfSchedules(updatedScheds, pkgSaladKeys)
          : (editSaladDaysByCp[cp.id] || []);

        if (Object.keys(updates).length > 0) {
          await dbUpd('customer_packages', cp.id, updates);
        }
      }

      let finMsg = "";
      if (totalPriceDiff > 0) {
        finMsg = `Collect ₹${totalPriceDiff} from customer`;
      } else if (totalPriceDiff < 0) {
        finMsg = `Refund ₹${Math.abs(totalPriceDiff)} to customer`;
      }

      await logActivity(c.id, 'edit', `Info updated: name=${editName}, phone=${editPhone}, mode=${editMode}${finMsg ? ` | ${finMsg}` : ''}`);
      toast({ title: "Customer updated", description: finMsg || undefined });
      setEditModal({ open: false, customer: null });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── History ──────────────────────────────────────────────────────────────
  const openHistory = async (c: any) => {
    setHistoryModal({ open: true, customer: c });
    setHistoryLoading(true);
    const cp = getSelectedCp(c);
    const logs = await getActivityLogs(c.id);
    // Filter to selected package's timeframe (from pack_start_date)
    const cutoff = cp?.pack_start_date ? new Date(cp.pack_start_date + 'T00:00:00').getTime() : 0;
    const filtered = cutoff > 0 ? logs.filter(l => new Date(l.created_at).getTime() >= cutoff) : logs;
    setHistoryLogs(filtered);
    setHistoryLoading(false);
  };

  // ─── Instructions ─────────────────────────────────────────────────────────
  const openInstr = (c: any) => {
    const cps = getCustPacks(c.id).filter(cp => cp.status === 'active');
    const edits: Record<number, string> = {};
    cps.forEach(cp => { edits[cp.id] = cp.instruction || ''; });
    setInstrEdits(edits);
    setInstrModal({ open: true, customer: c });
  };

  const saveInstr = async () => {
    try {
      for (const [cpId, instr] of Object.entries(instrEdits)) {
        await dbUpd('customer_packages', Number(cpId), { instruction: instr });
      }
      toast({ title: "Instructions saved" });
      setInstrModal({ open: false, customer: null });
      refresh();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  // ─── Week helpers ──────────────────────────────────────────────────────────
  const getWeekDays = (offset: number) => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday + offset * 7);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: d,
        iso: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d),
        dayStr: DAYS[i][0],
        dateStr: d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' })
      };
    });
  };

  const renderPackageOption = (p: Package) => {
    const selected = addPkgIds.includes(p.id);
    const pkgSaladOptions = getPackageSaladOptions(p);
    return (
      <div
        key={p.id}
        className={cn(
          "rounded-2xl border-2 transition-all p-3 space-y-3 bg-card",
          selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
        )}
      >
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setAddPkgIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
        >
          <div>
            <div className={cn("font-bold text-sm", selected && 'text-primary')}>{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.meals_count ?? 10} meals</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("font-bold text-sm", selected ? 'text-primary' : 'text-muted-foreground')}>₹{p.price}</span>
            <div className={cn(
              "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
            )}>
              {selected && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </div>
        </div>

        {selected && (
          <div className="pt-3 border-t border-dashed border-border/80 space-y-3 animate-in fade-in duration-200">
            {/* Frequency Selector */}
            <div className="flex items-center gap-1.5 p-2.5 bg-muted/30 rounded-xl">
              <Label className="text-xs font-semibold">Frequency (Qty/Day):</Label>
              <Input
                type="number"
                min="1"
                value={addPkgFrequencies[p.id] || 1}
                onChange={e => {
                  const val = Math.max(1, Number(e.target.value) || 1);
                  setAddPkgFrequencies(prev => ({ ...prev, [p.id]: val }));
                }}
                className="w-16 h-8 text-center bg-background"
              />
            </div>

            {/* Schedule Option selector for Combo or multi-salad packages */}
            {(p.package_type === 'combo' || pkgSaladOptions.length > 1) && (
              <div className="space-y-2 p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Schedule Option</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddPkgScheduleModes(prev => ({ ...prev, [p.id]: 'set_schedule' }))}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                      (addPkgScheduleModes[p.id] || 'set_schedule') === 'set_schedule'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                    )}
                  >
                    📅 Set Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddPkgScheduleModes(prev => ({ ...prev, [p.id]: 'default' }))}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                      addPkgScheduleModes[p.id] === 'default'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                    )}
                  >
                    🔄 Default (Rotating)
                  </button>
                </div>
                {addPkgScheduleModes[p.id] === 'default' && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                      Subscriber receives a different salad on each delivery day in sequence ({pkgSaladOptions.map(opt => {
                        const item = menuItems.find(mi => mi.id === opt.id);
                        return item ? item.name : `Salad ${opt.id}`;
                      }).join(' → ')}).
                    </div>
                    {pkgSaladOptions.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <Label className="text-[11px] font-bold text-blue-900 dark:text-blue-300">Start Rotation With:</Label>
                        <Select
                          value={addPkgStartSaladKeys[p.id] || `${pkgSaladOptions[0].id}:${pkgSaladOptions[0].option}`}
                          onValueChange={val => setAddPkgStartSaladKeys(prev => ({ ...prev, [p.id]: val }))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background border-blue-200 dark:border-blue-800">
                            <SelectValue placeholder="Select starting salad" />
                          </SelectTrigger>
                          <SelectContent>
                            {pkgSaladOptions.map((opt: any) => {
                              const item = menuItems.find(mi => mi.id === opt.id);
                              const key = `${opt.id}:${opt.option}`;
                              const label = opt.option && opt.option.toLowerCase() !== 'regular'
                                ? `${item?.name || `Salad ${opt.id}`} – ${opt.option}`
                                : (item?.name || `Salad ${opt.id}`);
                              return (
                                <SelectItem key={key} value={key} className="text-xs">
                                  🥗 {label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Display Associated Salads with Individual schedules */}
            {pkgSaladOptions.length > 0 ? (
              addPkgScheduleModes[p.id] === 'default' ? null : (
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Associated Salads (Delivery Schedules)</div>
                  {pkgSaladOptions.map((opt: any, optIdx: number) => {
                    const item = menuItems.find(mi => mi.id === opt.id);
                    if (!item) return null;
                    const saladKey = `${opt.id}:${opt.option}`;
                    const saladDays = (addSaladSchedules[p.id] || {})[saladKey] || [];
                    const label = opt.option && opt.option.toLowerCase() !== 'regular'
                      ? `${item.name} – ${opt.option}`
                      : item.name;
                    return (
                      <div key={`${p.id}-${saladKey}-${optIdx}`} className="space-y-1.5 p-2.5 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
                          <span>🥗 {label}</span>
                        </div>
                        <div className="flex gap-1">
                          {DAYS.map((day, idx) => {
                            const isDaySelected = saladDays.length === 0 || saladDays.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleSaladScheduleDay(p.id, saladKey, idx)}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                                  isDaySelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 bg-background'
                                )}
                              >
                                {day[0]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {saladDays.length === 0
                            ? 'All days (Mon–Sat) — tap a day to exclude it'
                            : `${saladDays.length} day(s) selected`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Fallback to package-level Salad Days picker if no associated salads */
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Salad Days (Delivery Schedule)</Label>
                <div className="flex gap-1">
                  {DAYS.map((day, idx) => {
                    const pkgSaladDays = addCustomSaladDays[p.id] || [];
                    const isDaySelected = pkgSaladDays.length === 0 || pkgSaladDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAddCustomSaladDays(prev => {
                            const current = prev[p.id] || [];
                            let next: number[];
                            if (current.length === 0) {
                              next = [0, 1, 2, 3, 4, 5].filter(d => d !== idx);
                            } else if (current.includes(idx)) {
                              next = current.filter(d => d !== idx);
                            } else {
                              next = [...current, idx].sort();
                            }
                            if (next.length === 6) next = [];
                            return { ...prev, [p.id]: next };
                          });
                        }}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                          isDaySelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        {day[0]}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {(addCustomSaladDays[p.id] || []).length === 0
                    ? 'All days (Mon–Sat) — tap a day to exclude it'
                    : `${(addCustomSaladDays[p.id] || []).length} day(s) selected`}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Special Instructions</Label>
              <Input
                placeholder="e.g. No onions, extra sprouts..."
                value={addInstructions[p.id] || ''}
                onChange={e => setAddInstructions(prev => ({ ...prev, [p.id]: e.target.value }))}
                className="h-9 rounded-lg text-xs"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCustomizePackageOption = (p: Package) => {
    const selected = customPkgIds.includes(p.id);
    const freq = customPkgFrequencies[p.id] || 1;
    return (
      <div
        key={p.id}
        className={cn(
          "rounded-2xl border-2 transition-all p-3 space-y-3 bg-card",
          selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
        )}
      >
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setCustomPkgIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
        >
          <div>
            <div className={cn("font-bold text-sm", selected && 'text-primary')}>{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.meals_count ?? 10} meals</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("font-bold text-sm", selected ? 'text-primary' : 'text-muted-foreground')}>₹{p.price}</span>
            <div className={cn(
              "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
            )}>
              {selected && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </div>
        </div>

        {selected && (
          <div className="pt-2 border-t border-dashed border-border/80 flex items-center gap-1.5 animate-in fade-in duration-200">
            <Label className="text-xs font-semibold">Frequency (Qty/Day):</Label>
            <Input
              type="number"
              min="1"
              value={freq}
              onChange={e => {
                const val = Math.max(1, Number(e.target.value) || 1);
                setCustomPkgFrequencies(prev => ({ ...prev, [p.id]: val }));
              }}
              className="w-16 h-8 text-center"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  };

  const filters = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "hold", label: "On Hold" },
    { id: "low", label: "Low" },
    { id: "done", label: "Done" },
    { id: "new", label: "New" },
    { id: "renewed", label: "Renewed" }
  ];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-8">
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-bold">Subscribed</h2>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            onClick={() => {
              setAddModal(true); setAddQrOpen(false); setAddName(""); setAddPhone("");
              setAddPkgIds([]); setAddPayMode("cash"); setAddCash(""); setAddInstructions({});
              setAddType("existing"); setAddCustomSaladDays({});
              setCustomPkgIds([]); setCustomPkgFrequencies({}); setAddPkgFrequencies({}); setCustomSaladSchedules({}); setCustomMealsCount("10");
              setCustomPrice(""); setCustomPayMode("cash"); setCustomIsActive(true);
            }}
            className="rounded-full shadow-md font-bold px-4 h-9 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/sub-reports?tab=prep")}
            className="rounded-full shadow-sm font-bold border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5 h-8 text-[11px] px-3 cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" /> Prep for tomorrow ({tomorrowCount})
          </Button>
        </div>
      </div>

      <div className="bg-muted p-1.5 rounded-2xl flex overflow-x-auto hide-scrollbar shadow-inner border border-border">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex-1 min-w-[60px] px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200",
              filter === f.id
                ? "bg-white dark:bg-card text-primary shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {filteredSubs.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground bg-muted/30 rounded-3xl border border-dashed">
            No subscribers match this filter.
          </div>
        ) : (
          filteredSubs.map(c => {
            const custPacks = getCustPacks(c.id);
            const { cp, used, total, packageId } = getDisplayData(c);
            const isCpOnHold = (cp ? cp.status : c.status) === 'hold';
            const pkg = packages.find(p => p.id === packageId);
            const isDone = used >= total;
            const isLow = (total - used) <= 2 && !isDone;
            const progressPercent = total > 0 ? (used / total) * 100 : 0;
            const isWalkin = walkins.some(w => w.phone === c.phone);
            const offset = weekOffset[c.id] || 0;
            const weekDays = getWeekDays(offset);

            return (
              <Card key={c.id} className={cn("border border-border shadow-sm overflow-hidden transition-all duration-200", c.status === 'cancelled' ? 'opacity-60' : 'hover:shadow-md')}>
                <div className={cn("h-1.5 w-full", isDone ? 'bg-gray-400' : isLow ? 'bg-secondary' : 'bg-primary')} />

                <CardContent className="p-5 flex flex-col gap-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/subscriber/${c.id}`} className="font-bold font-serif text-xl leading-tight hover:underline hover:text-primary cursor-pointer transition-colors block">
                        {c.name}
                      </Link>
                      <div className="text-sm font-medium text-muted-foreground mt-0.5">{c.phone}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {/* Package selector / label */}
                      {(() => {
                        const activePacks = custPacks.filter(cp => cp.total - cp.used > 0);
                        if (activePacks.length > 0) {
                          return (
                            <Select
                              value={(selectedCpId[c.id] || activePacks[0]?.id)?.toString()}
                              onValueChange={v => setSelectedCpId(p => ({ ...p, [c.id]: Number(v) }))}
                            >
                              <SelectTrigger className="h-7 text-xs border-primary/20 text-primary w-auto min-w-[100px] max-w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activePacks.map(xcp => {
                                  const xpkg = packages.find(p => p.id === xcp.package_id);
                                  return (
                                    <SelectItem key={xcp.id} value={xcp.id.toString()}>
                                      {xpkg?.name || 'Pack'} ({xcp.total - xcp.used} left)
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          );
                        } else if (pkg) {
                          return (
                            <div className="text-[11px] font-semibold text-primary/80 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                              {pkg.name}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Meals left badge */}
                      {c.status === 'cancelled' ? (
                        <Badge variant="destructive" className="font-bold">Cancelled</Badge>
                      ) : (cp ? cp.status : c.status) === 'hold' ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold animate-pulse">On Hold</Badge>
                      ) : isDone ? (
                        <Badge className="bg-gray-200 text-gray-700 font-bold">Pack Done</Badge>
                      ) : isLow ? (
                        <Badge className="bg-secondary text-secondary-foreground font-bold">Low: {total - used} left</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary font-bold border-primary/20">{total - used} left</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isWalkin && <Badge variant="secondary" className="text-[11px] rounded-lg">Walk-in</Badge>}
                    {c.renew_count === 0 ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] rounded-lg">New User</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] rounded-lg">Renewed ×{c.renew_count}</Badge>
                    )}
                    {custPacks.length > 1 && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] rounded-lg">{custPacks.length} packs</Badge>
                    )}
                    <Badge variant="outline" className="text-[11px] rounded-lg uppercase">{c.payment_mode}</Badge>
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-xl border border-border">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Meals Used</span>
                      <span className="text-foreground">{used} / {total}</span>
                    </div>
                    <Progress value={progressPercent} className={cn("h-3 bg-muted", isDone ? '[&>div]:bg-gray-400' : isLow ? '[&>div]:bg-secondary' : '[&>div]:bg-primary')} />
                  </div>

                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex justify-between items-center px-3 py-2 bg-muted/30 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</div>
                        {getScheduleMode(cp) === 'default' && (
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/60">
                            🔄 Default (Rotating)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 bg-background rounded-lg border border-border">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setWeekOffset(p => ({ ...p, [c.id]: offset - 1 }))}>
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <span className="text-[10px] font-bold w-12 text-center">{offset === 0 ? 'This Wk' : offset > 0 ? `+${offset} Wk` : `${offset} Wk`}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setWeekOffset(p => ({ ...p, [c.id]: offset + 1 }))}>
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex p-2 gap-1.5 bg-muted/10">
                      {weekDays.map((d, i) => {
                        const cpPrefDays = cp?.preferred_days;
                        const effectivePrefDays = (cpPrefDays !== undefined && cpPrefDays !== null) ? cpPrefDays : (c.preferred_days || []);
                        const isScheduled = effectivePrefDays.length === 0 || effectivePrefDays.includes(i);
                        const skip = mealSkips.find(s =>
                          Number(s.customer_id) === c.id &&
                          s.skip_date === d.iso &&
                          !s.unskipped &&
                          (s.customer_package_id == null || s.customer_package_id === cp?.id)
                        );
                        const isSkipped = !!skip;
                        const isToday = d.iso === getISTISODate();
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              if (isSkipped && skip) {
                                handleUnskip(skip.id, c.id);
                              } else {
                                handleTogglePrefDay(c, i, cp);
                              }
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center flex-1 py-2 rounded-lg cursor-pointer border-2 transition-all duration-200",
                              isSkipped ? 'bg-orange-50 border-orange-200 text-orange-800' :
                                isScheduled ? 'bg-primary border-primary text-primary-foreground shadow-md' :
                                  'bg-card border-transparent text-muted-foreground hover:border-border',
                              isToday && !isSkipped ? 'ring-2 ring-primary/30 ring-offset-1' : ''
                            )}
                            title={isSkipped ? 'Tap to remove skip' : isScheduled ? 'Tap to skip this day' : 'Tap to schedule this day'}
                          >
                            <div className="text-[11px] font-bold">{d.dayStr}</div>
                            <div className={cn("text-[10px] mt-0.5 font-medium", isScheduled ? 'opacity-90' : 'opacity-60')}>{d.dateStr.split('/')[0]}</div>
                            {isSkipped && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1" />}
                          </div>
                        );
                      })}
                    </div>
                    {getScheduleMode(cp) === 'default' && (
                      <div className="px-3 pb-2 text-[10px] text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
                        <span>🔄 Rotating Sequence: Next delivery → </span>
                        <strong className="text-foreground font-bold">
                          {(() => {
                            const xpkg = packages.find(p => p.id === cp?.package_id);
                            const opts = getPackageSaladOptions(xpkg);
                            if (opts.length === 0) return 'Salad';
                            const freq = cp?.frequency || 1;
                            const startSaladKey = getStartingSaladKey(cp);
                            let startIdx = 0;
                            if (startSaladKey) {
                              const foundIdx = opts.findIndex((opt: any) => `${opt.id}:${opt.option}` === startSaladKey);
                              if (foundIdx >= 0) startIdx = foundIdx;
                            }
                            const rotatedIdx = (Math.floor((cp?.used || 0) / freq) + startIdx) % opts.length;
                            const opt = opts[rotatedIdx];
                            const item = menuItems.find(mi => mi.id === opt.id);
                            return item ? `${item.name}${opt.option && opt.option.toLowerCase() !== 'regular' ? ` – ${opt.option}` : ''}` : 'Salad';
                          })()}
                        </strong>
                      </div>
                    )}
                    {mealSkips.some(s => Number(s.customer_id) === c.id && !s.unskipped) && (
                      <div className="px-3 pb-2 text-[10px] text-orange-600 font-medium">
                        Tap orange day to remove skip
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex gap-3">
                      {!isDone && c.status !== 'cancelled' && (
                        <div className="flex bg-muted/20 border border-border rounded-xl overflow-hidden h-14 w-20">
                          <input
                            type="number"
                            min="1"
                            max={total - used}
                            value={useMealQty[c.id] !== undefined ? useMealQty[c.id] : 1}
                            onChange={e => {
                              const rawVal = e.target.value;
                              if (rawVal === '') {
                                setUseMealQty(p => ({ ...p, [c.id]: '' }));
                                return;
                              }
                              let val = parseInt(rawVal);
                              if (!isNaN(val)) {
                                if (val > (total - used)) val = total - used;
                                setUseMealQty(p => ({ ...p, [c.id]: val }));
                              }
                            }}
                            className="w-full text-center bg-transparent font-bold text-lg outline-none"
                          />
                        </div>
                      )}
                      <Button
                        onClick={() => {
                          const rawVal = useMealQty[c.id];
                          const qty = typeof rawVal === 'number' ? rawVal : parseInt(rawVal as string);
                          const finalQty = isNaN(qty) || qty < 1 ? 1 : qty;
                          handleUseMeal(c, cp, finalQty);
                        }}
                        disabled={isDone || c.status === 'cancelled' || isCpOnHold}
                        className="flex-1 h-14 rounded-xl shadow-md font-bold text-lg"
                      >
                        <Check className="w-5 h-5 mr-2" /> Mark Used
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleUndo(c, cp)}
                        disabled={used === 0 || c.status === 'cancelled' || isCpOnHold}
                        className="w-14 h-14 rounded-xl border-border bg-card hover:bg-muted"
                      >
                        <Undo2 className="w-5 h-5" />
                      </Button>
                    </div>

                    {isDone && (
                      <Button
                        onClick={() => handleRenew(c, cp)}
                        disabled={c.status === 'cancelled' || isCpOnHold}
                        className="w-full h-10 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold"
                      >
                        <RefreshCw className="w-4 h-4 mr-1.5" /> Renew
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openInstr(c)}
                        className="w-10 h-10 rounded-lg p-0 border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
                        title="Instructions"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setNotifyModal({ open: true, customer: c, type: isDone ? 'done' : isLow ? 'low' : 'meal', cp })}
                        disabled={c.status === 'cancelled' || isCpOnHold}
                        className="w-10 h-10 rounded-lg p-0 border-primary/20 text-primary hover:bg-primary/5"
                        title="Notify"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => { setSkipModal({ open: true, customer: c, cp }); setSkipDate(getISTISODate()); }}
                        disabled={isDone || c.status === 'cancelled' || isCpOnHold}
                        className="w-10 h-10 rounded-lg p-0 border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
                        title="Skip Meal"
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>

                      <Button variant="outline" className="w-10 h-10 rounded-lg p-0" onClick={() => openHistory(c)} title="History">
                        <History className="w-4 h-4" />
                      </Button>

                      <Button variant="outline" className="w-10 h-10 rounded-lg p-0" onClick={() => openEdit(c)} title="Edit">
                        <Edit className="w-4 h-4" />
                      </Button>

                      {c.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          onClick={() => handleToggleHold(c, cp)}
                          className={cn(
                            "w-10 h-10 rounded-lg p-0",
                            isCpOnHold
                              ? "border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:border-amber-900/50 dark:text-amber-300 dark:bg-amber-950/40"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                          title={isCpOnHold ? "Unhold Package" : "Hold Package"}
                        >
                          {isCpOnHold ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </Button>
                      )}

                      {c.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          className="w-10 h-10 rounded-lg p-0 border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
                          onClick={() => handleCancel(c, cp)}
                          title="Cancel Subscription"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        className="w-10 h-10 rounded-lg p-0 border-red-300 text-red-700 bg-red-100 hover:bg-red-200"
                        onClick={() => handleDelete(c)}
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ─── Add Customer Modal ─────────────────────────────────────────────── */}
      <Dialog open={addModal} onOpenChange={v => { setAddModal(v); if (!v) { setAddQrOpen(false); setIsRenewalMode(false); setAddType("existing"); setAddCustomSaladDays({}); setCustomPkgIds([]); setCustomPkgFrequencies({}); setAddPkgFrequencies({}); setCustomSaladSchedules({}); setCustomMealsCount("10"); setCustomPrice(""); setCustomPayMode("cash"); setCustomIsActive(true); } }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">
              {isRenewalMode ? `Renew — ${addName}` : 'Add Subscriber'}
            </DialogTitle>
          </DialogHeader>
          {addQrOpen ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl font-black text-primary">₹{upiTotal}</div>
              <div className="p-3 bg-white rounded-2xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(addUpiUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <a href={addUpiUrl} className="flex items-center gap-2 text-sm font-bold text-blue-600 underline underline-offset-2">
                <CreditCard className="w-4 h-4" /> Open in UPI App
              </a>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 h-12 rounded-xl font-bold" onClick={handleAddCustomer}>Payment Done</Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setAddQrOpen(false)}>Back</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input placeholder="Enter name" value={addName} onChange={e => setAddName(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input type="tel" placeholder="10-digit number" value={addPhone} onChange={e => setAddPhone(e.target.value)} className="h-12 rounded-xl font-mono" />
                </div>

                <div className="space-y-2">
                  <Label>Subscription Option</Label>
                  <div className="flex bg-muted/60 p-1 rounded-xl w-full border border-border/80">
                    <button
                      type="button"
                      onClick={() => setAddType('existing')}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                        addType === 'existing'
                          ? "bg-white dark:bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddType('customize')}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                        addType === 'customize'
                          ? "bg-white dark:bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Customize
                    </button>
                  </div>
                </div>

                {addType === 'existing' ? (
                  <div className="space-y-2">
                    <Label>Package(s) — tap to select one or more</Label>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                      {/* Individual Packages */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Individual Packages</div>
                        {activePackages.filter(p => !p.package_type || p.package_type === 'individual').length === 0 ? (
                          <div className="text-xs text-muted-foreground italic pl-2">No individual packages found.</div>
                        ) : (
                          activePackages.filter(p => !p.package_type || p.package_type === 'individual').map(p => renderPackageOption(p))
                        )}
                      </div>

                      {/* Combo Packages */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Combo Packages</div>
                        {activePackages.filter(p => p.package_type === 'combo').length === 0 ? (
                          <div className="text-xs text-muted-foreground italic pl-2">No combo packages found.</div>
                        ) : (
                          activePackages.filter(p => p.package_type === 'combo').map(p => renderPackageOption(p))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="space-y-2">
                      <Label>Package(s) to Customize — select one or more</Label>
                      <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                        {/* Individual Packages */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Individual Packages</div>
                          {activePackages.filter(p => !p.package_type || p.package_type === 'individual').length === 0 ? (
                            <div className="text-xs text-muted-foreground italic pl-2">No individual packages found.</div>
                          ) : (
                            activePackages.filter(p => !p.package_type || p.package_type === 'individual').map(p => renderCustomizePackageOption(p))
                          )}
                        </div>

                        {/* Combo Packages */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Combo Packages</div>
                          {activePackages.filter(p => p.package_type === 'combo').length === 0 ? (
                            <div className="text-xs text-muted-foreground italic pl-2">No combo packages found.</div>
                          ) : (
                            activePackages.filter(p => p.package_type === 'combo').map(p => renderCustomizePackageOption(p))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Configure Salad delivery schedules for custom selected packages */}
                    {customSaladKeys.length > 0 && (
                      <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Configure Salad Delivery Schedules</Label>
                        {customSaladKeys.length > 1 && (
                          <div className="space-y-2 p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <div className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Schedule Option</div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setCustomScheduleMode('set_schedule')}
                                className={cn(
                                  "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                                  customScheduleMode === 'set_schedule'
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                                )}
                              >
                                📅 Set Schedule
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomScheduleMode('default')}
                                className={cn(
                                  "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                                  customScheduleMode === 'default'
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                                )}
                              >
                                🔄 Default (Rotating)
                              </button>
                            </div>
                            {customScheduleMode === 'default' && (
                              <div className="space-y-1.5 pt-0.5">
                                <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                                  Subscriber receives a different salad on each delivery day in sequence.
                                </div>
                                {customSaladKeys.length > 0 && (
                                  <div className="space-y-1 pt-1">
                                    <Label className="text-[11px] font-bold text-blue-900 dark:text-blue-300">Start Rotation With:</Label>
                                    <Select
                                      value={customStartSaladKey || customSaladKeys[0]}
                                      onValueChange={val => setCustomStartSaladKey(val)}
                                    >
                                      <SelectTrigger className="h-8 text-xs bg-background border-blue-200 dark:border-blue-800">
                                        <SelectValue placeholder="Select starting salad" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {customSaladKeys.map(key => {
                                          const sv = saladVariants.find(x => `${x.id}:${x.option}` === key || `${x.id}:Regular` === key);
                                          const name = sv ? sv.name : `Salad ${key.split(':')[0]}`;
                                          return (
                                            <SelectItem key={key} value={key} className="text-xs">
                                              🥗 {name}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {customScheduleMode !== 'default' && (
                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {customSaladKeys.map(key => {
                              const sv = saladVariants.find(x => `${x.id}:${x.option}` === key || `${x.id}:Regular` === key);
                              const name = sv ? sv.name : `Salad ${key.split(':')[0]}`;
                              const saladDays = customSaladSchedules[key] || [];
                              return (
                                <div key={key} className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 space-y-2">
                                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400">🥗 {name}</div>
                                  <div className="flex gap-1">
                                    {DAYS.map((day, idx) => {
                                      const isDaySelected = saladDays.length === 0 || saladDays.includes(idx);
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => toggleCustomSaladScheduleDay(key, idx)}
                                          className={cn(
                                            "flex-1 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                                            isDaySelected
                                              ? 'bg-emerald-600 border-emerald-600 text-white'
                                              : 'border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 bg-background'
                                          )}
                                          style={{ minWidth: 0 }}
                                        >
                                          {day[0]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    {saladDays.length === 0
                                      ? 'All days (Mon–Sat) — tap a day to exclude it'
                                      : `${saladDays.length} day(s) selected`}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Number of Meals</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 10"
                          value={customMealsCount}
                          onChange={e => setCustomMealsCount(e.target.value.replace(/[^0-9]/g, ''))}
                          className={cn("h-12 rounded-xl", isCustomMealsInvalid && "border-destructive focus-visible:ring-destructive")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Price</Label>
                        <Input
                          type="number"
                          placeholder="₹"
                          value={customPrice}
                          onChange={e => setCustomPrice(e.target.value)}
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </div>

                    {addType === 'customize' && customPkgIds.length > 0 && totalCustomDailyFreq > 0 && (
                      <div className="text-xs -mt-2">
                        {isCustomMealsInvalid ? (
                          <div className="text-destructive font-semibold flex items-center gap-1.5 p-2.5 bg-destructive/10 rounded-xl border border-destructive/20 animate-in fade-in duration-200">
                            <span>⚠️ Total meals must be a multiple of {totalCustomDailyFreq} (e.g. {totalCustomDailyFreq}, {totalCustomDailyFreq * 2}, {totalCustomDailyFreq * 3}, {totalCustomDailyFreq * 4}...)</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground flex items-center justify-between p-2.5 bg-muted/30 rounded-xl animate-in fade-in duration-200">
                            <span>Daily frequency: <strong className="text-foreground">{totalCustomDailyFreq} pack(s)/day</strong></span>
                            {customMealsCountNum > 0 && (
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">Duration: {customMealsCountNum / totalCustomDailyFreq} days</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <PaymentModeSelect
                        value={customPayMode}
                        onChange={(val) => setCustomPayMode(val as any)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-muted/20">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold cursor-pointer" htmlFor="custom-active-toggle">Active Subscription</Label>
                        <div className="text-xs text-muted-foreground">Mark subscription as active immediately</div>
                      </div>
                      <Switch
                        id="custom-active-toggle"
                        checked={customIsActive}
                        onCheckedChange={setCustomIsActive}
                      />
                    </div>
                  </div>
                )}

                {addType === 'customize' && customSaladKeys.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm flex justify-between">
                    <span>Custom Subscription — {customMealsCount} meals total</span>
                    <span className="font-bold text-primary">₹{addTotal}</span>
                  </div>
                )}

                {addType === 'existing' && selectedAddPkgs.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm flex justify-between">
                    <span>{selectedAddPkgs.length} pack{selectedAddPkgs.length > 1 ? 's' : ''} — {selectedAddPkgs.reduce((s, p) => s + (p.meals_count ?? 10), 0)} meals total</span>
                    <span className="font-bold text-primary">₹{addTotal}</span>
                  </div>
                )}

                {addType === 'existing' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <PaymentModeSelect value={addPayMode} onChange={setAddPayMode} />
                    </div>
                    {addPayMode === 'cash' && addTotal > 0 && (
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                        <Label className="text-amber-900 font-bold text-xs">Cash Received</Label>
                        <Input type="number" placeholder="₹" value={addCash} onChange={e => setAddCash(e.target.value)} className="bg-white border-amber-300 h-11" />
                        {addCash !== "" && (
                          <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${addChange >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                            <span>{addChange >= 0 ? 'Change:' : 'Short:'}</span>
                            <span>₹{Math.abs(addChange)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {addPayMode === 'upi' && addTotal > 0 && (
                      <a href={addUpiUrl} className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors">
                        <CreditCard className="w-4 h-4" /> Open UPI App — ₹{addTotal}
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    {cashTotal > 0 && (
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                        <Label className="text-amber-900 font-bold text-xs">Cash Received (Total Cash: ₹{cashTotal})</Label>
                        <Input type="number" placeholder="₹" value={addCash} onChange={e => setAddCash(e.target.value)} className="bg-white border-amber-300 h-11" />
                        {addCash !== "" && (
                          <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${addChange >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                            <span>{addChange >= 0 ? 'Change:' : 'Short:'}</span>
                            <span>₹{Math.abs(addChange)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {upiTotal > 0 && (
                      <a href={addUpiUrl} className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors">
                        <CreditCard className="w-4 h-4" /> Open UPI App — ₹{upiTotal}
                      </a>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleAddCustomer} className="w-full h-14 text-lg rounded-xl font-bold">
                  {hasScanPay ? 'Show QR & Activate' : 'Activate Subscription'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Notify Modal ───────────────────────────────────────────────────── */}
      <Dialog open={notifyModal.open} onOpenChange={o => !o && setNotifyModal({ ...notifyModal, open: false })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Send Notification</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-muted-foreground">Choose a message template for <span className="font-bold text-foreground">{notifyModal.customer?.name}</span>:</p>
            {['meal', 'low', 'done'].map(type => (
              <button
                key={type}
                onClick={() => setNotifyModal(prev => ({ ...prev, type }))}
                className={cn(
                  "w-full text-left p-3 rounded-xl border-2 transition-all",
                  notifyModal.type === type ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="font-bold text-sm capitalize">
                  {type === 'meal' ? 'Meal Update' : type === 'low' ? 'Renew Pack (Low)' : 'Pack Done'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {type === 'meal' ? `Update on meals used` :
                    type === 'low' ? 'Urge renewal — meals running low' :
                      'Pack complete — request renewal'}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={sendWhatsApp} className="w-full h-14 text-lg rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold">
              <MessageCircle className="w-5 h-5 mr-2" /> Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Meal Used WhatsApp Prompt ───────────────────────────────────────── */}
      <Dialog open={mealUsedModal.open} onOpenChange={o => !o && setMealUsedModal({ open: false, customer: null, used: 0, total: 0, pkgName: '', qty: 1 })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Meal Marked Used ✓</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-2">
            <div className="text-4xl font-black text-primary">{mealUsedModal.used} / {mealUsedModal.total}</div>
            {mealUsedModal.pkgName && <div className="text-xs text-muted-foreground">{mealUsedModal.pkgName}</div>}
            <div className="text-sm text-muted-foreground">Send a meal update to {mealUsedModal.customer?.name}?</div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button
              onClick={() => handleSendMealUpdate(mealUsedModal.customer, mealUsedModal.used, mealUsedModal.total - mealUsedModal.used, mealUsedModal.total, mealUsedModal.pkgName, mealUsedModal.qty)}
              className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold"
            >
              <MessageCircle className="w-5 h-5 mr-2" /> Send WhatsApp Update
            </Button>
            <Button variant="outline" onClick={() => setMealUsedModal({ open: false, customer: null, used: 0, total: 0, pkgName: '', qty: 1 })} className="w-full h-12 rounded-xl">
              Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Skip Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={skipModal.open} onOpenChange={o => { if (!o) { setSkipModal({ open: false, customer: null, cp: null }); setSkipMode('single'); setSkipMultiDates([]); } }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Skip Meal — {skipModal.customer?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4">
            {skipModal.cp && (() => {
              const pkg = packages.find(p => p.id === skipModal.cp!.package_id);
              return pkg ? (
                <div className="p-3 bg-primary/5 rounded-xl text-sm font-semibold text-primary border border-primary/20">
                  📦 Package: {pkg.name}
                </div>
              ) : null;
            })()}

            {/* Mode selector */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              {([
                { key: 'single', label: 'Single Date' },
                { key: 'range', label: 'Range' },
                { key: 'multi', label: 'Multiple' },
              ] as const).map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSkipMode(m.key)}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold transition-all",
                    skipMode === m.key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Single date */}
            {skipMode === 'single' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Date</Label>
                <Input type="date" value={skipDate} onChange={e => setSkipDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            {/* Range */}
            {skipMode === 'range' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">From</Label>
                    <Input type="date" value={skipRangeStart} onChange={e => setSkipRangeStart(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">To</Label>
                    <Input type="date" value={skipRangeEnd} onChange={e => setSkipRangeEnd(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                </div>
                {skipRangeStart && skipRangeEnd && skipRangeStart <= skipRangeEnd && (
                  <div className="text-xs text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20">
                    {(() => {
                      let count = 0;
                      let d = new Date(skipRangeStart + 'T00:00:00');
                      const end = new Date(skipRangeEnd + 'T00:00:00');
                      while (d <= end) { count++; d.setDate(d.getDate() + 1); }
                      return `${count} day${count > 1 ? 's' : ''} will be skipped`;
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Multiple dates */}
            {skipMode === 'multi' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={skipAddDate}
                    onChange={e => setSkipAddDate(e.target.value)}
                    className="flex-1 h-11 rounded-xl"
                  />
                  <Button
                    variant="outline"
                    className="h-11 px-4 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => {
                      if (skipAddDate && !skipMultiDates.includes(skipAddDate)) {
                        setSkipMultiDates(prev => [...prev, skipAddDate].sort());
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {skipMultiDates.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {skipMultiDates.map(d => (
                      <div key={d} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-semibold text-orange-800">
                          {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setSkipMultiDates(prev => prev.filter(x => x !== d))}
                          className="text-orange-600 hover:text-orange-800 font-bold text-sm leading-none ml-2"
                        >×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2 bg-muted/20 rounded-lg border border-dashed border-border">
                    Add dates using the picker above
                  </div>
                )}
                {skipMultiDates.length > 0 && (
                  <div className="text-xs text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20">
                    {skipMultiDates.length} date{skipMultiDates.length > 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-orange-50 rounded-xl text-xs text-orange-700 border border-orange-200">
              To remove a skip, tap the orange day in the schedule grid.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSkip} className="w-full h-14 text-lg rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold">
              <MessageCircle className="w-5 h-5 mr-2" /> Confirm Skip & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Modal ───────────────────────────────────────────────────── */}
      <Dialog open={cancelModal.open} onOpenChange={o => !o && setCancelModal({ open: false, customer: null, cp: null })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-red-600">Cancel Subscription</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Cancel subscription for <span className="font-bold text-foreground">{cancelModal.customer?.name}</span>?</p>
            {cancelModal.customer && (() => {
              const { used, total, packageId } = getDisplayData(cancelModal.customer);
              const pkg = packages.find(p => p.id === packageId);
              const pricePerMeal = pkg ? Math.round(pkg.price / (pkg.meals_count ?? 10)) : 0;
              const remaining = total - used;
              const refund = remaining * pricePerMeal;
              return (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="font-bold text-sm text-amber-900">Meal Return Calculation</div>
                  <div className="text-sm text-amber-800 space-y-1">
                    <div>Meals Used: <span className="font-bold">{used}/{total}</span></div>
                    <div>Remaining Meals: <span className="font-bold">{remaining}</span></div>
                    <div>Price per Meal: <span className="font-bold">₹{pricePerMeal}</span></div>
                    <div className="text-base font-black pt-1">Refund Amount: ₹{refund}</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={() => handleConfirmCancel(true)} className="w-full h-12 rounded-xl bg-[#25D366] hover:bg-[#1DA851] text-white font-bold">
              <MessageCircle className="w-5 h-5 mr-2" /> Cancel & Send Refund Details
            </Button>
            <Button variant="outline" onClick={() => handleConfirmCancel(false)} className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50">
              Cancel Without Notification
            </Button>
            <Button variant="ghost" onClick={() => setCancelModal({ open: false, customer: null, cp: null })} className="w-full h-10 rounded-xl">
              Keep Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={editModal.open} onOpenChange={o => !o && setEditModal({ ...editModal, open: false })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Edit Subscriber</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-12 rounded-xl font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Primary Package</Label>
              <Select value={editPkg} onValueChange={setEditPkg}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="font-bold text-xs text-muted-foreground uppercase px-2 py-1">Individual Packages</SelectLabel>
                    {packages.filter(p => p.is_active && (!p.package_type || p.package_type === 'individual')).map(p => (
                      <SelectItem key={p.id} value={p.id.toString()} className="cursor-pointer">{p.name} — {p.meals_count ?? 10} meals — ₹{p.price}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="font-bold text-xs text-muted-foreground uppercase px-2 py-1 border-t border-border mt-1">Combo Packages</SelectLabel>
                    {packages.filter(p => p.is_active && p.package_type === 'combo').map(p => (
                      <SelectItem key={p.id} value={p.id.toString()} className="cursor-pointer">{p.name} — {p.meals_count ?? 10} meals — ₹{p.price}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <RadioGroup value={editMode} onValueChange={setEditMode} className="flex gap-4">
                {['cash', 'upi', 'scanpay'].map(m => (
                  <div key={m} className="flex items-center space-x-2">
                    <input type="radio" id={`em-${m}`} name="editMode" value={m} checked={editMode === m} onChange={() => setEditMode(m)} className="accent-primary" />
                    <Label htmlFor={`em-${m}`} className="capitalize">{m === 'scanpay' ? 'Scan' : m}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {editModal.customer && getCustPacks(editModal.customer.id).filter(cp => cp.total - cp.used > 0).length > 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Per Package Settings</Label>
                {getCustPacks(editModal.customer.id).filter(cp => cp.total - cp.used > 0).map(cp => {
                  const pkg = packages.find(p => p.id === cp.package_id);
                  const used = cp.used;
                  const currentTotal = editTotalsByCp[cp.id] ?? cp.total;
                  const remainingMeals = currentTotal - used;

                  // Calculate total daily frequency for cp
                  const cpSaladFreqs = editSaladFrequenciesByCp[cp.id] || cp.salad_frequencies || {};
                  let totalDailyFreq = 0;
                  const saladOpts = getPackageSaladOptions(pkg);
                  if (saladOpts.length > 0) {
                    saladOpts.forEach((opt: any) => {
                      const key = `${opt.id}:${opt.option}`;
                      totalDailyFreq += (cpSaladFreqs[key] ?? cp.frequency ?? 1);
                    });
                  } else {
                    totalDailyFreq = cpSaladFreqs['pkg'] ?? cp.frequency ?? 1;
                  }

                  const isMultipleInvalid = totalDailyFreq > 0 && remainingMeals > 0 && (remainingMeals % totalDailyFreq !== 0);

                  // Financial calculations
                  const perMealPrice = pkg ? (pkg.price / (pkg.meals_count || 10)) : 0;
                  const origPrice = pkg ? Math.round(cp.total * perMealPrice) : 0;
                  const editedPrice = editPricesByCp[cp.id] ?? origPrice;
                  const priceDiff = editedPrice - origPrice;

                  return (
                    <div key={cp.id} className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
                      {/* Header: Package Name & Editable Total Meals */}
                      <div className="flex justify-between items-center gap-2 p-2.5 bg-muted/40 rounded-xl border border-border/60">
                        <div>
                          <div className="text-xs font-bold text-primary">{pkg?.name || 'Package'}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Meals used so far: <strong className="text-foreground font-bold">{used} meals</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="space-y-0.5 text-right">
                            <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Meals</Label>
                            <Input
                              type="number"
                              min={used + 1}
                              value={currentTotal}
                              onChange={e => {
                                const val = Math.max(used, Number(e.target.value) || used);
                                setEditTotalsByCp(prev => ({ ...prev, [cp.id]: val }));
                                if (pkg) {
                                  setEditPricesByCp(prev => ({ ...prev, [cp.id]: Math.round(val * perMealPrice) }));
                                }
                              }}
                              className={cn("w-20 h-7 text-center text-xs font-bold bg-background", isMultipleInvalid && "border-destructive focus-visible:ring-destructive")}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Associated Salads or Package Frequency */}
                      {getPackageSaladOptions(pkg).length === 0 && (
                        <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border/50">
                          <Label className="text-xs font-semibold">Frequency (Qty/Day):</Label>
                          <Input
                            type="number"
                            min="1"
                            value={(editSaladFrequenciesByCp[cp.id] || {})['pkg'] ?? cp.frequency ?? 1}
                            onChange={e => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setEditSaladFrequenciesByCp(prev => ({
                                ...prev,
                                [cp.id]: { ...(prev[cp.id] || {}), 'pkg': val }
                              }));
                            }}
                            className="w-16 h-7 text-center text-xs font-bold bg-background"
                          />
                        </div>
                      )}

                      {getPackageSaladOptions(pkg).length > 0 && (
                        <div className="space-y-2">
                          {(pkg?.package_type === 'combo' || getPackageSaladOptions(pkg).length > 1) && (
                            <div className="space-y-2 p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                              <div className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Schedule Option</div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditScheduleModesByCp(prev => ({ ...prev, [cp.id]: 'set_schedule' }))}
                                  className={cn(
                                    "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                                    (editScheduleModesByCp[cp.id] ?? getScheduleMode(cp)) === 'set_schedule'
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                      : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                                  )}
                                >
                                  📅 Set Schedule
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditScheduleModesByCp(prev => ({ ...prev, [cp.id]: 'default' }))}
                                  className={cn(
                                    "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                                    (editScheduleModesByCp[cp.id] ?? getScheduleMode(cp)) === 'default'
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                      : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                                  )}
                                >
                                  🔄 Default (Rotating)
                                </button>
                              </div>
                              {(editScheduleModesByCp[cp.id] ?? getScheduleMode(cp)) === 'default' && (
                                <div className="space-y-1.5 pt-0.5">
                                  <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                                    Subscriber receives a different salad on each delivery day in sequence.
                                  </div>
                                  {getPackageSaladOptions(pkg).length > 0 && (
                                    <div className="space-y-1 pt-1">
                                      <Label className="text-[11px] font-bold text-blue-900 dark:text-blue-300">Start Rotation With:</Label>
                                      <Select
                                        value={editStartSaladKeysByCp[cp.id] || getStartingSaladKey(cp) || `${getPackageSaladOptions(pkg)[0].id}:${getPackageSaladOptions(pkg)[0].option}`}
                                        onValueChange={val => setEditStartSaladKeysByCp(prev => ({ ...prev, [cp.id]: val }))}
                                      >
                                        <SelectTrigger className="h-8 text-xs bg-background border-blue-200 dark:border-blue-800">
                                          <SelectValue placeholder="Select starting salad" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {getPackageSaladOptions(pkg).map((opt: any) => {
                                            const item = menuItems.find(mi => mi.id === opt.id);
                                            const key = `${opt.id}:${opt.option}`;
                                            const label = opt.option && opt.option.toLowerCase() !== 'regular'
                                              ? `${item?.name || `Salad ${opt.id}`} – ${opt.option}`
                                              : (item?.name || `Salad ${opt.id}`);
                                            return (
                                              <SelectItem key={key} value={key} className="text-xs">
                                                🥗 {label}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Associated Salads (Daily Frequency{(editScheduleModesByCp[cp.id] ?? getScheduleMode(cp)) === 'set_schedule' ? ' & Schedules' : ''})
                          </div>
                          {getPackageSaladOptions(pkg).map((opt: any, optIdx: number) => {
                            const item = menuItems.find(mi => mi.id === opt.id);
                            if (!item) return null;
                            const saladKey = `${opt.id}:${opt.option}`;
                            const saladDays = (editSaladSchedulesByCp[cp.id] || {})[saladKey] || [];
                            const saladFreq = (editSaladFrequenciesByCp[cp.id] || {})[saladKey] ?? (cp.salad_frequencies && cp.salad_frequencies[saladKey]) ?? cp.frequency ?? 1;
                            const label = opt.option && opt.option.toLowerCase() !== 'regular'
                              ? `${item.name} – ${opt.option}`
                              : item.name;
                            const isDefaultMode = (editScheduleModesByCp[cp.id] ?? getScheduleMode(cp)) === 'default';
                            return (
                              <div key={`${cp.id}-${saladKey}-${optIdx}`} className="space-y-1.5 p-2.5 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                                <div className="flex justify-between items-center">
                                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400">🥗 {label}</div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-400">Qty/Day:</span>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={saladFreq}
                                      onChange={e => {
                                        const val = Math.max(1, Number(e.target.value) || 1);
                                        setEditSaladFrequenciesByCp(prev => ({
                                          ...prev,
                                          [cp.id]: { ...(prev[cp.id] || {}), [saladKey]: val }
                                        }));
                                      }}
                                      className="w-12 h-6 text-center text-xs p-0 font-bold bg-background border border-emerald-200 rounded-md"
                                    />
                                  </div>
                                </div>
                                {!isDefaultMode && (
                                  <>
                                    <div className="flex gap-1">
                                      {DAYS.map((day, idx) => {
                                        const isDaySelected = saladDays.length === 0 || saladDays.includes(idx);
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleEditSaladScheduleDay(cp.id, saladKey, idx)}
                                            className={cn(
                                              "flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                                              isDaySelected
                                                ? 'bg-emerald-600 border-emerald-600 text-white font-bold'
                                                : 'border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 bg-background'
                                            )}
                                          >
                                            {day[0]}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground">
                                      {saladDays.length === 0 ? 'All days (Mon–Sat)' : `${saladDays.length} day(s) selected`}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Remaining Meals & Duration Summary */}
                      {totalDailyFreq > 0 && (
                        <div className="text-xs">
                          {isMultipleInvalid ? (
                            <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-semibold space-y-0.5 animate-in fade-in duration-200">
                              <div>⚠️ Remaining meals ({remainingMeals}) must be a multiple of daily frequency ({totalDailyFreq} pack(s)/day).</div>
                              <div className="text-[10px] font-normal text-destructive/80">
                                Suggested Total Meals: {used + (Math.ceil(Math.max(1, remainingMeals) / totalDailyFreq) * totalDailyFreq)} (for {Math.ceil(Math.max(1, remainingMeals) / totalDailyFreq)} days remaining)
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 rounded-xl text-emerald-800 dark:text-emerald-300 flex justify-between items-center animate-in fade-in duration-200">
                              <span>📦 Remaining: <strong className="font-bold">{remainingMeals} meals</strong> ({totalDailyFreq} pack(s)/day)</span>
                              <span className="font-bold">Duration: {remainingMeals / totalDailyFreq} days left</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Financial Settlement Impact Section */}
                      <div className="p-3 bg-muted/20 rounded-xl border border-border/80 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <Label className="font-semibold text-muted-foreground">Updated Package Price (₹):</Label>
                          <Input
                            type="number"
                            min="0"
                            value={editedPrice}
                            onChange={e => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setEditPricesByCp(prev => ({ ...prev, [cp.id]: val }));
                            }}
                            className="w-24 h-7 text-center text-xs font-bold bg-background"
                          />
                        </div>

                        {priceDiff > 0 && (
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-900 dark:text-blue-200 text-xs space-y-1 animate-in fade-in duration-200">
                            <div className="font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                              💳 Business Needs to Charge Customer
                            </div>
                            <div>Collect <strong className="font-bold text-blue-700 dark:text-blue-400">₹{priceDiff}</strong> extra from customer (Updated Price: ₹{editedPrice}, Originally Charged: ₹{origPrice}).</div>
                          </div>
                        )}

                        {priceDiff < 0 && (
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200 text-xs space-y-1 animate-in fade-in duration-200">
                            <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                              💵 Business Needs to Refund Customer
                            </div>
                            <div>Refund / Pay <strong className="font-bold text-amber-700 dark:text-amber-400">₹{Math.abs(priceDiff)}</strong> back to customer (Updated Price: ₹{editedPrice}, Originally Charged: ₹{origPrice}).</div>
                          </div>
                        )}

                        {priceDiff === 0 && (
                          <div className="text-[10px] text-muted-foreground italic text-right">
                            No price adjustment required (Price: ₹{origPrice}).
                          </div>
                        )}
                      </div>

                      {/* Instruction Input */}
                      <Input
                        placeholder="e.g. No onions, extra sprouts..."
                        value={editInstructions[cp.id] || ''}
                        onChange={e => setEditInstructions(prev => ({ ...prev, [cp.id]: e.target.value }))}
                        className="h-8 rounded-lg text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-800 border border-blue-200">
              Changes will also update this customer's Walk-in record.
            </div>

            {/* Add another package */}
            {editModal.customer && (
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => {
                  setEditModal({ ...editModal, open: false });
                  setAddPkgModal({ open: true, customer: editModal.customer });
                  setAddPkgPkgId(activePackages[0]?.id.toString() || "");
                  setAddPkgPayMode("cash"); setAddPkgCash(""); setAddPkgQrOpen(false);
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Another Package
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} className="w-full h-12 rounded-xl text-base font-bold">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Package to Existing Customer Modal ─────────────────────────── */}
      <Dialog open={addPkgModal.open} onOpenChange={v => { setAddPkgModal({ ...addPkgModal, open: v }); if (!v) setAddPkgQrOpen(false); }}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Add Package — {addPkgModal.customer?.name}</DialogTitle>
          </DialogHeader>
          {addPkgQrOpen ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl font-black text-primary">₹{addPkgTotal}</div>
              <div className="p-3 bg-white rounded-2xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(addPkgUpiUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <a href={addPkgUpiUrl} className="flex items-center gap-2 text-sm font-bold text-blue-600 underline underline-offset-2">
                <CreditCard className="w-4 h-4" /> Open in UPI App
              </a>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 h-12 rounded-xl font-bold" onClick={handleAddPackageToCustomer}>Payment Done</Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setAddPkgQrOpen(false)}>Back</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Package</Label>
                  <Select value={addPkgPkgId} onValueChange={setAddPkgPkgId}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Choose a package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="font-bold text-xs text-muted-foreground uppercase px-2 py-1">Individual Packages</SelectLabel>
                        {activePackages.filter(p => !p.package_type || p.package_type === 'individual').map(p => (
                          <SelectItem key={p.id} value={p.id.toString()} className="cursor-pointer">
                            {p.name} — {p.meals_count ?? 10} meals — ₹{p.price}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="font-bold text-xs text-muted-foreground uppercase px-2 py-1 border-t border-border mt-1">Combo Packages</SelectLabel>
                        {activePackages.filter(p => p.package_type === 'combo').map(p => (
                          <SelectItem key={p.id} value={p.id.toString()} className="cursor-pointer">
                            {p.name} — {p.meals_count ?? 10} meals — ₹{p.price}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {selectedAddPkgPkg && (
                  <div className="space-y-3">
                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm flex justify-between">
                      <span>{selectedAddPkgPkg.name} ({selectedAddPkgPkg.meals_count ?? 10} meals)</span>
                      <span className="font-bold text-primary">₹{selectedAddPkgPkg.price}</span>
                    </div>

                    <div className="flex items-center gap-1.5 p-3 rounded-xl border border-border bg-muted/10 animate-in fade-in duration-200">
                      <Label className="text-xs font-semibold">Frequency (Qty/Day):</Label>
                      <Input
                        type="number"
                        min="1"
                        value={addPkgFrequency}
                        onChange={e => setAddPkgFrequency(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 h-8 text-center bg-background"
                      />
                    </div>

                    {/* Schedule Option selector for Combo or multi-salad packages */}
                    {selectedAddPkgPkg && (selectedAddPkgPkg.package_type === 'combo' || getPackageSaladOptions(selectedAddPkgPkg).length > 1) && (
                      <div className="space-y-2 p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Schedule Option</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAddPkgScheduleMode('set_schedule')}
                            className={cn(
                              "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                              addPkgScheduleMode === 'set_schedule'
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                            )}
                          >
                            📅 Set Schedule
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddPkgScheduleMode('default')}
                            className={cn(
                              "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                              addPkgScheduleMode === 'default'
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600'
                            )}
                          >
                            🔄 Default (Rotating)
                          </button>
                        </div>
                        {addPkgScheduleMode === 'default' && (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                              Subscriber receives a different salad on each delivery day in sequence.
                            </div>
                            {selectedAddPkgPkg && getPackageSaladOptions(selectedAddPkgPkg).length > 0 && (
                              <div className="space-y-1 pt-1">
                                <Label className="text-[11px] font-bold text-blue-900 dark:text-blue-300">Start Rotation With:</Label>
                                <Select
                                  value={addPkgStartSaladKey || `${getPackageSaladOptions(selectedAddPkgPkg)[0].id}:${getPackageSaladOptions(selectedAddPkgPkg)[0].option}`}
                                  onValueChange={val => setAddPkgStartSaladKey(val)}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background border-blue-200 dark:border-blue-800">
                                    <SelectValue placeholder="Select starting salad" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getPackageSaladOptions(selectedAddPkgPkg).map((opt: any) => {
                                      const item = menuItems.find(mi => mi.id === opt.id);
                                      const key = `${opt.id}:${opt.option}`;
                                      const label = opt.option && opt.option.toLowerCase() !== 'regular'
                                        ? `${item?.name || `Salad ${opt.id}`} – ${opt.option}`
                                        : (item?.name || `Salad ${opt.id}`);
                                      return (
                                        <SelectItem key={key} value={key} className="text-xs">
                                          🥗 {label}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Display Associated Salads with Individual schedules */}
                    {getPackageSaladOptions(selectedAddPkgPkg).length > 0 ? (
                      addPkgScheduleMode === 'default' ? null : (
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Associated Salads (Delivery Schedules)</div>
                          {getPackageSaladOptions(selectedAddPkgPkg).map((opt: any, optIdx: number) => {
                            const item = menuItems.find(mi => mi.id === opt.id);
                            if (!item) return null;
                            const saladKey = `${opt.id}:${opt.option}`;
                            const saladDays = addPkgSaladSchedules[saladKey] || [];
                            const label = opt.option && opt.option.toLowerCase() !== 'regular'
                              ? `${item.name} – ${opt.option}`
                              : item.name;
                            return (
                              <div key={`${selectedAddPkgPkg.id}-${saladKey}-${optIdx}`} className="space-y-1.5 p-2.5 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 animate-in fade-in duration-200">
                                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400">🥗 {label}</div>
                                <div className="flex gap-1">
                                  {DAYS.map((day, idx) => {
                                    const isDaySelected = saladDays.length === 0 || saladDays.includes(idx);
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => toggleAddPkgSaladScheduleDay(saladKey, idx)}
                                        className={cn(
                                          "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                                          isDaySelected
                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                            : 'border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600 bg-background'
                                        )}
                                      >
                                        {day[0]}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="text-[9px] text-muted-foreground">
                                  {saladDays.length === 0
                                    ? 'All days (Mon–Sat) — tap a day to exclude it'
                                    : `${saladDays.length} day(s) selected`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      /* Fallback to package-level Salad Days picker if no associated salads */
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Salad Days (Delivery Schedule)</Label>
                        <div className="flex gap-1">
                          {DAYS.map((day, idx) => {
                            const isDaySelected = addPkgSaladDays.length === 0 || addPkgSaladDays.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setAddPkgSaladDays(prev => {
                                    const current = prev || [];
                                    let next: number[];
                                    if (current.length === 0) {
                                      next = [0, 1, 2, 3, 4, 5].filter(d => d !== idx);
                                    } else if (current.includes(idx)) {
                                      next = current.filter(d => d !== idx);
                                    } else {
                                      next = [...current, idx].sort();
                                    }
                                    if (next.length === 6) next = [];
                                    return next;
                                  });
                                }}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                                  isDaySelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'
                                )}
                              >
                                {day[0]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {addPkgSaladDays.length === 0
                            ? 'All days (Mon–Sat) — tap a day to exclude it'
                            : `${addPkgSaladDays.length} day(s) selected`}
                        </div>
                      </div>
                    )}

                    {/* Special Instructions */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Special Instructions</Label>
                      <Input
                        placeholder="e.g. No onions, extra sprouts..."
                        value={addPkgInstruction}
                        onChange={e => setAddPkgInstruction(e.target.value)}
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <PaymentModeSelect value={addPkgPayMode} onChange={setAddPkgPayMode} />
                </div>
                {addPkgPayMode === 'cash' && addPkgTotal > 0 && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                    <Label className="text-amber-900 font-bold text-xs">Cash Received</Label>
                    <Input type="number" placeholder="₹" value={addPkgCash} onChange={e => setAddPkgCash(e.target.value)} className="bg-white border-amber-300 h-11" />
                    {addPkgCash !== "" && (
                      <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${(Number(addPkgCash) - addPkgTotal) >= 0 ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>
                        <span>{(Number(addPkgCash) - addPkgTotal) >= 0 ? 'Change:' : 'Short:'}</span>
                        <span>₹{Math.abs(Number(addPkgCash) - addPkgTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
                {addPkgPayMode === 'upi' && addPkgTotal > 0 && (
                  <a href={addPkgUpiUrl} className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors">
                    <CreditCard className="w-4 h-4" /> Open UPI App — ₹{addPkgTotal}
                  </a>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleAddPackageToCustomer} className="w-full h-14 text-lg rounded-xl font-bold">
                  {addPkgPayMode === 'scanpay' ? 'Show QR & Add Package' : 'Add Package'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Instructions Modal ─────────────────────────────────────────────── */}
      <Dialog open={instrModal.open} onOpenChange={o => !o && setInstrModal({ open: false, customer: null })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Instructions — {instrModal.customer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {instrModal.customer && (() => {
              const cps = getCustPacks(instrModal.customer.id).filter(cp => cp.status === 'active');
              if (cps.length === 0) return (
                <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                  No active packages found.
                </div>
              );
              return cps.map(cp => {
                const pkg = packages.find(p => p.id === cp.package_id);
                return (
                  <div key={cp.id} className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-primary">{pkg?.name || 'Package'}</div>
                      <div className="text-xs text-muted-foreground">{cp.total - cp.used} meals left</div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. No onions, extra sprouts..."
                        value={instrEdits[cp.id] ?? ''}
                        onChange={e => setInstrEdits(prev => ({ ...prev, [cp.id]: e.target.value }))}
                        className="h-9 rounded-lg text-sm flex-1"
                      />
                      {instrEdits[cp.id] && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg border-red-200 text-red-500 hover:bg-red-50 shrink-0"
                          onClick={() => setInstrEdits(prev => ({ ...prev, [cp.id]: '' }))}
                          title="Clear instruction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {cp.instruction && instrEdits[cp.id] === '' && (
                      <div className="text-xs text-amber-600 italic">Saving will clear the existing instruction.</div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <DialogFooter>
            <Button onClick={saveInstr} className="w-full h-12 rounded-xl text-base font-bold">
              Save Instructions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── History Modal ───────────────────────────────────────────────────── */}
      <Dialog open={historyModal.open} onOpenChange={o => !o && setHistoryModal({ open: false, customer: null })}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif flex items-center gap-2">
              <History className="w-5 h-5" /> {historyModal.customer?.name} — History
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {historyLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
            ) : historyLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">No activity recorded yet.</div>
            ) : (
              historyLogs.map(log => (
                <div key={log.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold text-sm capitalize">{log.action.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] text-muted-foreground text-right shrink-0">{formatIST(log.created_at)}</div>
                  </div>
                  {log.description && <div className="text-xs text-muted-foreground mt-1">{log.description}</div>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
