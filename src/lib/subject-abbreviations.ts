/**
 * Subject abbreviations for narrow columns (the class marksheet).
 *
 * Schools already have conventional short forms — MAT, PHY, CRE, HIST — and a
 * generated abbreviation like "Mathem" reads as a mistake next to them.
 *
 * Kenyan report forms are not consistent with each other: the same subject
 * appears as CHE or CHEM, HIS or HAG or HIST, AGR or AGRIC, BST or BUS, CMP
 * or COMP depending on the school. This list follows the longer, unambiguous
 * form the school asked for, and uses the widely-used short forms (SST, HSC,
 * KSL) for subjects they did not name. Anything unlisted falls back to a
 * derived short form so a custom subject still gets a sensible column head.
 *
 * Order matters: the first pattern that matches wins, so the specific rules
 * ("Literature in English", "Agriculture & Nutrition") sit above the general
 * ones they would otherwise be swallowed by.
 */

interface Rule {
    /** Tested against the lower-cased, punctuation-stripped subject name. */
    match: (name: string) => boolean;
    abbr: string;
}

const has = (...needles: string[]) => (name: string) => needles.some(n => name.includes(n));

/**
 * Whole-word match, for the short acronyms. Substring matching cannot be used
 * for these: "Creative Arts" contains "cre" and was being abbreviated CRE.
 */
const word = (...needles: string[]) => (name: string) => {
    const words = name.split(' ');
    return needles.some(n => words.includes(n));
};

const either = (...tests: ((name: string) => boolean)[]) => (name: string) => tests.some(t => t(name));

const RULES: Rule[] = [
    // Specific first — these contain words that later rules also match on.
    { match: has('literature'), abbr: 'LIT' },
    // "Creative Arts" is matched before the religious-education acronyms and
    // those acronyms are whole-word only, so it can never collapse to CRE.
    { match: has('creative art'), abbr: 'C/A' },
    { match: either(has('christian religious'), word('cre')), abbr: 'CRE' },
    { match: either(has('islamic religious'), word('ire')), abbr: 'IRE' },
    { match: either(has('hindu religious'), word('hre')), abbr: 'HRE' },
    { match: has('religious'), abbr: 'RE' },
    { match: has('agriculture and nutrition', 'agriculture nutrition'), abbr: 'AGN' },
    { match: has('home science'), abbr: 'HSC' },
    { match: has('integrated science'), abbr: 'I/SCI' },
    { match: has('social studies'), abbr: 'SST' },
    { match: has('pre technical', 'pretechnical', 'pre-technical'), abbr: 'P/TECH' },
    { match: has('life skill'), abbr: 'LSK' },
    { match: has('business'), abbr: 'BUS' },
    { match: either(has('computer', 'information communication'), word('ict')), abbr: 'COMP' },
    { match: has('agriculture', 'agric'), abbr: 'AGRIC' },

    // Core subjects.
    { match: either(has('mathematic'), word('maths', 'math', 'mat')), abbr: 'MAT' },
    { match: has('english'), abbr: 'ENG' },
    { match: has('kiswahili', 'swahili'), abbr: 'KIS' },
    { match: has('biology'), abbr: 'BIO' },
    { match: has('chemistry'), abbr: 'CHEM' },
    { match: has('physics'), abbr: 'PHY' },
    { match: has('history'), abbr: 'HIST' },
    { match: has('geography'), abbr: 'GEO' },

    // Technicals and languages.
    { match: has('woodwork'), abbr: 'WW' },
    { match: has('metalwork'), abbr: 'MW' },
    { match: has('building construction'), abbr: 'BC' },
    { match: has('power mechanic'), abbr: 'PM' },
    { match: has('electric'), abbr: 'ELEC' },
    { match: has('drawing and design', 'drawing design'), abbr: 'D&D' },
    { match: has('general science'), abbr: 'G/SCI' },
    { match: has('aviation'), abbr: 'AVI' },
    { match: has('music'), abbr: 'MUS' },
    { match: has('art and design', 'art design', 'art'), abbr: 'ART' },
    { match: has('french'), abbr: 'FRE' },
    { match: has('german'), abbr: 'GER' },
    { match: has('arabic'), abbr: 'ARB' },
    { match: has('sign language'), abbr: 'KSL' },
    { match: has('physical education', 'sport'), abbr: 'PE' },
];

/**
 * Derived short form for a subject with no conventional abbreviation:
 * significant words' openings, so "Marine Fisheries" reads "MAR FIS".
 */
function derive(name: string): string {
    const words = name.split(/\s+/).filter(w => !/^(and|of|the|in|for)$/.test(w));
    if (words.length === 0) return name.slice(0, 5).toUpperCase();
    if (words.length === 1) return words[0].slice(0, 5).toUpperCase();
    return `${words[0].slice(0, 3)} ${words[1].slice(0, 3)}`.toUpperCase();
}

/**
 * A subject's column head. Falls back to the syllabus code only when there is
 * no name at all.
 */
export function abbreviateSubject(name: string, code = ''): string {
    const clean = (name || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return code || '';

    for (const rule of RULES) {
        if (rule.match(clean)) return rule.abbr;
    }
    return derive(clean);
}
