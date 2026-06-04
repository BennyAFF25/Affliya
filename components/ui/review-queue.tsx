import * as React from "react";
import { SectionHeader } from "./section-header";
import { cn } from "./utils";

export type ReviewQueueProps = React.HTMLAttributes<HTMLElement> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

export function ReviewQueue({ title, description, actions, className, children, ...props }: ReviewQueueProps) {
  return (
    <section className={cn("space-y-4", className)} {...props}>
      <SectionHeader title={title} description={description} actions={actions} className="mb-0" />
      {children}
    </section>
  );
}
