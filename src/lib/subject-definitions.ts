export type EducationLevel =
  | 'CBC_LOWER_PRIMARY'
  | 'CBC_UPPER_PRIMARY'
  | 'CBC_JUNIOR_SCHOOL'
  | 'CBC_SENIOR_SCHOOL'
  | '844_SECONDARY';

/** Senior School pathway (only applies to CBC_SENIOR_SCHOOL optional subjects) */
export type SeniorPathway = 'STEM' | 'ARTS_SPORTS' | 'SOCIAL_SCIENCES';

export interface PredefinedSubject {
  name: string;
  code: string;
  level: EducationLevel;
  category?: string;
  /** Whether the subject is compulsory at this level */
  isCore?: boolean;
  /** Senior School pathway (null/undefined = compulsory for all pathways) */
  pathway?: SeniorPathway;
}

export const PREDEFINED_SUBJECTS: PredefinedSubject[] = [

  // ═══════════════════════════════════════════════════════════════
  // 8-4-4 KCSE Secondary (Forms 1–4) — Official KNEC subject codes
  // ═══════════════════════════════════════════════════════════════

  // Group 1: Core Languages & Mathematics
  { name: 'English', code: '101', level: '844_SECONDARY', category: 'LANGUAGE', isCore: true },
  { name: 'Kiswahili', code: '102', level: '844_SECONDARY', category: 'LANGUAGE', isCore: true },
  { name: 'Mathematics Alternative A', code: '121', level: '844_SECONDARY', category: 'MATHEMATICS', isCore: true },
  { name: 'Mathematics Alternative B', code: '122', level: '844_SECONDARY', category: 'MATHEMATICS', isCore: true },

  // Group 2: Sciences
  { name: 'Biology', code: '231', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'Physics', code: '232', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'Chemistry', code: '233', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'Biology for the Blind', code: '236', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'General Science', code: '237', level: '844_SECONDARY', category: 'SCIENCE' },

  // Group 3: Humanities
  { name: 'History and Government', code: '311', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Geography', code: '312', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Christian Religious Education', code: '313', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Islamic Religious Education', code: '314', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Hindu Religious Education', code: '315', level: '844_SECONDARY', category: 'HUMANITY' },

  // Group 4: Applied / Technical
  { name: 'Home Science', code: '441', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Art and Design', code: '442', level: '844_SECONDARY', category: 'CREATIVE' },
  { name: 'Agriculture', code: '443', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Woodwork', code: '444', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Metalwork', code: '445', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Building Construction', code: '446', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Power Mechanics', code: '447', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Electricity', code: '448', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Drawing and Design', code: '449', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Aviation Technology', code: '450', level: '844_SECONDARY', category: 'TECHNICAL' },
  { name: 'Computer Studies', code: '451', level: '844_SECONDARY', category: 'TECHNICAL' },

  // Group 5: Languages & Others
  { name: 'French', code: '501', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'German', code: '502', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Arabic', code: '503', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Kenya Sign Language', code: '504', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Music', code: '511', level: '844_SECONDARY', category: 'CREATIVE' },
  { name: 'Business Studies', code: '565', level: '844_SECONDARY', category: 'HUMANITY' },


  // ═══════════════════════════════════════════════════════════════
  // CBC Lower Primary (Grades 1–3) — 7 subjects (revised MoE policy)
  // ═══════════════════════════════════════════════════════════════

  { name: 'Indigenous Language', code: 'IND_LP', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'Kiswahili Language', code: 'KISW_LP', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'Kenya Sign Language', code: 'KSL_LP', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'English Language', code: 'ENG_LP', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'Mathematics', code: 'MATH_LP', level: 'CBC_LOWER_PRIMARY', category: 'MATHEMATICS', isCore: true },
  { name: 'Religious Education', code: 'RE_LP', level: 'CBC_LOWER_PRIMARY', category: 'HUMANITY', isCore: true },
  { name: 'Environmental Activities', code: 'ENV_LP', level: 'CBC_LOWER_PRIMARY', category: 'SCIENCE', isCore: true },
  { name: 'Movement and Creative Activities', code: 'MCA_LP', level: 'CBC_LOWER_PRIMARY', category: 'CREATIVE', isCore: true },


  // ═══════════════════════════════════════════════════════════════
  // CBC Upper Primary (Grades 4–6) — 8 subjects
  // ═══════════════════════════════════════════════════════════════

  { name: 'English', code: 'ENG_UP', level: 'CBC_UPPER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'Kiswahili', code: 'KISW_UP', level: 'CBC_UPPER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'Kenya Sign Language', code: 'KSL_UP', level: 'CBC_UPPER_PRIMARY', category: 'LANGUAGE', isCore: true },
  { name: 'Mathematics', code: 'MATH_UP', level: 'CBC_UPPER_PRIMARY', category: 'MATHEMATICS', isCore: true },
  { name: 'Integrated Science', code: 'SCI_UP', level: 'CBC_UPPER_PRIMARY', category: 'SCIENCE', isCore: true },
  { name: 'Social Studies', code: 'SS_UP', level: 'CBC_UPPER_PRIMARY', category: 'HUMANITY', isCore: true },
  { name: 'Religious Education', code: 'RE_UP', level: 'CBC_UPPER_PRIMARY', category: 'HUMANITY', isCore: true },
  { name: 'Creative and Movement Activities', code: 'CMA_UP', level: 'CBC_UPPER_PRIMARY', category: 'CREATIVE', isCore: true },


  // ═══════════════════════════════════════════════════════════════
  // CBC Junior School (Grades 7–9) — 9 core subjects (revised MoE/KICD policy)
  // ═══════════════════════════════════════════════════════════════

  { name: 'English', code: 'ENG_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'LANGUAGE', isCore: true },
  { name: 'Kiswahili', code: 'KISW_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'LANGUAGE', isCore: true },
  { name: 'Kenya Sign Language', code: 'KSL_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'LANGUAGE', isCore: true },
  { name: 'Mathematics', code: 'MATH_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'MATHEMATICS', isCore: true },
  { name: 'Religious Education', code: 'RE_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'HUMANITY', isCore: true },
  { name: 'Social Studies', code: 'SS_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'HUMANITY', isCore: true },
  { name: 'Integrated Science', code: 'SCI_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'SCIENCE', isCore: true },
  { name: 'Pre-Technical Studies', code: 'PTS_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'TECHNICAL', isCore: true },
  { name: 'Agriculture', code: 'AGRI_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'TECHNICAL', isCore: true },
  { name: 'Creative Arts and Sports', code: 'CAS_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'CREATIVE', isCore: true },


  // ═══════════════════════════════════════════════════════════════
  // CBC Senior School (Grades 10–12)
  // ═══════════════════════════════════════════════════════════════

  // ── Core / Compulsory (all pathways) ──
  { name: 'English', code: 'ENG_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', isCore: true },
  { name: 'Kiswahili', code: 'KISW_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', isCore: true },
  { name: 'Kenya Sign Language', code: 'KSL_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', isCore: true },
  { name: 'Community Service Learning', code: 'CSL_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY', isCore: true },
  { name: 'Physical Education', code: 'PE_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE', isCore: true },
  { name: 'ICT Skills', code: 'ICT_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', isCore: true },

  // ── STEM Pathway ──
  { name: 'Mathematics (STEM)', code: 'MATH_SS', level: 'CBC_SENIOR_SCHOOL', category: 'MATHEMATICS', pathway: 'STEM' },
  { name: 'Biology', code: 'BIO_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE', pathway: 'STEM' },
  { name: 'Chemistry', code: 'CHEM_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE', pathway: 'STEM' },
  { name: 'Physics', code: 'PHY_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE', pathway: 'STEM' },
  { name: 'General Science', code: 'GSCI_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE', pathway: 'STEM' },
  { name: 'Computer Science', code: 'COMP_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Agriculture', code: 'AGRI_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Home Science', code: 'HOME_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Drawing and Design', code: 'DD_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Aviation Technology', code: 'AVI_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Building and Construction', code: 'BC_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Electrical Technology', code: 'ELEC_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Metal Technology', code: 'MET_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Power Mechanics', code: 'PM_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Wood Technology', code: 'WOOD_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Media Technology', code: 'MED_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },
  { name: 'Marine and Fisheries Technology', code: 'MAR_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL', pathway: 'STEM' },

  // ── Arts & Sports Science Pathway ──
  { name: 'Sports and Recreation', code: 'SR_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE', pathway: 'ARTS_SPORTS' },
  { name: 'Music and Dance', code: 'MD_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE', pathway: 'ARTS_SPORTS' },
  { name: 'Theatre and Film', code: 'TF_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE', pathway: 'ARTS_SPORTS' },
  { name: 'Fine Arts', code: 'FA_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE', pathway: 'ARTS_SPORTS' },

  // ── Social Sciences Pathway ──
  { name: 'Advanced English', code: 'AENG_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Literature in English', code: 'LIT_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Indigenous Languages', code: 'IND_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Kiswahili Kipevu', code: 'KK_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Foreign Languages', code: 'FL_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE', pathway: 'SOCIAL_SCIENCES' },
  { name: 'History and Citizenship', code: 'HC_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Geography', code: 'GEO_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Business Studies', code: 'BS_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY', pathway: 'SOCIAL_SCIENCES' },
  { name: 'Religious Education', code: 'RE_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY', pathway: 'SOCIAL_SCIENCES' },
];
