import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Aceternity UI 標準の className 結合ユーティリティ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
