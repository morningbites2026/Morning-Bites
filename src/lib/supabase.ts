import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL as string;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY as string;
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);
const missingSupabaseMessage =
  'Missing Supabase environment variables. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_KEY in .env.local';

if (!hasSupabaseEnv) {
  console.warn(missingSupabaseMessage);
}

export const supabase = hasSupabaseEnv ? createClient(supabaseUrl, supabaseKey) : null;

export const UPI_ID = (process.env.REACT_APP_UPI_ID as string) || 'mansisheth174-1@oksbi';

function ensureSupabaseEnv(): void {
  if (!hasSupabaseEnv) {
    throw new Error(missingSupabaseMessage);
  }
}

export function formatIST(isoStr: string): string {
  try {
    let s = isoStr.trim().replace(' ', 'T');
    // If no timezone indicator, assume UTC (Supabase stores in UTC)
    if (!/Z|[+-]\d{2}(:\d{2})?$/.test(s)) s += 'Z';
    return new Date(s).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return isoStr;
  }
}

// Returns current date in IST as YYYY-MM-DD (e.g. "2026-04-23")
export function getISTISODate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// Returns current datetime as ISO string with IST offset (e.g. "2026-04-23T10:30:00.000+05:30")
export function getISTTimestamp(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000+05:30`;
}

// Returns current date in IST as localized string (e.g. "23/04/2026")
export function getISTDateDisplay(): string {
  return new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

// Returns formatted date string like "23/4/2026" from ISO date
export function formatISTDate(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split('-');
    return `${parseInt(d)}/${parseInt(m)}/${y}`;
  } catch {
    return isoDate;
  }
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  type: string;
  total: number;
  used: number;
  join_date: string;
  renew_count: number;
  last_renewed: string | null;
  pack_start_date: string;
  status: 'active' | 'cancelled';
  is_deleted: boolean;
  preferred_days: number[];
  package_id: number | null;
  payment_mode: 'cash' | 'upi' | 'scanpay';
  created_at: string;
}

export interface Walkin {
  id: number;
  name: string;
  phone: string;
  visit_date: string;
  is_deleted: boolean;
  created_at: string;
}

export interface MenuItem {
  id: number;
  name: string;
  options: Array<{ name: string; price: number }>;
  sort_order: number;
  is_active: boolean;
  category: 'daily' | 'week_special';
  week_days: number[];
  created_at: string;
}

export interface Bill {
  id: number;
  customer_name: string | null;
  items: Array<{ name: string; option: string; price: number; qty: number }>;
  total_amount: number;
  payment_mode: 'cash' | 'upi' | 'scanpay';
  notes: string | null;
  bill_date: string;
  discount_type?: 'amount' | 'percent';
  discount_value?: number;
  advance_balance?: number;
  outstanding_balance?: number;
  advance_status?: 'pending' | 'paid';
  outstanding_status?: 'pending' | 'received';
  created_at: string;
}

export interface Preorder {
  id: number;
  customer_name: string | null;
  phone: string | null;
  pickup_date: string; // YYYY-MM-DD
  items: Array<{ name: string; option: string; price: number; qty: number }>;
  total_amount: number;
  payment_mode: 'cash' | 'upi' | 'scanpay' | null;
  notes: string | null;
  is_fulfilled: boolean;
  is_cancelled?: boolean;
  created_at: string;
}

export interface MealSkip {
  id: number;
  customer_id: number;
  skip_date: string;
  notified: boolean;
  unskipped: boolean;
  customer_package_id?: number | null;
  created_at: string;
}

export interface Package {
  id: number;
  name: string;
  description: string | null;
  price: number;
  meals_count: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface CustomerPackage {
  id: number;
  customer_id: number;
  package_id: number;
  used: number;
  total: number;
  pack_start_date: string;
  payment_mode: 'cash' | 'upi' | 'scanpay';
  status: 'active' | 'done' | 'cancelled';
  renew_count: number;
  last_renewed: string | null;
  preferred_days: number[]; // DB migration required: ALTER TABLE customer_packages ADD COLUMN preferred_days JSONB DEFAULT '[]';
  instruction?: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  customer_id: number | null;
  action: string;
  description: string;
  meta: any;
  created_at: string;
}

export interface Promotion {
  id: number;
  title: string;
  description: string;
  image_url?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
}

export async function dbGet<T>(table: string, query?: string): Promise<T[]> {
  ensureSupabaseEnv();
  const url = `${supabaseUrl}/rest/v1/${table}?${query || 'select=*'}&order=created_at.desc`;
  const r = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text);
  return JSON.parse(text);
}

export async function dbIns<T>(table: string, data: Partial<T>): Promise<T[]> {
  ensureSupabaseEnv();
  const url = `${supabaseUrl}/rest/v1/${table}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text);
  return JSON.parse(text);
}

export async function dbUpd(table: string, id: number, data: Record<string, unknown>): Promise<void> {
  ensureSupabaseEnv();
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text);
  }
}

export async function dbDel(table: string, id: number): Promise<void> {
  ensureSupabaseEnv();
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text);
  }
}

export async function dbUpdWhere(table: string, filter: string, data: Record<string, unknown>): Promise<void> {
  ensureSupabaseEnv();
  const url = `${supabaseUrl}/rest/v1/${table}?${filter}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text);
  }
}

export async function logActivity(customerId: number | null, action: string, description: string, meta?: any): Promise<void> {
  try {
    await dbIns('activity_logs', {
      customer_id: customerId,
      action,
      description,
      meta: meta || null,
      created_at: getISTTimestamp(),
    });
  } catch (e) {
    console.warn('Activity log skipped (table may not exist yet):', e);
  }
}

export async function getActivityLogs(customerId: number): Promise<ActivityLog[]> {
  try {
    return await dbGet<ActivityLog>('activity_logs', `select=*&customer_id=eq.${customerId}`);
  } catch {
    return [];
  }
}

export async function getPromotionHistory(): Promise<ActivityLog[]> {
  try {
    return await dbGet<ActivityLog>('activity_logs', `select=*&action=eq.promotion_sent`);
  } catch {
    return [];
  }
}
