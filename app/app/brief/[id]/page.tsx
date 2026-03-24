import type { Metadata } from "next";
import { BriefContainer } from "@/components/brief/BriefContainer";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BriefContainer digestId={id} />;
}
