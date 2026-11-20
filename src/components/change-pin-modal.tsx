import { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { updateStaffPin } from "@/lib/auth-security";
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
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError(null);
    setSuccess(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        setSuccess(true);
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

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-sm rounded-3xl p-6 sm:p-7 border-2 border-[#e5d8c3] bg-white shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#e36414] flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-6 h-6 text-[#1e4d2b]" />
          </div>
          <DialogTitle className="text-xl font-serif font-bold text-slate-800">
            Change Staff PIN
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Secure your portal. The PIN is salted and hashed using PBKDF2 (100k rounds) to prevent hacking.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-[#1e4d2b] animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-[#1e4d2b]" />
            <p className="font-bold text-sm">PIN Updated Successfully!</p>
            <p className="text-xs text-slate-500">All connected devices will now require the new PIN.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Current PIN */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Current PIN
              </label>
              <div className="relative">
                <input
                  type={showPins ? "text" : "password"}
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
            </div>

            {/* New PIN */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                New 4-Digit PIN
              </label>
              <div className="relative">
                <input
                  type={showPins ? "text" : "password"}
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
            </div>

            {/* Confirm New PIN */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Confirm New PIN
              </label>
              <div className="relative">
                <input
                  type={showPins ? "text" : "password"}
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
            </div>

            {/* Show/Hide PIN toggle */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPins(!showPins)}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer font-medium"
              >
                {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPins ? "Hide Digits" : "Show Digits"}</span>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
