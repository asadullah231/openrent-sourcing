import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function scoreColor(score) {
  if (score == null) return 'text-muted';
  if (score >= 70) return 'text-green-500';
  if (score >= 55) return 'text-amber-500';
  return 'text-muted';
}
