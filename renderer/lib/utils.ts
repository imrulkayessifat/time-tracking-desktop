import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getCurrentTime = () => {
  const currentUtcTime = new Date();
  const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
  return new Date(currentUtcTime.getTime() - localTimeOffset).toISOString().split('T')[1];
};