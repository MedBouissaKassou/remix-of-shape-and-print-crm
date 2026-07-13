import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** Short helper paragraph rendered under the title to guide the user. */
  helper?: string;
  actions?: ReactNode;
  /** Optional eyebrow label (e.g. section name). */
  eyebrow?: string;
};

export function PageHeader({ title, description, helper, actions, eyebrow }: Props) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {helper && (
        <p className="mt-3 max-w-3xl rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {helper}
        </p>
      )}
    </div>
  );
}
