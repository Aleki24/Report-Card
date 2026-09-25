import {
  BookOpen, Calculator, FlaskConical, Landmark, Languages, Palette, Wrench, type LucideIcon,
} from 'lucide-react';
import { TONES, type Tone } from './tones';

/** One colour and icon per subject category, wherever subjects are listed. */
export type SubjectCategory = 'LANGUAGE' | 'MATHEMATICS' | 'SCIENCE' | 'HUMANITY' | 'TECHNICAL' | 'CREATIVE' | 'OTHER';

export const SUBJECT_CATEGORY_THEME: Readonly<Record<SubjectCategory, { label: string; icon: LucideIcon; tone: Tone; order: number }>> = {
  LANGUAGE: { label: 'Languages', icon: Languages, tone: TONES.sky, order: 1 },
  MATHEMATICS: { label: 'Mathematics', icon: Calculator, tone: TONES.violet, order: 2 },
  SCIENCE: { label: 'Sciences', icon: FlaskConical, tone: TONES.emerald, order: 3 },
  HUMANITY: { label: 'Humanities', icon: Landmark, tone: TONES.amber, order: 4 },
  TECHNICAL: { label: 'Technical & Applied', icon: Wrench, tone: TONES.orange, order: 5 },
  CREATIVE: { label: 'Creative Arts & Sports', icon: Palette, tone: TONES.rose, order: 6 },
  OTHER: { label: 'Other subjects', icon: BookOpen, tone: TONES.slate, order: 99 },
};

/** A subject's category as stored (any case, possibly missing), mapped to a known one. */
export function subjectCategory(raw: string | null | undefined): SubjectCategory {
  const key = (raw || '').toUpperCase();
  return key in SUBJECT_CATEGORY_THEME ? (key as SubjectCategory) : 'OTHER';
}

