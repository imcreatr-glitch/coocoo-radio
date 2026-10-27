"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/site/navbar";
import Hero from "@/components/site/hero";
import Ticker from "@/components/site/ticker";
import ScheduleSection from "@/components/site/schedule";
import NewsSection from "@/components/site/news";
import ListenerSection from "@/components/site/listener";
import AdsSection from "@/components/site/ads";
import Footer from "@/components/site/footer";
import PlayerBar from "@/components/site/player-bar";
import Rooster from "@/components/site/rooster";
import AdminPanel from "@/components/admin/admin-panel";
import { usePlayer } from "@/lib/store";
import { parseTheme, type ShowItem } from "@/lib/types";

export default function Home() {
  const [adminOpen, setAdminOpen] = useState(false);
  const settings = usePlayer((s) => s.settings);
  const refreshContext = usePlayer((s) => s.refreshContext);
  const [shows, setShows] = useState<ShowItem[]>([]);

  // load radio context (settings + playlist) and shows
  useEffect(() => {
    refreshContext();
    fetch("/api/shows", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ShowItem[]) => {
        if (Array.isArray(data)) setShows(data);
      })
      .catch(() => {});
     
  }, []);

  // lock body scroll when admin panel is open
  useEffect(() => {
    document.body.style.overflow = adminOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [adminOpen]);

  // site color theme — sunrise = default (attribute removed), baki themes html[data-theme] set karde ne
  const theme = parseTheme(settings.theme);
  useEffect(() => {
    if (theme === "sunrise") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar stationName={settings.stationName} onAdminOpen={() => setAdminOpen(true)} />

      <main className="flex-1">
        <Hero shows={shows} />
        <Ticker />
        <ScheduleSection />
        <NewsSection />
        <ListenerSection />
        <AdsSection />
      </main>

      <Footer />

      <PlayerBar />
      <Rooster />

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </div>
  );
}
