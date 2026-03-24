export interface BriefSource {
  id: string;
  name: string;
}

export interface BriefCluster {
  id: string;
  topic: string;
  summary: string | null;
  rank: number;
  isFullBlock: boolean;
  sources: BriefSource[];
  sourceUrl: string | null;
}

export interface BriefDigest {
  id: string;
  subject: string | null;
  periodLabel: string;
  status: "ready" | "sent";
  sentAt: string | null;
  clusters: BriefCluster[];
}
