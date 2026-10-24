"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Radio, Save, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/store";
import { adminFetch } from "@/lib/client-auth";
import type { StationSettings } from "@/lib/types";
import { FieldLabel } from "@/components/admin/shared";

export default function SettingsTab() {
  const { toast } = useToast();
  const refreshContext = usePlayer((s) => s.refreshContext);
  const [settings, setSettings] = useState<StationSettings>({
    stationName: "",
    tagline: "",
    liveMode: "auto",
    liveUrl: "",
  });
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: StationSettings) => setSettings(data))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save fail");
      await refreshContext();
      toast({ title: "⚙️ Settings save ho gayian!", description: "Radio hun navi settings naal chalegi" });
    } catch {
      toast({ title: "Save nahi hoyian", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    if (!currentPw || !newPw) {
      toast({ title: "Dono fields bharo", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Nava password te confirm match nahi karde", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await adminFetch("/api/admin/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Fail");
      }
      toast({ title: "🔒 Password badal gaya!" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e) {
      toast({ title: "Password nahi badla", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Radio className="h-4.5 w-4.5 text-amber-400" /> Station Settings
        </h3>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Station da naam</FieldLabel>
              <Input
                value={settings.stationName}
                onChange={(e) => setSettings((s) => ({ ...s, stationName: e.target.value }))}
                data-testid="settings-name"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Tagline</FieldLabel>
              <Input
                value={settings.tagline}
                onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>24x7 Live Mode</FieldLabel>
            <RadioGroup
              value={settings.liveMode}
              onValueChange={(v) => setSettings((s) => ({ ...s, liveMode: v }))}
              className="grid gap-3 sm:grid-cols-2"
              data-testid="live-mode-group"
            >
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  settings.liveMode === "auto"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-amber-400/20 bg-black/25"
                }`}
              >
                <RadioGroupItem value="auto" className="mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-100">🎵 Auto-Pilot Playlist</p>
                  <p className="mt-0.5 text-xs text-amber-100/60">
                    Tuhadi uploaded songs te cloud links din-raat 24 ghante non-stop loop honde rehnde ne.
                  </p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  settings.liveMode === "stream"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-amber-400/20 bg-black/25"
                }`}
              >
                <RadioGroupItem value="stream" className="mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-100">📡 Live Stream URL</p>
                  <p className="mt-0.5 text-xs text-amber-100/60">
                    Icecast / Shoutcast / koi bhi live stream link pao — oh direct 24x7 chalega.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {settings.liveMode === "stream" && (
            <div className="space-y-1.5" data-testid="live-url-wrap">
              <FieldLabel>Live Stream URL</FieldLabel>
              <Input
                value={settings.liveUrl}
                onChange={(e) => setSettings((s) => ({ ...s, liveUrl: e.target.value }))}
                placeholder="https://your-stream-server.com/stream.mp3"
                inputMode="url"
              />
              <p className="flex items-center gap-1.5 text-xs text-amber-100/50">
                <Wifi className="h-3 w-3" /> Pehla stream URL browser vich test karke hi save karo.
              </p>
            </div>
          )}

          <Button
            onClick={save}
            disabled={saving}
            data-testid="settings-save"
            className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save karo
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <KeyRound className="h-4.5 w-4.5 text-amber-400" /> Password Badlo
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <FieldLabel>Current password</FieldLabel>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nava password</FieldLabel>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Confirm nava password</FieldLabel>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <Button onClick={changePw} disabled={pwSaving} variant="outline" className="mt-3 border-amber-400/40 text-amber-200">
          {pwSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
          Password update karo
        </Button>
      </div>
    </div>
  );
}
