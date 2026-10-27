"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Inbox, Loader2, Lock, LogOut, Megaphone, Music, Newspaper, Radio, Settings, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { adminFetch, clearToken, setToken } from "@/lib/client-auth";
import SongsTab from "@/components/admin/songs-tab";
import NewsTab from "@/components/admin/news-tab";
import ShowsTab from "@/components/admin/shows-tab";
import AdsTab from "@/components/admin/ads-tab";
import MessagesTab from "@/components/admin/messages-tab";
import SettingsTab from "@/components/admin/settings-tab";

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/session", { cache: "no-store" });
      const data = (await res.json()) as { authenticated: boolean };
      setAuthed(!!data.authenticated);
    } catch {
      setAuthed(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async () => {
    if (!username.trim() || !password) {
      toast({ title: "Username te password dono bharo", variant: "destructive" });
      return;
    }
    setLoggingIn(true);
    try {
      const res = await adminFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Login fail");
      }
      const j = (await res.json()) as { token?: string };
      if (j.token) setToken(j.token);
      window.dispatchEvent(new Event("coocoo:admin-changed"));
      setAuthed(true);
      setPassword("");
      toast({ title: "🔐 Login ho gaya!", description: "Welcome back, admin ji!" });
    } catch (e) {
      toast({ title: "Login fail", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await adminFetch("/api/admin/logout", { method: "POST" });
    clearToken();
    window.dispatchEvent(new Event("coocoo:admin-changed"));
    setAuthed(false);
    toast({ title: "Logout ho gaya" });
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[color:var(--bg-base)]" data-testid="admin-panel">
      {/* Admin header */}
      <header className="sticky top-0 z-10 border-b border-amber-400/20 bg-[color:var(--bg-deep)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-lg">
              🔒
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-50">Admin Panel</h2>
              <p className="text-[11px] text-amber-300/70">CooCoo Radio control room</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={logout}
                className="text-amber-200/80 hover:bg-red-500/15 hover:text-red-300"
              >
                <LogOut className="mr-1 h-3.5 w-3.5" /> Logout
              </Button>
            )}
            <Button size="sm" onClick={onClose} data-testid="admin-close" className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black">
              <X className="mr-1 h-3.5 w-3.5" /> Site Vekho
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {checking ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        ) : !authed ? (
          /* ---------- LOGIN ---------- */
          <div className="flex min-h-[70vh] items-center justify-center" data-testid="admin-login">
            <div className="w-full max-w-sm rounded-2xl border border-amber-400/25 bg-[color:var(--bg-card)] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-2xl shadow-[0_8px_24px_rgba(245,158,11,0.4)]">
                  🐓
                </div>
                <h3 className="text-lg font-bold text-amber-50">Admin Login</h3>
                <p className="font-gur mt-1 text-xs text-amber-300/70">Radio da control panel kholan layi login karo</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-user" className="text-[13px] font-semibold text-amber-200/90">Username</Label>
                  <Input
                    id="admin-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    data-testid="login-username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-pw" className="text-[13px] font-semibold text-amber-200/90">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-pw"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && login()}
                      autoComplete="current-password"
                      data-testid="login-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Password lukao" : "Password vekho"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300/70 hover:text-amber-200"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={login}
                  disabled={loggingIn}
                  data-testid="login-submit"
                  className="w-full border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
                >
                  {loggingIn ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Lock className="mr-1 h-4 w-4" />}
                  Login karo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ---------- DASHBOARD ---------- */
          <Tabs defaultValue="songs" data-testid="admin-dashboard">
            <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 border border-amber-400/20 bg-black/30 p-1">
              <TabsTrigger value="songs" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
                <Music className="h-3.5 w-3.5" /> Songs
              </TabsTrigger>
              <TabsTrigger value="news" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
                <Newspaper className="h-3.5 w-3.5" /> News
              </TabsTrigger>
              <TabsTrigger value="shows" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
                <Tv className="h-3.5 w-3.5" /> Shows
              </TabsTrigger>
              <TabsTrigger value="ads" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
                <Megaphone className="h-3.5 w-3.5" /> Ads
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
                <Inbox className="h-3.5 w-3.5" /> Messages
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
                <Settings className="h-3.5 w-3.5" /> Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="songs">
              <SongsTab />
            </TabsContent>
            <TabsContent value="news">
              <NewsTab />
            </TabsContent>
            <TabsContent value="shows">
              <ShowsTab />
            </TabsContent>
            <TabsContent value="ads">
              <AdsTab />
            </TabsContent>
            <TabsContent value="messages">
              <MessagesTab />
            </TabsContent>
            <TabsContent value="settings">
              <SettingsTab />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
