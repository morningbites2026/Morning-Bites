import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { isStaffUnlocked } from "@/components/admin-guard";
import {
  fetchRemoteBannerSettings,
  getLocalBannerSettings,
  DEFAULT_BANNER_IMAGE,
  DEFAULT_BANNER_BADGE,
  DEFAULT_BANNER_TITLE,
  DEFAULT_BANNER_TEXT,
  BannerSettings,
} from "@/lib/banner-settings";
import {
  getLocalPublicConfig,
  fetchRemotePublicConfig,
  isMenuItemShownOnPublic,
  cleanPhoneNumber,
  PublicSiteConfig,
} from "@/lib/public-settings";
import {
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Edit3,
  Globe,
} from "lucide-react";
import { InstagramIcon, FacebookIcon } from "@/components/social-icons";

const DAY_LABELS: Record<number, string> = {
  0: "Monday",
  1: "Tuesday",
  2: "Wednesday",
  3: "Thursday",
  4: "Friday",
  5: "Saturday",
  6: "Sunday"
};

// Fallback verified menu items from printed card if DB is loading or empty
const FALLBACK_REGULAR = [
  { name: "Sprouts Salad", option: "1 Plate", desc: "Fresh sprouted green moong and brown chana loaded with crunchy cucumber, tomatoes, and zesty lemon dressing." },
  { name: "Thepla", option: "3 Piece", desc: "Classic soft and fragrant Gujarati methi thepla rolled fresh on cast iron tawa." },
  { name: "Sev Paratha", option: "Ghee, 1 Piece", desc: "Kathiyawadi signature stuffed with spicy Ratlami sev, chopped onions, and roasted in pure ghee." },
  { name: "Butter Thepla", option: "3 Piece", desc: "Tawa fresh methi thepla generously roasted with fresh butter." },
  { name: "Butter Sev Paratha", option: "1 Piece", desc: "Spiced sev paratha crisped with fresh table butter." },
  { name: "Masala Paratha", option: "2 Piece", desc: "Flaky, multi-layered spiced tawa paratha seasoned with ajwain and cumin." },
  { name: "Tea", option: "Special Morning Chai", desc: "Freshly brewed hot aromatic ginger-cardamom tea." },
  { name: "Butter Masala Paratha", option: "2 Piece", desc: "Golden layered masala paratha crisped with dollops of butter." },
];

const FALLBACK_SPECIALS = [
  { name: "Handvo", day: "Monday", option: "Monday Special", desc: "Traditional savory baked lentil & vegetable cake with crackling mustard and sesame seed tempering." },
  { name: "Aloo Paratha", day: "Wednesday", option: "Wednesday", desc: "Golden, crispy paratha generously stuffed with spiced mashed potato filling." },
  { name: "Vedmi", day: "Friday", option: "Friday, 1 Piece", desc: "Authentic Gujarati sweet Puran Poli with rich jaggery-dal filling and pure desi ghee." },
  { name: "Butter Aloo Paratha", day: "Wednesday", option: "Wednesday", desc: "Spiced potato paratha roasted to a crisp with fresh butter." },
];

