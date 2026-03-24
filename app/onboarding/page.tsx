import type { Metadata } from "next";

export const metadata: Metadata = { title: "Get started" };

/**
 * Onboarding shell — renders the multi-step wizard.
 * TODO (Prompt 9): Implement with OnboardingProgress + step components.
 */
export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Welcome to WhatMatters</h1>
          <p className="text-sm text-muted-foreground">
            Let&apos;s get your Brief set up in three steps.
          </p>
        </div>
        {/* TODO (Prompt 9): replace with <OnboardingWizard /> */}
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Onboarding wizard — coming in Prompt 9
        </div>
      </div>
    </div>
  );
}
