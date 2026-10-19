import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function locationLabel(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function classifyUniversity(email?: string | null): {
  code: 'UB' | 'BAC / BSBS' | 'BIUST' | 'BOTHO' | 'BUAN';
  fullName: string;
} {
  const clean = (email || '').trim().toLowerCase();
  if (clean.includes('bac.ac.bw') || clean.includes('bsbs.ac.bw')) {
    return {
      code: 'BAC / BSBS',
      fullName: 'BAC / BSBS (Botswana School of Business Sciences)',
    };
  }
  if (clean.includes('biust.ac.bw')) {
    return {
      code: 'BIUST',
      fullName: 'BIUST (Botswana International University of Science and Technology)',
    };
  }
  if (clean.includes('botho.ac.bw')) {
    return {
      code: 'BOTHO',
      fullName: 'Botho University',
    };
  }
  if (clean.includes('buan.ac.bw')) {
    return {
      code: 'BUAN',
      fullName: 'BUAN (Botswana University of Agriculture and Natural Resources)',
    };
  }
  return {
    code: 'UB',
    fullName: 'UB (University of Botswana)',
  };
}
