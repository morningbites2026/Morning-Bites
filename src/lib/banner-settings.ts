/**
 * Banner & Occasion Settings Management
 * 
 * Manages the 50-50 Hero Banner on the public homepage.
 * Allows staff to upload/set occasion images and customized free text in the Admin Portal.
 * Syncs via Supabase site_settings with offline/instant localStorage cache.
 */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://qootbuuopygueiyxbwfm.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvb3RidXVvcHlndWVpeXhid2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODgzODAsImV4cCI6MjA5MTM2NDM4MH0.TontN_KzMi-0_dy25FYjcO0TansxLdyrbcDZfhxD4Ks";

export const BANNER_SETTINGS_STORAGE_KEY = "morning_bites_banner_settings";

export const DEFAULT_BANNER_IMAGE = "/morning-bites-logo.jpg";
export const DEFAULT_BANNER_BADGE = "☀️ Good Morning Vadodara!";
export const DEFAULT_BANNER_TITLE = "Traditional Taste, Daily Freshness.";
export const DEFAULT_BANNER_TEXT =
  "Wholesome sprout salads, piping-hot methi theplas, tawa parathas, and traditional Gujarati specials delivered fresh every morning in Akota, Vadodara.";

export interface BannerSettings {
  imageUrl: string; // If empty, fallback to DEFAULT_BANNER_IMAGE
  badge: string;    // If empty, fallback to DEFAULT_BANNER_BADGE
  title: string;    // If empty, fallback to DEFAULT_BANNER_TITLE
  text: string;     // If empty, fallback to DEFAULT_BANNER_TEXT
  updated_at?: string;
}

export const INITIAL_DEFAULT_SETTINGS: BannerSettings = {
  imageUrl: "",
  badge: "",
  title: "",
  text: "",
  updated_at: undefined,
};

// Read from localStorage cache
export function getLocalBannerSettings(): BannerSettings {
  try {
    const raw = localStorage.getItem(BANNER_SETTINGS_STORAGE_KEY);
    if (!raw) return INITIAL_DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
      badge: typeof parsed.badge === "string" ? parsed.badge : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
      text: typeof parsed.text === "string" ? parsed.text : "",
      updated_at: parsed.updated_at,
    };
  } catch {
    return INITIAL_DEFAULT_SETTINGS;
  }
}

// Save to localStorage cache
export function setLocalBannerSettings(settings: BannerSettings): void {
  try {
    localStorage.setItem(BANNER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Could not cache banner settings:", err);
  }
}

// Fetch latest banner settings from Supabase site_settings
export async function fetchRemoteBannerSettings(): Promise<BannerSettings> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/site_settings?key=eq.banner_occasion_settings&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].value) {
        const parsed = JSON.parse(data[0].value);
        const resolved: BannerSettings = {
          imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
          badge: typeof parsed.badge === "string" ? parsed.badge : "",
          title: typeof parsed.title === "string" ? parsed.title : "",
          text: typeof parsed.text === "string" ? parsed.text : "",
          updated_at: parsed.updated_at,
        };
        setLocalBannerSettings(resolved);
        return resolved;
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote banner settings, falling back to local:", err);
  }

  return getLocalBannerSettings();
}

// Save banner settings to Supabase site_settings and cache
export async function saveBannerSettings(settings: BannerSettings): Promise<{ success: boolean; error?: string }> {
  const payload: BannerSettings = {
    imageUrl: settings.imageUrl?.trim() || "",
    badge: settings.badge?.trim() || "",
    title: settings.title?.trim() || "",
    text: settings.text?.trim() || "",
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
        key: "banner_occasion_settings",
        value: JSON.stringify(payload),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Remote save failed, keeping local update:", errText);
    }

    setLocalBannerSettings(payload);
    return { success: true };
  } catch (err: any) {
    console.warn("Network error during banner save:", err);
    setLocalBannerSettings(payload);
    return { success: true };
  }
}
