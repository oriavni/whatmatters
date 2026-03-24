/**
 * TODO (Prompt 9): Step indicator for onboarding wizard.
 */
interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i < currentStep ? "bg-foreground" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}
