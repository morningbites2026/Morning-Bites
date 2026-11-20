import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  fetchRemoteBannerSettings,
  saveBannerSettings,
  BannerSettings,
  DEFAULT_BANNER_IMAGE,
  DEFAULT_BANNER_BADGE,
  DEFAULT_BANNER_TITLE,
  DEFAULT_BANNER_TEXT,
  getLocalBannerSettings,
} from "@/lib/banner-settings";
import { useToast } from "@/hooks/use-toast";
import {
  ImageIcon,
  Upload,
  RotateCcw,
  Save,
  ExternalLink,
  Sparkles,
  Eye,
  Type,
  Trash2,
  Layers,
} from "lucide-react";

export default function BannerManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<BannerSettings>(() => getLocalBannerSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    let mounted = true;
    fetchRemoteBannerSettings().then(remote => {
      if (mounted) {
        setSettings(remote);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Compute what actually displays on the banner (with user-requested fallback rules)
  const effectiveImage = settings.imageUrl?.trim() || DEFAULT_BANNER_IMAGE;
  const isCustomImage = Boolean(settings.imageUrl?.trim());

  const effectiveBadge = settings.badge?.trim() || DEFAULT_BANNER_BADGE;
  const effectiveTitle = settings.title?.trim() || DEFAULT_BANNER_TITLE;
  const effectiveText = settings.text?.trim() || DEFAULT_BANNER_TEXT;
  const isCustomText = Boolean(settings.text?.trim() || settings.title?.trim() || settings.badge?.trim());

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, WEBP).",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image under 5MB for optimal loading.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const result = event.target?.result as string;
      if (result) {
        setSettings(prev => ({ ...prev, imageUrl: result }));
        toast({
          title: "Image loaded",
          description: "New image loaded into preview. Click 'Save Banner Changes' to publish.",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetImage = () => {
    setSettings(prev => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({
      title: "Image reset",
      description: "Reverted to default Morning Bites logo.",
    });
  };

  const handleResetText = () => {
    setSettings(prev => ({ ...prev, badge: "", title: "", text: "" }));
    toast({
      title: "Text reset",
      description: "Reverted to default Morning Bites welcome message.",
    });
  };

  const handleResetAll = () => {
    setSettings({ imageUrl: "", badge: "", title: "", text: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({
      title: "All defaults restored",
      description: "Both image and text are now set to default.",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveBannerSettings(settings);
      if (res.success) {
        toast({
          title: "Banner published successfully!",
          description: "The public website banner has been updated.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Could not save banner",
          description: res.error || "Please try again.",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error saving banner",
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-slate-800">
              Homepage Banner & Occasions
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Customize the 50-50 hero banner on the public site. Post festive images (Diwali, Uttarayan, Sunday Specials) and custom announcements.
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
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* LIVE 50-50 PREVIEW CARD */}
      <div className="bg-white rounded-3xl border-2 border-[#e5d8c3] p-5 sm:p-7 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Live 50-50 Banner Preview (As seen by customers)
            </h2>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setPreviewTab("desktop")}
              className={`px-3 py-1 rounded-lg transition ${
                previewTab === "desktop" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Desktop (50-50)
            </button>
            <button
              onClick={() => setPreviewTab("mobile")}
              className={`px-3 py-1 rounded-lg transition ${
                previewTab === "mobile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Mobile View
            </button>
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div
          className={`mx-auto bg-[#faf5ee] rounded-2xl p-5 sm:p-8 border border-[#e5d8c3] transition-all ${
            previewTab === "mobile" ? "max-w-sm" : "max-w-full"
          }`}
        >
          {/* 50-50 GRID */}
          <div
            className={`grid gap-6 items-center ${
              previewTab === "mobile" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
            }`}
          >
            {/* LEFT SIDE (50%): IMAGE */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-full max-w-sm aspect-square sm:aspect-auto sm:h-72 rounded-2xl bg-white p-3 border-2 border-[#e5d8c3] shadow-md flex items-center justify-center overflow-hidden">
                <img
                  src={effectiveImage}
                  alt="Banner preview"
                  className="max-h-full max-w-full object-contain rounded-xl"
                  onError={e => {
                    (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
                  }}
                />
              </div>
              <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                {isCustomImage ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Custom Occasion Image Active
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full">
                    Default Official Logo Active
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT SIDE (50%): TEXT */}
            <div className="space-y-3.5 text-center md:text-left">
              {/* BADGE */}
              <div>
                <span className="inline-block bg-[#f4ebe1] border border-[#d6c4ae] px-3.5 py-1 rounded-full text-xs font-bold text-[#3b1e08]">
                  {effectiveBadge}
                </span>
              </div>

              {/* TITLE */}
              <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#3b1e08] leading-tight">
                {effectiveTitle}
              </h2>

              {/* FREE TEXT / DESCRIPTION */}
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                {effectiveText}
              </p>

              {/* HIGHLIGHT CHIPS */}
              <div className="pt-1 flex flex-wrap gap-2 justify-center md:justify-start text-[11px] font-bold text-slate-600">
                <span className="bg-white border border-[#e5d8c3] px-2.5 py-1 rounded-full shadow-xs">
                  ⏰ 6:30 AM – 9:00 AM
                </span>
                <span className="bg-white border border-[#e5d8c3] px-2.5 py-1 rounded-full shadow-xs">
                  🌱 100% Pure Veg
                </span>
                <span className="bg-white border border-[#e5d8c3] px-2.5 py-1 rounded-full shadow-xs">
                  📍 Akota, Vadodara
                </span>
              </div>

              <div className="mt-2 text-[10px] font-bold text-slate-500">
                {isCustomText ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Custom Text Active
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full">
                    Default Text Active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: IMAGE SETTINGS */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                <ImageIcon className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-800 text-sm">Banner Image Settings</h3>
            </div>
            {isCustomImage && (
              <button
                type="button"
                onClick={handleResetImage}
                className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                title="Reset to default logo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revert to Logo</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Upload an occasion poster/photo or paste an image URL. If left empty, the official Morning Bites logo is shown automatically.
          </p>

          {/* Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
              id="banner-file-input"
            />
            <label
              htmlFor="banner-file-input"
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-[#1e4d2b] p-4 rounded-2xl cursor-pointer text-slate-600 hover:text-[#1e4d2b] hover:bg-slate-50 transition"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs font-bold">Upload Image from Device (JPG/PNG/WEBP)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[11px] font-bold text-slate-400 uppercase">Or Image URL</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          {/* Image URL Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Direct Image URL
            </label>
            <input
              type="url"
              value={settings.imageUrl}
              onChange={e => setSettings(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://example.com/festive-banner.jpg"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Thumbnail preview */}
          {settings.imageUrl && (
            <div className="pt-1 flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="w-12 h-12 rounded-lg bg-white p-1 border overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={settings.imageUrl}
                  alt="Thumb"
                  className="max-h-full max-w-full object-contain"
                  onError={e => {
                    (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-700 truncate">Custom Image Attached</p>
                <p className="text-[10px] text-slate-400">Ready to publish</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TEXT SETTINGS */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-50 text-amber-800 rounded-xl">
                <Type className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-800 text-sm">Banner Text Settings</h3>
            </div>
            {isCustomText && (
              <button
                type="button"
                onClick={handleResetText}
                className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                title="Reset to default text"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert to Default Text</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Customize the message displayed on the right side. If left empty, default welcome text is displayed automatically.
          </p>

          {/* Badge Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Badge / Greeting Tag
            </label>
            <input
              type="text"
              value={settings.badge}
              onChange={e => setSettings(prev => ({ ...prev, badge: e.target.value }))}
              placeholder={`e.g. ${DEFAULT_BANNER_BADGE}`}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Heading / Title Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Heading / Title
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={e => setSettings(prev => ({ ...prev, title: e.target.value }))}
              placeholder={`e.g. ${DEFAULT_BANNER_TITLE}`}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Free Text Description Textarea */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Free Text Announcement / Description
            </label>
            <textarea
              rows={4}
              value={settings.text}
              onChange={e => setSettings(prev => ({ ...prev, text: e.target.value }))}
              placeholder={`e.g. ${DEFAULT_BANNER_TEXT}`}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none bg-slate-50 focus:bg-white resize-y"
            />
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS & RESET ALL */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>
            <strong>Pro Tip:</strong> Changing these values updates the live public website for all visitors immediately.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-white px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
          >
            Reset All Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[#1e4d2b] hover:bg-[#163c22] text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Publishing..." : "Publish Banner"}
          </button>
        </div>
      </div>
    </div>
  );
}
