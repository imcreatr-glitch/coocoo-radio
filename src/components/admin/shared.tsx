"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Two-step delete button: click once -> "Pakka?" -> click again to delete */
export function DangerButton({
  onConfirm,
  label = "Delete",
  testId,
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  testId?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!armed) {
    return (
      <Button
        size="icon"
        variant="ghost"
        aria-label={label}
        data-testid={testId}
        onClick={() => setArmed(true)}
        className="h-8 w-8 text-red-400/80 hover:bg-red-500/15 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
        className="h-8 border-0 bg-red-600 px-2.5 text-xs font-bold text-white hover:bg-red-500"
      >
        {busy ? "..." : "Pakka?"}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Cancel delete"
        onClick={() => setArmed(false)}
        className="h-8 w-8 text-amber-200/70 hover:text-amber-100"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[13px] font-semibold text-amber-200/90">{children}</Label>;
}

export function EmptyRow({ text }: { text: string }) {
  return (
    <p className="py-8 text-center font-gur text-sm text-amber-100/50">{text}</p>
  );
}

export function FilePick({
  accept,
  onChange,
  fileName,
}: {
  accept: string;
  onChange: (f: File | null) => void;
  fileName?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/80 transition hover:border-amber-400/70 hover:bg-amber-400/10">
      <Input
        type="file"
        accept={accept}
        className="sr-only"
        data-testid="file-pick-input"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <span className="truncate">
        {fileName ? (
          <span className="font-semibold text-amber-300">{fileName}</span>
        ) : (
          "Click karo te file chuno..."
        )}
      </span>
    </label>
  );
}
