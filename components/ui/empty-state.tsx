interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
