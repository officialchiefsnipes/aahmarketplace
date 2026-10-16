import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Marketplace from "@/components/Marketplace";
import { MarketplaceBird } from "@/components/MarketplaceBird";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Abdulsalami Marketplace — Find local services" },
      { name: "description", content: "Search residents' businesses by name or service and chat with them on WhatsApp." },
      { property: "og:title", content: "Abdulsalami Marketplace" },
      { property: "og:description", content: "Search local businesses and services, then chat on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="am-loading am-initial-loading"><MarketplaceBird loading label="Loading marketplace" /></div>;
  return <Marketplace />;
}
