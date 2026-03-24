import type { Metadata } from "next";
import { BriefContainer } from "@/components/brief/BriefContainer";

export const metadata: Metadata = { title: "Brief" };

export default function BriefPage() {
  return <BriefContainer />;
}
