import * as React from "react";
import { Badge, type BadgeProps } from "./badge";

export type ReviewStatus = "pending" | "approved" | "rejected" | "live" | "active" | "paused" | "stopped" | string;

function variantForStatus(status: ReviewStatus): BadgeProps["variant"] {
  const key = String(status || "pending").toLowerCase();
  if (["approved", "live", "active"].includes(key)) return "success";
  if (["rejected", "stopped", "failed"].includes(key)) return "danger";
  if (["pending", "paused", "review", "reviewing"].includes(key)) return "warning";
  return "muted";
}

export type StatusBadgeProps = Omit<BadgeProps, "variant"> & {
  status: ReviewStatus;
  label?: React.ReactNode;
};

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  return (
    <Badge variant={variantForStatus(status)} className={className} {...props}>
      {label ?? String(status || "pending")}
    </Badge>
  );
}
