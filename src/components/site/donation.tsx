"use client";

/**
 * Seva / Donation — navbar button + dialog.
 * Admin Settings ch UPI ID / QR set karega, tabhi eh button site te dikhega.
 * QR = white background te (UPI apps scan kar sake), UPI ID copy button,
 * mobile te upi:// deep-link (GPay/PhonePe/Paytm khud khul jange).
 */
import { useState } from "react";
import { Check, Copy, HeartHandshake, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlayer } from "@/lib/store";

export default function DonationButton() {
  const settings = usePlayer((s) => s.settings);
  const upi = (settings.donationUpi || "").trim();
  const qr = (settings.donationQr || "").trim();
  const note = (settings.donationNote || "").trim();
  const stationName = settings.stationName;

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Admin ne kuch vi set nahi kite — button bilkul nahi dikhega
  if (!upi && !qr) return null;

  const upiLink = upi
    ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(stationName)}&cu=INR`
    : "";

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upi);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard block hoya — chhado, QR to scan kar lange
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="donation-open"
        aria-label="Seva / Donation karo"
        className="gap-1.5 border-0 bg-gradient-to-r from-emerald-500 to-green-600 px-3 font-bold text-white shadow-[0_2px_12px_rgba(16,185,129,0.4)] hover:from-emerald-400 hover:to-green-500"
      >
        <HeartHandshake className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Seva</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" data-testid="donation-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-100">
              💗 Seva / Support karo
            </DialogTitle>
            <DialogDescription>
              {note || "Tuhadi seva radio nu chaldi rakhegi — dhanwad ji!"}
            </DialogDescription>
          </DialogHeader>

          {qr && (
            <img
              src={qr}
              alt="UPI QR code"
              data-testid="donation-qr"
              className="mx-auto max-h-64 rounded-xl border-4 border-white bg-white p-1.5 shadow-lg"
            />
          )}

          {upi && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-black/25 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-amber-100">
                {upi}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={copyUpi}
                data-testid="donation-copy"
                aria-label={copied ? "Copy ho gaya" : "UPI ID copy karo"}
                className="h-8 w-8 shrink-0 text-amber-300 hover:bg-amber-400/15"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {upi && (
            <p className="text-center text-xs text-amber-100/50">
              UPI ID upar likhi hai — copy karke GPay/PhonePe/Paytm ch pao
            </p>
          )}

          {upiLink && (
            <a
              href={upiLink}
              data-testid="donation-upi-app"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-2.5 text-sm font-bold text-white sm:hidden"
            >
              <Smartphone className="h-4 w-4" /> UPI App ch kholo
            </a>
          )}

          <p className="text-center text-[10px] text-amber-100/40">
            🙏 Raashi seedhe tuhade UPI app vali jaandi hai — radio koi paisa nahi rakhda
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