export default function PublicSite() {
  const { menuItems } = useStore();
  const staffUnlocked = isStaffUnlocked();

  const [bannerSettings, setBannerSettings] = useState<BannerSettings>(() => getLocalBannerSettings());
  const [publicConfig, setPublicConfig] = useState<PublicSiteConfig>(() => getLocalPublicConfig());

  useEffect(() => {
    let mounted = true;
    fetchRemoteBannerSettings().then(remote => {
      if (mounted) setBannerSettings(remote);
    });
    fetchRemotePublicConfig().then(cfg => {
      if (mounted) setPublicConfig(cfg);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Designated WhatsApp number & links
  const whatsAppPhone = publicConfig.phones.find(p => p.isWhatsApp) || publicConfig.phones[0];
  const whatsAppNumberClean = whatsAppPhone ? cleanPhoneNumber(whatsAppPhone.number) : "919099172237";
  const whatsAppOrderUrl = `https://wa.me/${whatsAppNumberClean}?text=${encodeURIComponent("Hi Morning Bites, I want to order fresh breakfast!")}`;
  const phonesDisplay = publicConfig.phones.map(p => p.number).filter(Boolean).join(" / ") || "9099172237 / 9429929822";

  const hasCustomImage = Boolean(bannerSettings.imageUrl && bannerSettings.imageUrl.trim().length > 0);
  const hasCustomText = Boolean(bannerSettings.text && bannerSettings.text.trim().length > 0);
  const hasCustomTitle = Boolean(bannerSettings.title && bannerSettings.title.trim().length > 0);
  const hasCustomBadge = Boolean(bannerSettings.badge && bannerSettings.badge.trim().length > 0);

  // Fallback Logic:
  // If no image is set -> show default logo
  const bannerImage = hasCustomImage ? bannerSettings.imageUrl.trim() : DEFAULT_BANNER_IMAGE;
  // If no text is set -> show suggested default text
  const bannerText = hasCustomText ? bannerSettings.text.trim() : DEFAULT_BANNER_TEXT;
  const bannerTitle = hasCustomTitle ? bannerSettings.title.trim() : DEFAULT_BANNER_TITLE;
  const bannerBadge = hasCustomBadge ? bannerSettings.badge.trim() : DEFAULT_BANNER_BADGE;

  // Dynamic Regular Items from Supabase (is_active === true and category === 'daily' and enabled on public site)
  const regularMenuItems = useMemo(() => {
    const fromDb = (menuItems || []).filter(
      m => (m?.category || "daily") === "daily" && m?.is_active && isMenuItemShownOnPublic(m.id, publicConfig.publicMenuIds)
    );
    if (!fromDb || fromDb.length === 0) return FALLBACK_REGULAR;
    return fromDb.map(item => {
      let optionText = "1 Serving";
      if (Array.isArray(item?.options) && item.options.length > 0) {
        const validOptions = item.options
          .map((o: any) => (typeof o === "string" ? o : (o && typeof o.name === "string" ? o.name : "")))
          .filter((n: string) => n.trim().length > 0 && n.trim().toLowerCase() !== "regular");
        if (validOptions.length > 0) {
          optionText = validOptions.join(" / ");
        }
      }
      return {
        name: item?.name || "Menu Item",
        option: optionText,
        desc: item?.description || "Prepared fresh every morning with clean ingredients and homemade taste."
      };
    });
  }, [menuItems, publicConfig.publicMenuIds]);

  // Dynamic Specials from Supabase (is_active === true and category === 'week_special' and enabled on public site)
  const specialMenuItems = useMemo(() => {
    const fromDb = (menuItems || []).filter(
      m => (m?.category || "daily") === "week_special" && m?.is_active && isMenuItemShownOnPublic(m.id, publicConfig.publicMenuIds)
    );
    if (!fromDb || fromDb.length === 0) return FALLBACK_SPECIALS;
    return fromDb.map(item => {
      const daysText = Array.isArray(item?.week_days)
        ? item.week_days
            .map((d: any) => DAY_LABELS[Number(d)] || (typeof d === "string" ? d : ""))
            .filter(Boolean)
            .join(", ") || "Special"
        : "Special";
      let optionText = daysText;
      if (Array.isArray(item?.options) && item.options.length > 0) {
        const validOptions = item.options
          .map((o: any) => (typeof o === "string" ? o : (o && typeof o.name === "string" ? o.name : "")))
          .filter((n: string) => n.trim().length > 0 && n.trim().toLowerCase() !== "regular");
        if (validOptions.length > 0) {
          optionText = validOptions.join(" / ");
        }
      }
      return {
        name: item?.name || "Special Delicacy",
        day: daysText,
        option: optionText,
        desc: item?.description || "Authentic regional delicacy prepared on specific days of the week."
      };
    });
  }, [menuItems, publicConfig.publicMenuIds]);

  return (
    <div className="min-h-screen bg-[#faf5ee] text-[#3b1e08] font-sans antialiased selection:bg-amber-200 selection:text-amber-900">
      
      {/* STAFF ACTIVE BANNER (ONLY VISIBLE IF STAFF PIN IS ALREADY ENTERED ON THIS DEVICE) */}
      {staffUnlocked && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-0 z-[60] shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Staff session active on this browser</span>
          </div>
          <Link
            href="/dashboard"
            className="bg-amber-950 text-white px-3 py-1 rounded-full text-[11px] font-extrabold hover:bg-black transition"
          >
            Open Dashboard &rarr;
          </Link>
        </div>
      )}

      {/* TOP ANNOUNCEMENT BAR */}
      <div className="bg-[#1e4d2b] text-[#faf5ee] text-xs py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2 shadow-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span>Akota, Vadodara • Fresh Breakfast & Daily Salad Subscriptions • <strong>6:30 AM – 9:00 AM</strong></span>
        <span className="hidden md:inline text-amber-200">|</span>
        <a href={whatsAppOrderUrl} target="_blank" rel="noreferrer" className="hidden md:inline font-bold underline hover:text-amber-300 transition">
          Order via WhatsApp &rarr;
        </a>
      </div>

      {/* NAVIGATION HEADER */}
      <header className="sticky top-0 z-50 bg-[#faf5ee]/95 backdrop-blur-md border-b-2 border-[#e5d8c3] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          
          {/* LOGO */}
          <a href="#menu-card" className="flex items-center gap-3 group">
            <img
              src="/morning-bites-logo.jpg"
              alt="Morning Bites Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-2xl group-hover:scale-105 transition-transform bg-white p-1 border border-[#e5d8c3] shadow-sm"
            />
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold font-serif text-[#e36414] leading-none">Morning</span>
                <span className="text-xl sm:text-2xl font-black font-serif text-[#1e4d2b] leading-none">Bites</span>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#1e4d2b] block mt-0.5">Healthy Start, Happy Heart!</span>
            </div>
          </a>

          {/* NAV LINKS */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-[#3b1e08]">
            <a href="#menu-card" className="hover:text-[#e36414] transition">Menu</a>
            <a href="#day-specials" className="hover:text-[#e36414] transition">Day Specials</a>
            <a href="#subscriptions" className="hover:text-[#e36414] transition">Salad Subscriptions</a>
            <a href="#location" className="hover:text-[#e36414] transition">Location</a>
          </nav>

          {/* ACTIONS & SOCIAL */}
          <div className="flex items-center gap-2.5">
            {publicConfig.social.instagram?.trim() && (
              <a
                href={publicConfig.social.instagram}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 hidden sm:flex items-center justify-center transition shadow-xs"
                title="Follow us on Instagram"
              >
                <InstagramIcon className="w-4 h-4" />
              </a>
            )}
            {publicConfig.social.facebook?.trim() && (
              <a
                href={publicConfig.social.facebook}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hidden sm:flex items-center justify-center transition shadow-xs"
                title="Follow us on Facebook"
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
            )}
            <a
              href={whatsAppOrderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#1e4d2b] hover:bg-[#163c22] text-[#faf5ee] font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-full shadow-md transition transform hover:-translate-y-0.5"
            >
              <MessageCircle className="w-4 h-4 text-green-400" />
              <span>Order Now</span>
            </a>
          </div>
        </div>
      </header>

      {/* HERO BANNER - 50/50 COMPONENT (LEFT: IMAGE / LOGO, RIGHT: TEXT / ANNOUNCEMENT) */}
      <section className="py-8 sm:py-14 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            
            {/* LEFT SIDE (50%): BANNER / OCCASION IMAGE (FALLBACK TO LOGO) */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl p-4 sm:p-6 border-2 border-[#e5d8c3] shadow-xl group hover:shadow-2xl transition-all duration-300 flex items-center justify-center min-h-[260px] sm:min-h-[320px] max-h-[420px] overflow-hidden">
                <img
                  src={bannerImage}
                  alt={bannerTitle}
                  className="w-full h-auto max-h-[360px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
                  }}
                />
              </div>

              {/* Staff Edit Shortcut */}
              {staffUnlocked && (
                <div className="mt-2.5">
                  <Link
                    href="/banner"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full border border-amber-300 transition shadow-xs"
                  >
                    <Edit3 className="w-3 h-3 text-amber-700" />
                    <span>Edit Banner in Admin</span>
                  </Link>
                </div>
              )}
            </div>

            {/* RIGHT SIDE (50%): BANNER TEXT / ANNOUNCEMENT (FALLBACK TO DEFAULT TEXT) */}
            <div className="flex flex-col justify-center space-y-4 text-center md:text-left">
              <div>
                <span className="inline-flex items-center gap-1.5 bg-[#f4ebe1] border border-[#d6c4ae] px-4 py-1.5 rounded-full text-xs font-bold text-[#3b1e08] shadow-xs">
                  {bannerBadge}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-serif text-[#3b1e08] leading-[1.15]">
                {bannerTitle}
              </h1>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line max-w-xl">
                {bannerText}
              </p>

              {/* Location pill */}
              <div className="pt-1 flex justify-center md:justify-start">
                <div className="inline-flex items-center gap-2 bg-[#f4ebe1] border border-[#d6c4ae] px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#3b1e08]">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Akota Garden, Near Radha Krishna Circle, Akota, Vadodara</span>
                </div>
              </div>

              {/* Highlight chips */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1 text-xs font-bold text-slate-700">
                <span className="bg-white/90 border border-[#e5d8c3] px-3 py-1.5 rounded-full shadow-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" /> 6:30 AM – 9:00 AM Delivery
                </span>
                <span className="bg-white/90 border border-[#e5d8c3] px-3 py-1.5 rounded-full shadow-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> 100% Pure Veg & Clean
                </span>
                <span className="bg-white/90 border border-[#e5d8c3] px-3 py-1.5 rounded-full shadow-xs flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-700" /> {phonesDisplay}
                </span>
              </div>

              {/* Order WhatsApp button */}
              <div className="pt-2 flex justify-center md:justify-start">
                <a
                  href={whatsAppOrderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-[#1e4d2b] hover:bg-[#163c22] text-[#faf5ee] font-bold text-sm px-6 py-3 rounded-full shadow-md transition transform hover:-translate-y-0.5"
                >
                  <MessageCircle className="w-4 h-4 text-green-400" />
                  <span>Order via WhatsApp &rarr;</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* MAIN MENU SHOWCASE CARD (NO PRICES DISPLAYED) */}
      <section id="menu-card" className="py-8 sm:py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          
          <div className="bg-[#faf5ee] border-[3px] border-[#3b1e08] shadow-[inset_0_0_0_4px_#faf5ee,inset_0_0_0_5px_#c59b27,0_10px_25px_-5px_rgba(59,30,8,0.15)] rounded-3xl p-6 sm:p-10 md:p-12 relative overflow-hidden">
            
            {/* CORNER ORNAMENTS */}
            <div className="absolute top-3 left-3 text-2xl text-amber-600 opacity-80 select-none">❧</div>
            <div className="absolute top-3 right-3 text-2xl text-amber-600 opacity-80 select-none">☙</div>
            <div className="absolute bottom-3 left-3 text-2xl text-amber-600 opacity-80 select-none">❧</div>
            <div className="absolute bottom-3 right-3 text-2xl text-amber-600 opacity-80 select-none">☙</div>

            {/* MENU TITLE */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3">
                <span className="h-[1.5px] w-12 bg-gradient-to-r from-transparent to-[#1e4d2b]"></span>
                <span className="text-[#1e4d2b] text-xl">❀</span>
                <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-[#1e4d2b] tracking-wide inline-block">Menu</h2>
                <span className="text-[#1e4d2b] text-xl">❀</span>
                <span className="h-[1.5px] w-12 bg-gradient-to-l from-transparent to-[#1e4d2b]"></span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Fresh Daily Preparation</p>
            </div>

            {/* REGULAR ITEMS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {regularMenuItems.map((item, idx) => (
                <div key={idx} className="border-b-[1.5px] border-dashed border-[#3b1e08]/25 pb-3 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#3b1e08]">{item.name}</h3>
                    {item.option && (
                      <span className="text-xs text-amber-800 font-semibold block">({item.option})</span>
                    )}
                  </div>
                  <a
                    href={`https://wa.me/919099172237?text=${encodeURIComponent(`Hi Morning Bites, I would like to order ${item.name}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#1e4d2b] bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-full transition shrink-0"
                  >
                    Order &rarr;
                  </a>
                </div>
              ))}
            </div>

            {/* DAY SPECIAL SECTION */}
            <div className="text-center mt-12 mb-8" id="day-specials">
              <div className="flex items-center justify-center gap-3">
                <span className="h-[1.5px] w-12 bg-gradient-to-r from-transparent to-[#1e4d2b]"></span>
                <span className="text-[#1e4d2b] text-xl">❀</span>
                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#1e4d2b] tracking-wide inline-block">Day Special</h2>
                <span className="text-[#1e4d2b] text-xl">❀</span>
                <span className="h-[1.5px] w-12 bg-gradient-to-l from-transparent to-[#1e4d2b]"></span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Special delicacies rotated across days of the week</p>
            </div>

            {/* DAY SPECIALS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {specialMenuItems.map((item, idx) => (
                <div key={idx} className="border-b-[1.5px] border-dashed border-[#3b1e08]/25 pb-3 flex items-center justify-between gap-4 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-lg text-[#3b1e08]">{item.name}</h3>
                      {item.day && (
                        <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {item.day}
                        </span>
                      )}
                    </div>
                    {item.option && item.option !== item.day && (
                      <span className="text-xs text-amber-900 font-semibold block">({item.option})</span>
                    )}
                  </div>
                  <a
                    href={`https://wa.me/919099172237?text=${encodeURIComponent(`Hi Morning Bites, I would like to pre-order ${item.name} (${item.day || "Day Special"})`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#1e4d2b] bg-white border border-emerald-300 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition shadow-sm shrink-0"
                  >
                    Pre-order &rarr;
                  </a>
                </div>
              ))}
            </div>

            {/* FOOTER BAR */}
            <div className="mt-12 pt-6 border-t-2 border-[#1e4d2b]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#1e4d2b]">
                <MessageCircle className="w-5 h-5 text-emerald-700" />
                <a href="https://wa.me/919099172237" target="_blank" rel="noreferrer" className="hover:underline">9099172237</a>
                <span>/</span>
                <a href="https://wa.me/919429929822" target="_blank" rel="noreferrer" className="hover:underline">9429929822</a>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#3b1e08]">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span>Akota Garden, Near Radha Krishna Circle, Akota, Vadodara</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SALAD SUBSCRIPTIONS SECTION (NO PRICES DISPLAYED) */}
      <section id="subscriptions" className="py-16 bg-white border-t border-[#e5d8c3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#1e4d2b] uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full">
              Healthy Morning Routines
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-[#3b1e08] mt-3">
              10-Meal Salad Subscriptions
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Hassle-free healthy breakfast delivered directly to your doorstep before 9:00 AM. Choose your schedule and skip any morning when you travel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* SPROUTS SALAD PACK */}
            <div className="bg-[#faf5ee] rounded-3xl p-8 border-2 border-[#e5d8c3] flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#1e4d2b] flex items-center justify-center text-2xl mb-4">
                  🌱
                </div>
                <h3 className="text-xl font-bold font-serif text-[#3b1e08]">Sprouts Salad Pack</h3>
                <p className="text-xs text-emerald-800 font-bold uppercase tracking-wider mt-1">10 Fresh Deliveries</p>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  Fresh sprouted green moong and brown chana loaded with crunchy cucumber, tomatoes, pomegranate, and lemon-herb seasoning.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-600 my-6">
                  <li className="flex items-center gap-2"><span>✓</span> 10 Meals package (Small or Full plate)</li>
                  <li className="flex items-center gap-2"><span>✓</span> High protein & clean morning energy</li>
                  <li className="flex items-center gap-2"><span>✓</span> Choose your preferred delivery days</li>
                  <li className="flex items-center gap-2"><span>✓</span> Free morning skips before 6:00 AM</li>
                </ul>
              </div>
              <a
                href={`https://wa.me/${whatsAppNumberClean}?text=${encodeURIComponent("Hi Morning Bites, please share details for the Sprouts Salad 10-Meal Subscription")}`}
                target="_blank"
                rel="noreferrer"
                className="w-full text-center bg-[#1e4d2b] hover:bg-[#163c22] text-[#faf5ee] font-bold text-xs py-3.5 rounded-xl transition shadow"
              >
                Inquire Subscription &rarr;
              </a>
            </div>

            {/* ROTATING COMBO PACK */}
            <div className="bg-gradient-to-b from-[#1e4d2b] to-[#12361d] text-[#faf5ee] rounded-3xl p-8 border-2 border-amber-400 shadow-xl flex flex-col justify-between relative transform md:-translate-y-2">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-[#3b1e08] font-black text-[10px] uppercase tracking-wider px-3.5 py-1 rounded-full shadow">
                Customer Favorite
              </div>
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center text-2xl mb-4">
                  ✨
                </div>
                <h3 className="text-2xl font-bold font-serif text-white">Rotating Combo Pack</h3>
                <p className="text-xs text-amber-300 font-bold uppercase tracking-wider mt-1">Sprouts & Chickpea Alternate</p>
                <p className="text-xs text-emerald-100 mt-3 leading-relaxed">
                  Never get bored! Alternate between fresh Sprouts Salad and crunchy Chickpea bowls on each delivery day in a seamless rotating sequence.
                </p>
                <ul className="space-y-2.5 text-xs text-emerald-100 my-6">
                  <li className="flex items-center gap-2"><span>✨</span> Alternating fresh salad variety</li>
                  <li className="flex items-center gap-2"><span>✨</span> Choose your starting salad option</li>
                  <li className="flex items-center gap-2"><span>✨</span> 10 Meals total with zero expiration</li>
                  <li className="flex items-center gap-2"><span>✨</span> Doorstep delivery across Akota</li>
                </ul>
              </div>
              <a
                href={`https://wa.me/${whatsAppNumberClean}?text=${encodeURIComponent("Hi Morning Bites, please share details for the Rotating Combo Salad Pack")}`}
                target="_blank"
                rel="noreferrer"
                className="w-full text-center bg-amber-400 hover:bg-amber-300 text-[#3b1e08] font-black text-xs py-3.5 rounded-xl transition shadow-lg"
              >
                Start Combo Subscription &rarr;
              </a>
            </div>

            {/* THEPLA & BREAKFAST BUNDLES */}
            <div className="bg-[#fafafee] rounded-3xl p-8 border-2 border-[#e5d8c3] flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-4">
                  🫓
                </div>
                <h3 className="text-xl font-bold font-serif text-[#3b1e08]">Office & Family Packs</h3>
                <p className="text-xs text-amber-800 font-bold uppercase tracking-wider mt-1">Bulk & Group Orders</p>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  Hosting an office morning meeting, society event, or family gathering? Pre-order authentic Methi Theplas, Ghee Parathas, and Vedmi in bulk.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-600 my-6">
                  <li className="flex items-center gap-2"><span>✓</span> Hot tawa fresh Theplas & Parathas</li>
                  <li className="flex items-center gap-2"><span>✓</span> Hygienic food-grade group packaging</li>
                  <li className="flex items-center gap-2"><span>✓</span> Served with pickle, curd & butter</li>
                  <li className="flex items-center gap-2"><span>✓</span> Customized quantities on demand</li>
                </ul>
              </div>
              <a
                href={`https://wa.me/${whatsAppNumberClean}?text=${encodeURIComponent("Hi Morning Bites, I want to inquire about Office/Bulk Breakfast orders")}`}
                target="_blank"
                rel="noreferrer"
                className="w-full text-center bg-[#1e4d2b] hover:bg-[#163c22] text-[#faf5ee] font-bold text-xs py-3.5 rounded-xl transition shadow"
              >
                Inquire Bulk Order &rarr;
              </a>
            </div>

          </div>

        </div>
      </section>

      {/* LOCATION & SOCIAL PRESENCE SECTION */}
      <section id="location" className="py-14 bg-[#faf5ee] border-t border-[#e5d8c3]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#3b1e08]">Visit Us at Akota Garden</h2>
            <p className="text-sm text-slate-600 font-medium">
              Akota Garden, Near Radha Krishna Circle, Akota, Vadodara, Gujarat
            </p>
            <p className="text-xs text-[#1e4d2b] font-bold">
              Morning Hours: 6:30 AM to 9:00 AM (Monday – Saturday)
            </p>
          </div>

          {/* DYNAMIC SOCIAL & LOCATION BUTTONS (ONLY DISPLAY IF CONFIGURED IN ADMIN) */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {publicConfig.social.googleMaps?.trim() && (
              <a
                href={publicConfig.social.googleMaps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-white text-[#3b1e08] border border-slate-300 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm"
              >
                <MapPin className="w-4 h-4 text-red-600" />
                <span>Get Directions</span>
              </a>
            )}
            {publicConfig.social.googlePage?.trim() && (
              <a
                href={publicConfig.social.googlePage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-white text-[#3b1e08] border border-slate-300 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm"
              >
                <Globe className="w-4 h-4 text-amber-600" />
                <span>Google Reviews</span>
              </a>
            )}
            {publicConfig.social.instagram?.trim() && (
              <a
                href={publicConfig.social.instagram}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-pink-50 text-pink-800 border border-pink-200 text-xs font-bold px-4 py-2 rounded-xl hover:bg-pink-100 transition shadow-xs"
              >
                <InstagramIcon className="w-4 h-4 text-pink-600" />
                <span>Instagram</span>
              </a>
            )}
            {publicConfig.social.facebook?.trim() && (
              <a
                href={publicConfig.social.facebook}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-100 transition shadow-xs"
              >
                <FacebookIcon className="w-4 h-4 text-blue-600" />
                <span>Facebook</span>
              </a>
            )}
            {publicConfig.phones.map(p => (
              <a
                key={p.id}
                href={`tel:${p.number.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-2 bg-white text-[#3b1e08] border border-slate-300 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-50 transition shadow-sm"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>Call: {p.number} {p.label ? `(${p.label})` : ""}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#241305] text-[#e5d8c3] py-10 border-t-4 border-[#1e4d2b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/10 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <img
                src="/morning-bites-logo.jpg"
                alt="Morning Bites Logo"
                className="w-12 h-12 object-contain rounded-xl bg-white p-1 shrink-0"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-serif font-bold text-amber-400">Morning</span>
                  <span className="text-xl font-serif font-bold text-emerald-400">Bites</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Healthy Start, Happy Heart! • Akota, Vadodara</p>
              </div>
            </div>

            {/* DYNAMIC SOCIAL ICONS IN FOOTER (ONLY RENDER IF LINK IS SET) */}
            <div className="flex items-center gap-2.5">
              {publicConfig.social.googleMaps?.trim() && (
                <a
                  href={publicConfig.social.googleMaps}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#e5d8c3] hover:text-white flex items-center justify-center transition"
                  title="Google Maps Location"
                >
                  <MapPin className="w-4 h-4 text-red-400" />
                </a>
              )}
              {publicConfig.social.googlePage?.trim() && (
                <a
                  href={publicConfig.social.googlePage}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#e5d8c3] hover:text-white flex items-center justify-center transition"
                  title="Google Business & Reviews"
                >
                  <Globe className="w-4 h-4 text-amber-400" />
                </a>
              )}
              {publicConfig.social.instagram?.trim() && (
                <a
                  href={publicConfig.social.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#e5d8c3] hover:text-white flex items-center justify-center transition"
                  title="Instagram"
                >
                  <InstagramIcon className="w-4 h-4 text-pink-400" />
                </a>
              )}
              {publicConfig.social.facebook?.trim() && (
                <a
                  href={publicConfig.social.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#e5d8c3] hover:text-white flex items-center justify-center transition"
                  title="Facebook"
                >
                  <FacebookIcon className="w-4 h-4 text-blue-400" />
                </a>
              )}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
            <p>&copy; 2026 Morning Bites. All rights reserved.</p>
            <p className="mt-2 sm:mt-0">Akota Garden, Near Radha Krishna Circle, Akota, Vadodara</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
