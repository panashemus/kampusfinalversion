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

export type SchoolCode = 'UB' | 'BAC / BSBS' | 'BIUST' | 'BOTHO' | 'BUAN';

export const SCHOOL_COURSES: Record<SchoolCode, string[]> = {
  UB: [
    'Bachelor of Laws (LLB)',
    'BA Criminal Justice Studies',
    'Bachelor of Accountancy (BAcc)',
    'Bachelor of Finance',
    'BA Economics and Accounting',
    'BIS Business Information Systems',
    'BBA Management',
    'BBA Marketing',
    'BBA Entrepreneurship and Enterprise Development',
    'BBA Logistics and Supply Chain Management',
    'BBA International Business',
    'BBA Tourism and Hospitality Management',
    'BSc Computer Science',
    'BSc Computing with Finance',
    'BIS Computer Information Systems',
    'BSc Information Technology',
    'BSc Mathematics of Finance',
    'BSc Statistics',
    'BSc General (Biological / Chemical / Physical Sciences)',
    'BSc Applied Geophysics',
    'BSc Physics with Meteorology',
    'BSc Radiation and Health Physics',
    'BEng Civil Engineering',
    'BEng Electrical and Electronic Engineering',
    'BEng Mechanical Engineering',
    'BEng Industrial Engineering',
    'BEng Mineral Engineering',
    'Bachelor of Architecture',
    'BSc Urban and Regional Planning',
    'Bachelor of Real Estate',
    'Bachelor of Geomatics',
    'Bachelor of Design and Technology',
    'Bachelor of Industrial Design',
    'Bachelor of Medicine and Bachelor of Surgery (MBBS)',
    'Bachelor of Pharmacy',
    'Bachelor of Nursing Science',
    'BSc Environmental Health',
    'BSc Medical Laboratory Sciences',
    'BA Economics',
    'BA Political Science',
    'BA Public Administration',
    'BA Sociology',
    'BA Psychology',
    'Bachelor of Social Work (BSW)',
    'BA Media Studies',
    'BA Humanities',
    'BA Information and Knowledge Management',
    'BEd Education (Science / Business / Secondary)',
    'Bachelor of Primary Education',
  ],
  'BAC / BSBS': [
    'BSc (Hons) Computer Systems Engineering',
    'BSc (Hons) Applied Business Computing',
    'BSc (Hons) Business Intelligence and Data Analytics',
    'BSc (Hons) Network Systems Engineering',
    'BSc (Hons) Mobile Technologies',
    'BSc (Hons) Information Communication Technology (ICT)',
    'BA (Hons) Accounting and Finance',
    'BA (Hons) International Finance and Banking',
    'BCom Chartered Accountancy',
    'BA (Hons) Business Management',
    'BA (Hons) Entrepreneurship and Business Leadership',
    'BA (Hons) International Hospitality Management',
    'BA (Hons) International Tourism Management',
    'BA (Hons) Public Sector Procurement',
    'BA (Hons) Insurance',
    'ACCA Professional Qualification',
    'CIMA Professional Qualification',
    'BICA Chartered Accountancy',
    'CIA Certified Internal Audit',
    'CIPS Procurement and Supply',
    'AAT Accounting Diploma',
    'Postgraduate Diploma in Taxation (PGDT)',
  ],
  BIUST: [
    'BEng Computer and Telecommunications Engineering',
    'BEng Electrical and Electronics Engineering',
    'BEng Civil and Environmental Engineering',
    'BEng Mechanical and Energy Engineering',
    'BEng Mechatronics and Industrial Instrumentation',
    'BEng Chemical Engineering',
    'BEng Materials and Metallurgical Engineering',
    'BEng Mining Engineering',
    'BEng Geological Engineering',
    'BEng Industrial and Manufacturing Engineering',
    'BSc Computer Science and Software Engineering',
    'BSc Information Systems and Data Management',
    'BSc Pure and Applied Mathematics',
    'BSc Statistics',
    'BSc Physics',
    'BSc Pure and Applied Chemistry',
    'BSc Biological Sciences and Biotechnology',
    'BSc Forensic Science',
    'BSc Geology',
    'BSc Earth and Environmental Sciences',
    'BSc Environmental Sciences',
  ],
  BOTHO: [
    'BSc (Hons) Computing',
    'BSc (Hons) Network Security and Computer Forensics',
    'BSc (Hons) Data Science',
    'BSc (Hons) Health Information Management',
    'BSc (Hons) Multimedia Systems',
    'BCom Accounting',
    'BCom Finance',
    'BBA Business Management',
    'BSc (Hons) Finance and Investment Management',
    'BCom Hospitality Management',
    'BEng (Hons) Electrical Engineering',
    'BEng (Hons) Computer Engineering',
    'BSc (Hons) Safety, Health and Environmental Management',
    'BEd Primary / Higher Education',
  ],
  BUAN: [
    'BSc Agriculture',
    'BSc Agricultural Economics',
    'BSc Agribusiness Management',
    'BSc Agricultural Mechanization',
    'BSc Soil and Water Conservation Engineering',
    'BSc Crop Science (Agronomy / Horticulture)',
    'BSc Food Science and Technology',
    'BSc Animal Science',
    'BSc Range Science',
    'BSc Wildlife Management and Conservation',
    'BSc Agricultural Education',
    'BSc Agricultural Extension',
    'Higher Diploma in Animal Health and Production',
    'Higher Diploma in Forestry and Range Ecology',
  ],
};

export function classifyUniversity(emailOrUni?: string | null): {
  code: SchoolCode;
  fullName: string;
  courses: string[];
} {
  const clean = (emailOrUni || '').trim().toLowerCase();
  if (
    clean.includes('bac.ac.bw') ||
    clean.includes('bsbs.ac.bw') ||
    clean.includes('accountancy') ||
    clean.includes('business sciences')
  ) {
    return {
      code: 'BAC / BSBS',
      fullName: 'BAC / BSBS (Botswana School of Business Sciences)',
      courses: SCHOOL_COURSES['BAC / BSBS'],
    };
  }
  if (clean.includes('biust.ac.bw') || clean.includes('biust')) {
    return {
      code: 'BIUST',
      fullName:
        'BIUST (Botswana International University of Science and Technology)',
      courses: SCHOOL_COURSES.BIUST,
    };
  }
  if (clean.includes('botho.ac.bw') || clean.includes('botho')) {
    return {
      code: 'BOTHO',
      fullName: 'Botho University',
      courses: SCHOOL_COURSES.BOTHO,
    };
  }
  if (clean.includes('buan.ac.bw') || clean.includes('buan')) {
    return {
      code: 'BUAN',
      fullName:
        'BUAN (Botswana University of Agriculture and Natural Resources)',
      courses: SCHOOL_COURSES.BUAN,
    };
  }
  return {
    code: 'UB',
    fullName: 'UB (University of Botswana)',
    courses: SCHOOL_COURSES.UB,
  };
}

export function isValidCourseForSchool(
  course: string | null | undefined,
  emailOrUni?: string | null
): boolean {
  if (!course) return false;
  const { courses } = classifyUniversity(emailOrUni);
  return courses.includes(course.trim());
}
