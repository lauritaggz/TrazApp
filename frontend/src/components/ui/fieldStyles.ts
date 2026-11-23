export const FIELD_BASE =
  "min-h-11 w-full rounded-xl border bg-card text-sm text-text-primary placeholder:text-text-muted px-3 py-2.5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 disabled:bg-surface disabled:cursor-not-allowed";

export const FIELD_NORMAL = "border-border-strong hover:border-text-secondary";

export const FIELD_INVALID = "border-error focus:ring-error bg-error-bg";

export function fieldClassName(invalid: boolean, extra = ""): string {
  return `${FIELD_BASE} ${invalid ? FIELD_INVALID : FIELD_NORMAL} ${extra}`.trim();
}
