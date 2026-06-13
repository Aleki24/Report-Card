export type EducationLevel =
  | 'CBC_LOWER_PRIMARY'
  | 'CBC_UPPER_PRIMARY'
  | 'CBC_JUNIOR_SCHOOL'
  | 'CBC_SENIOR_SCHOOL'
  | '844_SECONDARY';

export interface PredefinedSubject {
  name: string;
  code: string;
  level: EducationLevel;
  category?: string;
}

export const PREDEFINED_SUBJECTS: PredefinedSubject[] = [
  // 8-4-4 KCSE Secondary
  { name: 'English', code: '101', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Kiswahili', code: '102', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Mathematics Alternative A', code: '121', level: '844_SECONDARY', category: 'MATHEMATICS' },
  { name: 'Mathematics Alternative B', code: '122', level: '844_SECONDARY', category: 'MATHEMATICS' },
  { name: 'Biology', code: '231', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'Physics', code: '232', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'Chemistry', code: '233', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'Biology for the Blind', code: '236', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'General Science', code: '237', level: '844_SECONDARY', category: 'SCIENCE' },
  { name: 'History and Government', code: '311', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Geography', code: '312', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Christian Religious Education', code: '313', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Islamic Religious Education', code: '314', level: '844_SECONDARY', category: 'HUMANITY' },
  { name: 'Hindu Religious Education', code: '315', level: '844_SECONDARY', category: 'HUMANITY' },
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
  { name: 'French', code: '501', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'German', code: '502', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Arabic', code: '503', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Kenya Sign Language', code: '504', level: '844_SECONDARY', category: 'LANGUAGE' },
  { name: 'Music', code: '511', level: '844_SECONDARY', category: 'CREATIVE' },
  { name: 'Business Studies', code: '565', level: '844_SECONDARY', category: 'HUMANITY' },

  // CBC Lower Primary (Grades 1-3)
  { name: 'Indigenous Language', code: 'IND', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE' },
  { name: 'Kiswahili Language', code: 'KISW', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE' },
  { name: 'Kenya Sign Language', code: 'KSL', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE' },
  { name: 'English Language', code: 'ENG', level: 'CBC_LOWER_PRIMARY', category: 'LANGUAGE' },
  { name: 'Mathematics', code: 'MATH', level: 'CBC_LOWER_PRIMARY', category: 'MATHEMATICS' },
  { name: 'Religious Education', code: 'RE', level: 'CBC_LOWER_PRIMARY', category: 'HUMANITY' },
  { name: 'Environmental Activities', code: 'ENV', level: 'CBC_LOWER_PRIMARY', category: 'SCIENCE' },
  { name: 'Movement and Creative Activities', code: 'MCA', level: 'CBC_LOWER_PRIMARY', category: 'CREATIVE' },

  // CBC Upper Primary (Grades 4-6)
  { name: 'English', code: 'ENG_UP', level: 'CBC_UPPER_PRIMARY', category: 'LANGUAGE' },
  { name: 'Kiswahili', code: 'KISW_UP', level: 'CBC_UPPER_PRIMARY', category: 'LANGUAGE' },
  { name: 'Kenya Sign Language', code: 'KSL_UP', level: 'CBC_UPPER_PRIMARY', category: 'LANGUAGE' },
  { name: 'Mathematics', code: 'MATH_UP', level: 'CBC_UPPER_PRIMARY', category: 'MATHEMATICS' },
  { name: 'Integrated Science', code: 'SCI_UP', level: 'CBC_UPPER_PRIMARY', category: 'SCIENCE' },
  { name: 'Social Studies', code: 'SS_UP', level: 'CBC_UPPER_PRIMARY', category: 'HUMANITY' },
  { name: 'Religious Education', code: 'RE_UP', level: 'CBC_UPPER_PRIMARY', category: 'HUMANITY' },
  { name: 'Creative and Movement Activities', code: 'CMA_UP', level: 'CBC_UPPER_PRIMARY', category: 'CREATIVE' },

  // CBC Junior School (Grades 7-9)
  { name: 'English', code: 'ENG_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Kiswahili', code: 'KISW_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Kenya Sign Language', code: 'KSL_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Mathematics', code: 'MATH_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'MATHEMATICS' },
  { name: 'Religious Education', code: 'RE_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'HUMANITY' },
  { name: 'Social Studies', code: 'SS_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'HUMANITY' },
  { name: 'Integrated Science', code: 'SCI_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'SCIENCE' },
  { name: 'Pre-Technical Studies', code: 'PTS_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Agriculture', code: 'AGRI_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Creative Arts and Sports', code: 'CAS_JS', level: 'CBC_JUNIOR_SCHOOL', category: 'CREATIVE' },

  // CBC Senior School (Grades 10-12)
  { name: 'English', code: 'ENG_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Kiswahili', code: 'KISW_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Kenya Sign Language', code: 'KSL_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Community Service Learning', code: 'CSL_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY' },
  { name: 'Physical Education', code: 'PE_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE' },
  { name: 'ICT Skills', code: 'ICT_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },

  // STEM Pathway
  { name: 'Biology', code: 'BIO_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE' },
  { name: 'Chemistry', code: 'CHEM_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE' },
  { name: 'Physics', code: 'PHY_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE' },
  { name: 'General Science', code: 'GSCI_SS', level: 'CBC_SENIOR_SCHOOL', category: 'SCIENCE' },
  { name: 'Computer Science', code: 'COMP_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Agriculture', code: 'AGRI_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Home Science', code: 'HOME_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Drawing and Design', code: 'DD_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Aviation Technology', code: 'AVI_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Building and Construction', code: 'BC_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Electrical Technology', code: 'ELEC_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Metal Technology', code: 'MET_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Power Mechanics', code: 'PM_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Wood Technology', code: 'WOOD_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Media Technology', code: 'MED_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },
  { name: 'Marine and Fisheries Technology', code: 'MAR_SS', level: 'CBC_SENIOR_SCHOOL', category: 'TECHNICAL' },

  // Arts & Sports Science Pathway
  { name: 'Sports and Recreation', code: 'SR_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE' },
  { name: 'Music and Dance', code: 'MD_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE' },
  { name: 'Theatre and Film', code: 'TF_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE' },
  { name: 'Fine Arts', code: 'FA_SS', level: 'CBC_SENIOR_SCHOOL', category: 'CREATIVE' },

  // Social Sciences Pathway
  { name: 'Advanced English', code: 'AENG_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Literature in English', code: 'LIT_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Indigenous Languages', code: 'IND_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Kiswahili Kipevu', code: 'KK_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'Foreign Languages', code: 'FL_SS', level: 'CBC_SENIOR_SCHOOL', category: 'LANGUAGE' },
  { name: 'History and Citizenship', code: 'HC_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY' },
  { name: 'Geography', code: 'GEO_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY' },
  { name: 'Business Studies', code: 'BS_SS', level: 'CBC_SENIOR_SCHOOL', category: 'HUMANITY' },
];
