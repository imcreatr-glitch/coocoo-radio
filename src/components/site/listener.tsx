"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, MessageSquareHeart, Music4, PartyPopper, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SectionTitle } from "@/components/site/schedule";
import LiveChat from "@/components/site/live-chat";

const MSG_TYPES = [
  { value: "request", label: "🎵 Gana Request", icon: Music4 },
  { value: "greeting", label: "🎉 Shubhkamna", icon: PartyPopper },
  { value: "shoutout", label: "📣 Shoutout", icon: Megaphone },
];

export default function ListenerSection() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("request");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !message.trim()) {
      toast({ title: "Naam te message dono likho", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), city: city.trim(), type, message: message.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Send fail");
      }
      toast({
        title: "💌 Message station kol pahunch gaya!",
        description: "RJ tuhada message parh ke zaroor jawaab devega",
      });
      setMessage("");
    } catch (e) {
      toast({ title: "Message send nahi hoya", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="listener" className="border-b border-amber-400/10 bg-[oklch(0.165_0.012_60)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle
          title="ਸਰੋਤਿਆਂ ਦੀ ਆਵਾਜ਼ • Listener Corner"
          sub="Apni request ya shubhkamna bhejo, te live chat vich duniya bhar de sarotian naal judo"
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: message / request form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5"
          >
            <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-amber-100">
              <MessageSquareHeart className="h-4.5 w-4.5 text-amber-400" /> Request ya Message Bhejo
            </h3>
            <p className="mb-4 text-xs text-amber-100/55">
              RJI nu apna pasand da gana chahida ja koi greeting pahunchani aa? Likho te bhejo!
            </p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-amber-200/90">Tuhada naam *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="jiven: Harpreet"
                    maxLength={40}
                    data-testid="listener-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-amber-200/90">Shehar (optional)</label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="jiven: Amritsar"
                    maxLength={40}
                    data-testid="listener-city"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-amber-200/90">Ki bhejna aa?</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="listener-type" className="border-amber-400/30 bg-black/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MSG_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-amber-200/90">Message *</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Apna message likho... jiven: Mere veer de janam din diyan vadhaiyan, koi pyara gana laga do!"
                  rows={4}
                  maxLength={500}
                  data-testid="listener-message"
                />
              </div>
              <Button
                onClick={submit}
                disabled={sending}
                data-testid="listener-submit"
                className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
              >
                {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Message bhejo 💌
              </Button>
            </div>
          </motion.div>

          {/* Right: live chat */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <LiveChat />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
