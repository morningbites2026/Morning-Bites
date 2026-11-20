import { useState, useEffect, ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, AlertCircle, ShieldAlert, KeyRound, Lock, CheckCircle2 } from "lucide-react";
import {
  isStaffUnlocked,
  lockStaffPortal,
  verifyPinAttempt,
  getLockoutState,
  resetPinWithAdminPasscode,
} from "@/lib/auth-security";

export { isStaffUnlocked, lockStaffPortal };

export function AdminGuard({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => isStaffUnlocked());
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  
  // Emergency Recovery Modal State
  const [showRecovery, setShowRecovery] = useState<boolean>(false);
  const [recoveryPasscode, setRecoveryPasscode] = useState<string>("");
  const [recoveryError, setRecoveryError] = useState<string>("");
  const [recoverySuccess, setRecoverySuccess] = useState<boolean>(false);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  // Check lockout on mount and tick countdown
  useEffect(() => {
    const checkState = () => {
      const state = getLockoutState();
      if (state.isLocked && state.remainingSeconds > 0) {
        setLockoutSeconds(state.remainingSeconds);
      } else {
        setLockoutSeconds(0);
      }
    };

    checkState();
    const interval = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isLockedOut = lockoutSeconds > 0;

  const handleKeypadPress = (digit: string) => {
    if (isLockedOut || isVerifying) return;

    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        performVerification(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLockedOut || isVerifying) return;
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const performVerification = async (enteredPin: string) => {
    setIsVerifying(true);
    try {
      const result = await verifyPinAttempt(enteredPin);
      if (result.success) {
        setUnlocked(true);
        setError("");
        setPin("");
      } else {
        if (result.isLocked && result.remainingSeconds) {
          setLockoutSeconds(result.remainingSeconds);
        }
        setError(result.error || "Incorrect PIN. Please try again.");
        setTimeout(() => {
          setPin("");
        }, 500);
      }
    } catch {
      setError("Verification failed. Please check connection.");
      setTimeout(() => {
        setPin("");
      }, 500);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdminRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");
    setIsRecovering(true);
    try {
      const result = await resetPinWithAdminPasscode(recoveryPasscode);
      if (result.success) {
        setRecoverySuccess(true);
        setTimeout(() => {
          setShowRecovery(false);
          setUnlocked(true);
        }, 1500);
      } else {
        setRecoveryError(result.error || "Invalid Admin Passcode.");
      }
    } catch (err: any) {
      setRecoveryError(err?.message || "Recovery failed.");
    } finally {
      setIsRecovering(false);
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
          <p className="text-xs text-slate-600 font-medium">
            Enter 4-digit staff PIN to access Billing, Subscriptions & Reports
          </p>
        </div>

        {/* 4 PIN DOTS */}
        <div className="flex justify-center gap-4 py-2">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                pin.length > idx
                  ? "bg-[#1e4d2b] border-[#1e4d2b] scale-110 shadow-sm"
                  : "border-slate-300 bg-slate-100"
              }`}
            />
          ))}
        </div>

        {/* LOCKOUT OR ERROR BANNER */}
        {isLockedOut ? (
          <div className="flex flex-col items-center justify-center gap-1 text-xs font-bold text-red-700 bg-red-50 py-2.5 px-3 rounded-xl border border-red-300 animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
              <span>Anti-Brute Force Lockout Active</span>
            </div>
            <span className="text-red-900 font-mono text-sm">
              Wait: {lockoutSeconds}s
            </span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 py-2 px-3 rounded-lg border border-red-200 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : isVerifying ? (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-1">
            <span className="w-3.5 h-3.5 border-2 border-[#1e4d2b] border-t-transparent rounded-full animate-spin" />
            <span>Verifying cryptographic hash...</span>
          </div>
        ) : (
          <div className="h-6" />
        )}

        {/* NUMERIC KEYPAD */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
            <button
              key={num}
              type="button"
              disabled={isLockedOut || isVerifying}
              onClick={() => handleKeypadPress(num)}
              className="h-12 rounded-xl bg-slate-50 hover:bg-[#1e4d2b] hover:text-white border border-slate-200 font-bold text-lg text-slate-800 transition active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isLockedOut || isVerifying || pin.length === 0}
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-bold text-xs text-slate-600 transition active:scale-95 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Del
          </button>
          <button
            type="button"
            disabled={isLockedOut || isVerifying}
            onClick={() => handleKeypadPress("0")}
            className="h-12 rounded-xl bg-slate-50 hover:bg-[#1e4d2b] hover:text-white border border-slate-200 font-bold text-lg text-slate-800 transition active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            className="flex items-center justify-center text-[10px] text-slate-400 hover:text-amber-800 font-bold underline cursor-pointer"
            title="Reset forgotten PIN using Admin Passcode"
          >
            Forgot?
          </button>
        </div>

        {/* LINKS */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1e4d2b] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Menu</span>
          </Link>
          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#1e4d2b]" /> PBKDF2 Secure
          </span>
        </div>
      </div>

      {/* EMERGENCY RECOVERY MODAL */}
      {showRecovery && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border-2 border-[#e5d8c3] shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold font-serif text-slate-800">Admin PIN Recovery</h3>
              <p className="text-xs text-slate-500">
                Enter your Master Admin Passcode to reset the staff PIN back to default (1234).
              </p>
            </div>

            {recoverySuccess ? (
              <div className="py-4 text-center space-y-2 text-[#1e4d2b]">
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <p className="font-bold text-sm">PIN Reset Successfully!</p>
                <p className="text-xs text-slate-500">The PIN has been restored to default (1234). Unlocking now...</p>
              </div>
            ) : (
              <form onSubmit={handleAdminRecovery} className="space-y-3">
                {recoveryError && (
                  <div className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {recoveryError}
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                    Master Admin Passcode
                  </label>
                  <input
                    type="password"
                    value={recoveryPasscode}
                    onChange={e => setRecoveryPasscode(e.target.value)}
                    placeholder="Enter admin passcode"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#1e4d2b] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecovery(false);
                      setRecoveryError("");
                      setRecoveryPasscode("");
                    }}
                    disabled={isRecovering}
                    className="flex-1 h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRecovering || !recoveryPasscode.trim()}
                    className="flex-1 h-10 rounded-xl bg-[#1e4d2b] hover:bg-[#163c22] text-white text-xs font-bold transition shadow disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isRecovering ? "Resetting..." : "Reset PIN"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
