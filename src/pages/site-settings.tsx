import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  fetchRemotePublicConfig,
  savePublicConfig,
  PublicSiteConfig,
  PhoneNumberItem,
  DEFAULT_SOCIAL,
  getLocalPublicConfig,
} from "@/lib/public-settings";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  MessageCircle,
  MapPin,
  Globe,
  Plus,
  Trash2,
  Save,
  ExternalLink,
  Layers,
  Share2,
  UtensilsCrossed,
} from "lucide-react";
import { InstagramIcon, FacebookIcon } from "@/components/social-icons";

export default function SiteSettings() {
  const { toast } = useToast();

  const [config, setConfig] = useState<PublicSiteConfig>(() => getLocalPublicConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchRemotePublicConfig().then(remote => {
      if (mounted) {
        setConfig(remote);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Update phone item
  const handlePhoneChange = (id: string, field: "number" | "label", value: string) => {
    setConfig(prev => ({
      ...prev,
      phones: prev.phones.map(p => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  // Set WhatsApp radio selection (ensuring only ONE number is checked)
  const handleSetWhatsApp = (selectedId: string) => {
    setConfig(prev => ({
      ...prev,
      phones: prev.phones.map(p => ({
        ...p,
        isWhatsApp: p.id === selectedId,
      })),
    }));
    toast({
      title: "WhatsApp number updated",
      description: "Customers will be redirected to this number when clicking WhatsApp Order buttons.",
    });
  };

  // Add new phone number
  const handleAddPhone = () => {
    const newId = "phone_" + Date.now();
    const newPhone: PhoneNumberItem = {
      id: newId,
      number: "",
      label: "Support",
      isWhatsApp: config.phones.length === 0, // if first phone, make it whatsapp
    };
    setConfig(prev => ({
      ...prev,
      phones: [...prev.phones, newPhone],
    }));
  };

  // Remove phone number
  const handleRemovePhone = (id: string) => {
    if (config.phones.length <= 1) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: "You must keep at least one contact phone number.",
      });
      return;
    }

    const removedWasWhatsApp = config.phones.find(p => p.id === id)?.isWhatsApp;
    const remaining = config.phones.filter(p => p.id !== id);

    // If we removed the WhatsApp number, assign WhatsApp to the first remaining number
    if (removedWasWhatsApp && remaining.length > 0) {
      remaining[0].isWhatsApp = true;
    }

    setConfig(prev => ({
      ...prev,
      phones: remaining,
    }));
  };

  // Update social links
  const handleSocialChange = (field: keyof typeof DEFAULT_SOCIAL, value: string) => {
    setConfig(prev => ({
      ...prev,
      social: {
        ...prev.social,
        [field]: value,
      },
    }));
  };

  // Save all settings to Supabase
  const handleSave = async () => {
    // Validate phone numbers
    const validPhones = config.phones.filter(p => p.number.trim().length > 0);
    if (validPhones.length === 0) {
      toast({
        variant: "destructive",
        title: "Phone Number Required",
        description: "Please provide at least one valid phone number.",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await savePublicConfig({
        ...config,
        phones: validPhones,
      });

      if (res.success) {
        toast({
          title: "Public settings saved successfully!",
          description: "All changes are now active on the public website.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to save settings",
          description: res.error || "Please check your network and try again.",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error saving settings",
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-in fade-in">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
              <Globe className="w-5 h-5 text-[#1e4d2b]" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-slate-800">
              Public Website Settings
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Manage your store phone numbers, designated WhatsApp hotline, and social media buttons shown to visitors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Public Site</span>
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[#1e4d2b] hover:bg-[#163c22] text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SECTION 1: PHONE NUMBERS & WHATSAPP CONFIGURATION */}
      <div className="bg-white rounded-3xl border border-border p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Store Phone Numbers & WhatsApp Hotline
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Add all store contact numbers. Mark exactly <strong>one</strong> number with the WhatsApp checkbox for online orders.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddPhone}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1e4d2b] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Phone Number</span>
          </button>
        </div>

        {/* PHONE NUMBERS LIST */}
        <div className="space-y-3">
          {config.phones.map((item, index) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all ${
                item.isWhatsApp
                  ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300/40"
                  : "bg-slate-50/70 border-slate-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                  <span className="w-6 h-6 rounded-full bg-white border text-xs font-bold text-slate-600 flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>

                  {/* Phone Input */}
                  <div className="flex-1 max-w-xs">
                    <input
                      type="tel"
                      value={item.number}
                      onChange={e => handlePhoneChange(item.id, "number", e.target.value)}
                      placeholder="e.g. 9099172237"
                      className="w-full h-10 px-3 text-sm font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none"
                    />
                  </div>

                  {/* Label Input */}
                  <div className="w-32">
                    <input
                      type="text"
                      value={item.label || ""}
                      onChange={e => handlePhoneChange(item.id, "label", e.target.value)}
                      placeholder="e.g. Orders"
                      className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none text-slate-600 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                  {/* WhatsApp Checkbox / Selector */}
                  <label
                    onClick={() => handleSetWhatsApp(item.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                      item.isWhatsApp
                        ? "bg-[#1e4d2b] text-white border-[#1e4d2b] shadow-xs"
                        : "bg-white text-slate-600 border-slate-300 hover:border-emerald-600"
                    }`}
                  >
                    <MessageCircle className={`w-3.5 h-3.5 ${item.isWhatsApp ? "text-green-300" : "text-slate-400"}`} />
                    <span>{item.isWhatsApp ? "Active WhatsApp Number" : "Set as WhatsApp"}</span>
                  </label>

                  {/* Delete Phone */}
                  <button
                    type="button"
                    onClick={() => handleRemovePhone(item.id)}
                    disabled={config.phones.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Remove number"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: SOCIAL MEDIA & ONLINE LINKS */}
      <div className="bg-white rounded-3xl border border-border p-5 sm:p-7 shadow-sm space-y-5">
        <div className="border-b pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Social Media & Online Links
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Buttons only appear on the public website if a valid link is provided below. Leave empty to hide the button.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* GOOGLE MAPS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>Google Maps Location Link</span>
            </label>
            <input
              type="url"
              value={config.social.googleMaps}
              onChange={e => handleSocialChange("googleMaps", e.target.value)}
              placeholder="https://maps.google.com/?q=..."
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">Used for "Get Directions" and map location pills.</p>
          </div>

          {/* GOOGLE REVIEWS / BUSINESS PAGE */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-amber-600" />
              <span>Google Business / Review Page Link</span>
            </label>
            <input
              type="url"
              value={config.social.googlePage}
              onChange={e => handleSocialChange("googlePage", e.target.value)}
              placeholder="https://g.page/r/... or review link"
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">Links visitors to leave Google reviews.</p>
          </div>

          {/* INSTAGRAM */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <InstagramIcon className="w-4 h-4 text-pink-600" />
              <span>Instagram Profile Link</span>
            </label>
            <input
              type="url"
              value={config.social.instagram}
              onChange={e => handleSocialChange("instagram", e.target.value)}
              placeholder="https://instagram.com/morningbites..."
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">Leave blank if Instagram page is not active.</p>
          </div>

          {/* FACEBOOK */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FacebookIcon className="w-4 h-4 text-blue-600" />
              <span>Facebook Page Link</span>
            </label>
            <input
              type="url"
              value={config.social.facebook}
              onChange={e => handleSocialChange("facebook", e.target.value)}
              placeholder="https://facebook.com/morningbites..."
              className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">Leave blank if Facebook page is not active.</p>
          </div>
        </div>

        {/* ACTIVE SOCIAL BUTTONS PREVIEW */}
        <div className="pt-2 border-t">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Buttons Active on Public Site:
          </p>
          <div className="flex flex-wrap gap-2">
            {config.social.googleMaps?.trim() && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                <MapPin className="w-3.5 h-3.5 text-red-600" /> Google Map Location
              </span>
            )}
            {config.social.googlePage?.trim() && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                <Globe className="w-3.5 h-3.5 text-amber-600" /> Google Business Page
              </span>
            )}
            {config.social.instagram?.trim() && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-800 bg-pink-50 border border-pink-200 px-3 py-1 rounded-full">
                <InstagramIcon className="w-3.5 h-3.5 text-pink-600" /> Instagram
              </span>
            )}
            {config.social.facebook?.trim() && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                <FacebookIcon className="w-3.5 h-3.5 text-blue-600" /> Facebook
              </span>
            )}
            {!config.social.googleMaps?.trim() &&
              !config.social.googlePage?.trim() &&
              !config.social.instagram?.trim() &&
              !config.social.facebook?.trim() && (
                <span className="text-xs text-slate-400 italic">No social buttons currently active.</span>
              )}
          </div>
        </div>
      </div>

      {/* SECTION 3: QUICK NAVIGATION TO BANNER & MENU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* HERO BANNER CARD */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 rounded-3xl p-5 border border-amber-200 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <h3 className="font-bold text-sm text-slate-800">50-50 Hero Banner & Occasions</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload festive posters (Diwali, Sunday specials) and edit the right-side announcement text.
            </p>
          </div>
          <div>
            <Link
              href="/banner"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3.5 py-1.5 rounded-xl transition"
            >
              <span>Manage Banner &rarr;</span>
            </Link>
          </div>
        </div>

        {/* MENU VISIBILITY CARD */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 rounded-3xl p-5 border border-emerald-200 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-[#1e4d2b]" />
              <h3 className="font-bold text-sm text-slate-800">Menu Public Visibility</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Each dish has a "Public Site" button in Menu Management to toggle whether it displays on the customer site.
            </p>
          </div>
          <div>
            <Link
              href="/menu"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#1e4d2b] bg-emerald-100 hover:bg-emerald-200 px-3.5 py-1.5 rounded-xl transition"
            >
              <span>Open Menu Manager &rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-[#1e4d2b] hover:bg-[#163c22] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save All Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
