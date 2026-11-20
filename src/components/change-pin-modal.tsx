import { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";
import { updateStaffPin, updateMasterAdminPasscode } from "@/lib/auth-security";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ChangePinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePinModal({ open, onOpenChange }: ChangePinModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"pin" | "adminPasscode">("pin");

  // Staff PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // Master Admin Passcode state
  const [currentAdminPass, setCurrentAdminPass] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [confirmAdminPass, setConfirmAdminPass] = useState("");

  const [showSecrets, setShowSecrets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setCurrentAdminPass("");
    setNewAdminPass("");
    setConfirmAdminPass("");
    setError(null);
    setSuccessMessage(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleNumericInput = (val: string, setter: (v: string) => void) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    setter(clean);
    setError(null);
  };

  // Submit Staff PIN update
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentPin.length !== 4) {
      setError("Please enter your current 4-digit PIN.");
      return;
    }
    if (newPin.length !== 4) {
      setError("New PIN must be exactly 4 digits.");
      return;
    }
    if (newPin === currentPin) {
      setError("New PIN must be different from your current PIN.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PIN and Confirm PIN do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateStaffPin(currentPin, newPin);
      if (result.success) {
        setSuccessMessage("Staff PIN updated successfully!");
        toast({
          title: "PIN Changed Successfully",
          description: "Your new staff PIN is now active and protected with cryptographic hashing.",
        });
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(result.error || "Failed to change PIN. Please check current PIN.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while updating the PIN.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Master Admin Password update
  const handleAdminPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentAdminPass.trim()) {
      setError("Please enter the current Master Admin Password.");
      return;
    }
    if (!newAdminPass.trim() || newAdminPass.trim().length < 4) {
      setError("New Master Admin Password must be at least 4 characters.");
      return;
    }
    if (newAdminPass.trim() === currentAdminPass.trim()) {
      setError("New password must be different from the current password.");
      return;
    }
    if (newAdminPass !== confirmAdminPass) {
      setError("New Password and Confirm Password do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateMasterAdminPasscode(currentAdminPass, newAdminPass);
      if (result.success) {
        setSuccessMessage("Master Admin Password updated successfully!");
        toast({
          title: "Admin Password Updated",
          description: "Your master recovery password has been securely updated.",
        });
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(result.error || "Failed to update admin password. Check current password.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while updating the master password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-sm rounded-3xl p-6 sm:p-7 border-2 border-[#e5d8c3] bg-white shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#e36414] flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-6 h-6 text-[#1e4d2b]" />
          </div>
          <DialogTitle className="text-xl font-serif font-bold text-slate-800">
            Security & Passwords
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Manage your daily staff PIN and master owner recovery password.
          </DialogDescription>
        </DialogHeader>

        {/* TAB TOGGLE: STAFF PIN vs MASTER ADMIN PASSWORD */}
        <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold gap-1 mt-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("pin");
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "pin"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#1e4d2b]" />
            <span>Staff PIN</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("adminPasscode");
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "adminPasscode"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LockKeyhole className="w-3.5 h-3.5 text-amber-600" />
            <span>Master Password</span>
          </button>
        </div>

        {successMessage ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-[#1e4d2b] animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-[#1e4d2b]" />
            <p className="font-bold text-sm">{successMessage}</p>
            <p className="text-xs text-slate-500">All connected devices will use this updated credential.</p>
          </div>
        ) : activeTab === "pin" ? (
          /* TAB 1: CHANGE STAFF PIN (4-DIGIT) */
          <form onSubmit={handlePinSubmit} className="space-y-4 pt-1">
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Current PIN */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Current Staff PIN
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={currentPin}
                onChange={e => handleNumericInput(e.target.value, setCurrentPin)}
                placeholder="••••"
                className="w-full text-center text-lg tracking-[0.4em] font-mono h-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e4d2b] font-bold text-slate-800 transition"
                autoComplete="off"
              />
            </div>

            {/* New PIN */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                New 4-Digit PIN
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={newPin}
                onChange={e => handleNumericInput(e.target.value, setNewPin)}
                placeholder="••••"
                className="w-full text-center text-lg tracking-[0.4em] font-mono h-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e4d2b] font-bold text-slate-800 transition"
                autoComplete="off"
              />
            </div>

            {/* Confirm New PIN */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Confirm New PIN
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={confirmPin}
                onChange={e => handleNumericInput(e.target.value, setConfirmPin)}
                placeholder="••••"
                className="w-full text-center text-lg tracking-[0.4em] font-mono h-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e4d2b] font-bold text-slate-800 transition"
                autoComplete="off"
              />
            </div>

            {/* Show/Hide Toggle */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer font-medium"
              >
                {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showSecrets ? "Hide Digits" : "Show Digits"}</span>
              </button>
              <span className="text-[10px] text-slate-400 font-semibold">4 Digits Required</span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
                className="flex-1 h-11 rounded-xl bg-[#1e4d2b] hover:bg-[#163c22] text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Save PIN</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* TAB 2: CHANGE MASTER ADMIN PASSWORD */
          <form onSubmit={handleAdminPassSubmit} className="space-y-4 pt-1">
            <p className="text-[11px] text-slate-500 leading-normal bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80">
              The <strong>Master Admin Password</strong> is your emergency override password to reset the staff PIN if forgotten.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Current Admin Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Current Admin Password
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                value={currentAdminPass}
                onChange={e => {
                  setCurrentAdminPass(e.target.value);
                  setError(null);
                }}
                placeholder="Enter current master password"
                className="w-full px-3 text-sm h-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e4d2b] font-medium text-slate-800 transition"
                autoComplete="off"
              />
            </div>

            {/* New Admin Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                New Admin Password
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                value={newAdminPass}
                onChange={e => {
                  setNewAdminPass(e.target.value);
                  setError(null);
                }}
                placeholder="At least 4 characters"
                className="w-full px-3 text-sm h-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e4d2b] font-medium text-slate-800 transition"
                autoComplete="off"
              />
            </div>

            {/* Confirm New Admin Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Confirm New Admin Password
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                value={confirmAdminPass}
                onChange={e => {
                  setConfirmAdminPass(e.target.value);
                  setError(null);
                }}
                placeholder="Re-enter new admin password"
                className="w-full px-3 text-sm h-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e4d2b] font-medium text-slate-800 transition"
                autoComplete="off"
              />
            </div>

            {/* Show/Hide Toggle */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer font-medium"
              >
                {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showSecrets ? "Hide Passwords" : "Show Passwords"}</span>
              </button>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !currentAdminPass.trim() || !newAdminPass.trim() || !confirmAdminPass.trim()}
                className="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <LockKeyhole className="w-3.5 h-3.5" />
                    <span>Save Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
