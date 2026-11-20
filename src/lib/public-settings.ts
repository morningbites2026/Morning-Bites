/**
 * Public Site Settings & Configuration Management
 * 
 * Manages:
 * 1. Phone Numbers & WhatsApp designated number (only one can be WhatsApp)
 * 2. Social Media links (Google Maps, Google Page, Instagram, Facebook) - only show on public site if set
 * 3. Public Menu item visibility (which menu items display on the customer website)
 * 
 * Synchronized with Supabase site_settings and cached in localStorage.
 */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://qootbuuopygueiyxbwfm.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvb3RidXVvcHlndWVpeXhid2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODgzODAsImV4cCI6MjA5MTM2NDM4MH0.TontN_KzMi-0_dy25FYjcO0TansxLdyrbcDZfhxD4Ks";

export const PUBLIC_CONFIG_STORAGE_KEY = "morning_bites_public_config";
export const PUBLIC_MENU_IDS_STORAGE_KEY = "morning_bites_public_menu_ids";

export interface PhoneNumberItem {
  id: string;
  number: string;
  label?: string;
  isWhatsApp: boolean;
}

export interface SocialLinksConfig {
  googleMaps: string;
  googlePage: string;
  instagram: string;
  facebook: string;
}

export interface PublicSiteConfig {
  phones: PhoneNumberItem[];
  social: SocialLinksConfig;
  publicMenuIds?: number[]; // List of menu item IDs allowed on public site. If undefined/empty, all active items display.
  updated_at?: string;
}

export const DEFAULT_PHONES: PhoneNumberItem[] = [
  { id: "p1", number: "9099172237", label: "Orders", isWhatsApp: true },
  { id: "p2", number: "9429929822", label: "Support", isWhatsApp: false },
];

export const DEFAULT_SOCIAL: SocialLinksConfig = {
  googleMaps: "https://maps.google.com/?q=Akota+Garden+Near+Radha+Krishna+Circle+Akota+Vadodara",
  googlePage: "",
  instagram: "",
  facebook: "",
};

export const INITIAL_PUBLIC_CONFIG: PublicSiteConfig = {
  phones: DEFAULT_PHONES,
  social: DEFAULT_SOCIAL,
  publicMenuIds: undefined,
};

// Clean numeric phone for wa.me / tel:
export function cleanPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Get cached public config from localStorage
export function getLocalPublicConfig(): PublicSiteConfig {
  try {
    const raw = localStorage.getItem(PUBLIC_CONFIG_STORAGE_KEY);
    if (!raw) return INITIAL_PUBLIC_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      phones: Array.isArray(parsed.phones) && parsed.phones.length > 0 ? parsed.phones : DEFAULT_PHONES,
      social: {
        googleMaps: typeof parsed.social?.googleMaps === "string" ? parsed.social.googleMaps : DEFAULT_SOCIAL.googleMaps,
        googlePage: typeof parsed.social?.googlePage === "string" ? parsed.social.googlePage : "",
        instagram: typeof parsed.social?.instagram === "string" ? parsed.social.instagram : "",
        facebook: typeof parsed.social?.facebook === "string" ? parsed.social.facebook : "",
      },
      publicMenuIds: Array.isArray(parsed.publicMenuIds) ? parsed.publicMenuIds : undefined,
      updated_at: parsed.updated_at,
    };
  } catch {
    return INITIAL_PUBLIC_CONFIG;
  }
}

// Save to localStorage cache
export function setLocalPublicConfig(config: PublicSiteConfig): void {
  try {
    localStorage.setItem(PUBLIC_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("Could not cache public config locally:", err);
  }
}

// Fetch remote config from Supabase site_settings
export async function fetchRemotePublicConfig(): Promise<PublicSiteConfig> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/site_settings?key=eq.public_site_config&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].value) {
        const parsed = JSON.parse(data[0].value) as PublicSiteConfig;
        const resolved: PublicSiteConfig = {
          phones: Array.isArray(parsed.phones) && parsed.phones.length > 0 ? parsed.phones : DEFAULT_PHONES,
          social: {
            googleMaps: typeof parsed.social?.googleMaps === "string" ? parsed.social.googleMaps : DEFAULT_SOCIAL.googleMaps,
            googlePage: typeof parsed.social?.googlePage === "string" ? parsed.social.googlePage : "",
            instagram: typeof parsed.social?.instagram === "string" ? parsed.social.instagram : "",
            facebook: typeof parsed.social?.facebook === "string" ? parsed.social.facebook : "",
          },
          publicMenuIds: Array.isArray(parsed.publicMenuIds) ? parsed.publicMenuIds : undefined,
          updated_at: parsed.updated_at,
        };
        setLocalPublicConfig(resolved);
        return resolved;
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote public config, falling back to local cache:", err);
  }

  return getLocalPublicConfig();
}

// Save public config to Supabase and cache
export async function savePublicConfig(config: PublicSiteConfig): Promise<{ success: boolean; error?: string }> {
  // Enforce rule: exactly one or at most one phone can have isWhatsApp: true
  let hasWhatsApp = false;
  const sanitizedPhones = config.phones.map(p => {
    if (p.isWhatsApp && !hasWhatsApp) {
      hasWhatsApp = true;
      return { ...p, isWhatsApp: true };
    }
    return { ...p, isWhatsApp: false };
  });

  // If none was checked, check the first phone
  if (!hasWhatsApp && sanitizedPhones.length > 0) {
    sanitizedPhones[0].isWhatsApp = true;
  }

  const payload: PublicSiteConfig = {
    phones: sanitizedPhones,
    social: {
      googleMaps: config.social.googleMaps?.trim() || "",
      googlePage: config.social.googlePage?.trim() || "",
      instagram: config.social.instagram?.trim() || "",
      facebook: config.social.facebook?.trim() || "",
    },
    publicMenuIds: config.publicMenuIds,
    updated_at: new Date().toISOString(),
  };

  try {
    const url = `${SUPABASE_URL}/rest/v1/site_settings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        key: "public_site_config",
        value: JSON.stringify(payload),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Supabase public config save warning:", errText);
    }

    setLocalPublicConfig(payload);
    return { success: true };
  } catch (err: any) {
    console.warn("Network error during public config save:", err);
    setLocalPublicConfig(payload);
    return { success: true };
  }
}

// Public Menu item helpers
export function isMenuItemShownOnPublic(itemId: number, publicMenuIds?: number[]): boolean {
  // If publicMenuIds is not defined or null, all items are public by default
  if (!publicMenuIds) return true;
  return publicMenuIds.includes(itemId);
}

// Toggle single menu item public visibility
export async function toggleMenuItemPublicVisibility(itemId: number, allActiveItemIds: number[]): Promise<boolean> {
  const currentConfig = getLocalPublicConfig();
  let currentList = currentConfig.publicMenuIds;

  // If never set before, initialize with all currently active item IDs
  if (!currentList) {
    currentList = [...allActiveItemIds];
  }

  let nextList: number[];
  let isNowPublic: boolean;

  if (currentList.includes(itemId)) {
    nextList = currentList.filter(id => id !== itemId);
    isNowPublic = false;
  } else {
    nextList = [...currentList, itemId];
    isNowPublic = true;
  }

  currentConfig.publicMenuIds = nextList;
  await savePublicConfig(currentConfig);
  return isNowPublic;
}
