import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Preferences"
        description="Control how and when you receive your Brief."
      />

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Delivery schedule</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            When should your Brief arrive?
          </p>
        </div>
        {/* TODO (Prompt 11): <DigestScheduleForm /> */}
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Schedule form — coming in Prompt 11
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Density</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How much detail should each story include?
          </p>
        </div>
        {/* TODO (Prompt 11): <DensitySelector /> */}
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Density selector — coming in Prompt 11
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Ignored topics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Topics that will never appear in your Brief.
          </p>
        </div>
        {/* TODO (Prompt 11): <IgnoredTopicsList /> */}
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Ignored topics list — coming in Prompt 11
        </div>
      </section>
    </div>
  );
}
