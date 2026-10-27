"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Inbox, Loader2, MailOpen, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { ListenerMessageItem } from "@/lib/types";
import { adminFetch } from "@/lib/client-auth";
import { DangerButton, EmptyRow } from "@/components/admin/shared";

const TYPE_META: Record<string, { label: string; cls: string }> = {
  request: { label: "🎵 Request", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  greeting: { label: "🎉 Greeting", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  shoutout: { label: "📣 Shoutout", cls: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300" },
};

export default function MessagesTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<ListenerMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await adminFetch("/api/messages", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as ListenerMessageItem[];
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(true), 30_000); // navi messages auto-load
    return () => clearInterval(t);
  }, [load]);

  const markRead = async (m: ListenerMessageItem) => {
    if (m.read) return;
    const res = await adminFetch(`/api/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    if (res.ok) load(true);
  };

  const markAllRead = async () => {
    const unread = items.filter((m) => !m.read);
    await Promise.all(
      unread.map((m) =>
        adminFetch(`/api/messages/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        })
      )
    );
    toast({ title: `✅ ${unread.length} messages read ho gaye` });
    load(true);
  };

  const remove = async (id: string) => {
    const res = await adminFetch(`/api/messages/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Message delete ho gaya" });
      load(true);
    } else {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  const unreadCount = items.filter((m) => !m.read).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-100">
            <Inbox className="h-4.5 w-4.5 text-amber-400" /> Sarotian De Messages
            {unreadCount > 0 && (
              <Badge className="border-0 bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadCount} navi
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={markAllRead}
                className="border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> Sab read karo
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => load()}
              className="text-amber-300 hover:bg-amber-400/10"
              aria-label="Messages refresh karo"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {loading ? (
          <EmptyRow text="Load ho raha hai..." />
        ) : items.length === 0 ? (
          <EmptyRow text="Hale koi message nahi aaya. Site te listeners message bhejan ge te ithi dikhega!" />
        ) : (
          <div className="nice-scroll max-h-[28rem] space-y-2 overflow-y-auto pr-1" data-testid="messages-admin-list">
            {items.map((m) => {
              const meta = TYPE_META[m.type] || TYPE_META.request;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border px-3 py-2.5 transition ${
                    m.read
                      ? "border-amber-400/10 bg-black/25"
                      : "border-amber-400/40 bg-amber-400/10"
                  }`}
                  data-testid={`message-row-${m.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-amber-50">{m.name}</span>
                    {m.city && <span className="text-xs text-amber-100/50">📍 {m.city}</span>}
                    <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>
                      {meta.label}
                    </Badge>
                    {m.showTitle && (
                      <span className="text-[10px] text-amber-300/70">📻 {m.showTitle}</span>
                    )}
                    <span className="ml-auto text-[10px] text-amber-100/40">
                      {new Date(m.addedAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="font-gur mt-1.5 break-words text-sm text-amber-100/85">{m.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {!m.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markRead(m)}
                        className="h-7 gap-1 px-2 text-[11px] text-emerald-300 hover:bg-emerald-400/10"
                      >
                        <MailOpen className="h-3 w-3" /> Read karo
                      </Button>
                    )}
                    <DangerButton onConfirm={() => remove(m.id)} label={`${m.name} da message delete`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
