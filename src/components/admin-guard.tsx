import { useState, useEffect, ReactNode } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";

export const STAFF_PIN_STORAGE_KEY = "morning_bites_staff_auth";
export const DEFAULT_STAFF_PIN = "1234";

export function isStaffUnlocked(): boolean {
  try {
    return localStorage.getItem(STAFF_PIN_STORAGE_KEY) === "unlocked";
  } catch {
    return false;
  }
}

export function lockStaffPortal(): void {
  try {
    localStorage.removeItem(STAFF_PIN_STORAGE_KEY);
    window.location.href = "/";
  } catch {
    window.location.href = "/";
  }
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => isStaffUnlocked());
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setUnlocked(isStaffUnlocked());
  }, []);

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === DEFAULT_STAFF_PIN) {
      localStorage.setItem(STAFF_PIN_STORAGE_KEY, "unlocked");
      setUnlocked(true);
      setError("");
    } else {
      setError("Incorrect PIN. Please try again.");
      setTimeout(() => {
        setPin("");
      }, 500);
    }
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#faf5ee] flex flex-col items-center justify-center p-4 selection:bg-amber-200 selection:text-amber-900">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#e5d8c3] shadow-xl text-center space-y-6">
        
        {/* LOGO & BRAND */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-24 rounded-2xl bg-white p-2 flex items-center justify-center shadow-md border border-[#e5d8c3]">
            <img src="/morning-bites-logo.jpg" alt="Morning Bites Logo" className="w-full h-full object-contain" />
          </div>
          <div className="pt-1">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-serif font-bold text-[#e36414]">Morning</span>
              <span className="text-2xl font-serif font-black text-[#1e4d2b]">Bites</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">Staff & Admin Portal</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-slate-600">Enter your 4-digit staff PIN to access Billing, Subscriptions & Reports</p>
        </div>

        {/* 4 PIN DOTS */}
        <div className="flex justify-center gap-4 py-2">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > idx
                  ? "bg-[#1e4d2b] border-[#1e4d2b] scale-110"
                  : "border-slate-300 bg-slate-100"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 py-1.5 px-3 rounded-lg border border-red-200 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* NUMERIC KEYPAD */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto pt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-12 rounded-xl bg-slate-50 hover:bg-[#1e4d2b] hover:text-white border border-slate-200 font-bold text-lg text-slate-800 transition active:scale-95 shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-bold text-xs text-slate-600 transition active:scale-95 flex items-center justify-center"
          >
            Del
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress("0")}
            className="h-12 rounded-xl bg-slate-50 hover:bg-[#1e4d2b] hover:text-white border border-slate-200 font-bold text-lg text-slate-800 transition active:scale-95 shadow-sm"
          >
            0
          </button>
          <div className="flex items-center justify-center text-[10px] text-slate-400 font-bold">
            PIN: 1234
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1e4d2b] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Menu</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
