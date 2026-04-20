import type { Metadata } from "next";
import ThreadView from "../../../components/ThreadView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ShopAgent · Thread",
  description: "Live view of the Concierge conversation with real-time agent flow.",
};

export default function CurrentThreadPage() {
  return <ThreadView />;
}
