export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    return "Edited just now";
  }
  if (diffMin < 60) {
    return `Edited ${diffMin}m ago`;
  }
  if (diffHours < 24) {
    const isToday = now.toDateString() === date.toDateString();
    return isToday ? "Edited today" : `Edited ${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return "Edited yesterday";
  }
  if (diffDays < 7) {
    return `Edited ${diffDays}d ago`;
  }

  return `Edited ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
