import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Covers past ("3 days overdue"), today, and future ("due in 5 days") — used by the Revision Center. */
export function formatDueDate(dueAt: Date, now: Date = new Date()): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((dueAt.getTime() - now.getTime()) / dayMs);
  if (diffDays === 0) return "due today";
  if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
  return `due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}
