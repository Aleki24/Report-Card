/**
 * Validation scenarios for multi-paper aggregation.
 * Run with: npx tsx scripts/test-multi-paper.ts
 */
import assert from 'node:assert';
import {
    calculateCompositeSubjectScore,
    resolveAssessmentMode,
    getSubjectPresetForPapers,
    normalizeResolvedRawScore,
} from '../src/lib/multi-paper';

let passed = 0;
const check = (label: string, fn: () => void) => {
    fn();
    passed++;
    console.log(`✅ ${label}`);
};

// ── Example 1: Mathematics — sum_then_percentage ──────────
check('Mathematics: P1 56/80 + P2 44/60 → 71.43%', () => {
    const r = calculateCompositeSubjectScore(
        [
            { code: 'P1', maxScore: 80, score: 56, displayOrder: 1 },
            { code: 'P2', maxScore: 60, score: 44, displayOrder: 2 },
        ],
        'sum_then_percentage'
    );
    assert.strictEqual(r.finalPercentage, 71.43); // (56+44)/(80+60)*100
    assert.strictEqual(r.totalRawScore, 100);
    assert.strictEqual(r.totalPossible, 140);
    assert.strictEqual(r.isComplete, true);
    assert.strictEqual(r.breakdown.length, 2);
});

// ── Example 2: English — languages_average_percentages ────
check('English: 24/40, 36/60, 18/20 → 70%', () => {
    const r = calculateCompositeSubjectScore(
        [
            { code: 'P1', maxScore: 40, score: 24, displayOrder: 1 },
            { code: 'P2', maxScore: 60, score: 36, displayOrder: 2 },
            { code: 'P3', maxScore: 20, score: 18, displayOrder: 3 },
        ],
        'languages_average_percentages'
    );
    assert.strictEqual(r.finalPercentage, 70); // (60+60+90)/3
    assert.deepStrictEqual(r.breakdown.map(b => b.percentage), [60, 60, 90]);
});

// ── Example 3: Biology — science_70_plus_practical ────────
check('Biology: theory (25+50)/(40+60)×70 + practical 24/30×30 → 76.5%', () => {
    const r = calculateCompositeSubjectScore(
        [
            { code: 'P1', maxScore: 40, score: 25, displayOrder: 1 },
            { code: 'P2', maxScore: 60, score: 50, displayOrder: 2 },
            { code: 'P3', maxScore: 30, score: 24, displayOrder: 3 },
        ],
        'science_70_plus_practical'
    );
    // theory = 75/100*70 = 52.5 ; practical = 24/30*30 = 24 → 76.5
    assert.strictEqual(r.finalPercentage, 76.5);
});

// ── Edge cases ────────────────────────────────────────────
check('Missing paper counts as 0 and flags incomplete', () => {
    const r = calculateCompositeSubjectScore(
        [
            { code: 'P1', maxScore: 80, score: 56, displayOrder: 1 },
            { code: 'P2', maxScore: 60, score: null, displayOrder: 2 },
        ],
        'sum_then_percentage'
    );
    assert.strictEqual(r.finalPercentage, 40); // 56/140
    assert.strictEqual(r.isComplete, false);
    assert.strictEqual(r.enteredCount, 1);
});

check('Papers resolve in display_order (practical = last)', () => {
    const r = calculateCompositeSubjectScore(
        [
            { code: 'P3', maxScore: 30, score: 24, displayOrder: 3 },
            { code: 'P1', maxScore: 40, score: 25, displayOrder: 1 },
            { code: 'P2', maxScore: 60, score: 50, displayOrder: 2 },
        ],
        'science_70_plus_practical'
    );
    assert.strictEqual(r.finalPercentage, 76.5);
});

check('normalizeResolvedRawScore maps final % onto exam max_score', () => {
    assert.strictEqual(normalizeResolvedRawScore(71.43, 100), 71.43);
    assert.strictEqual(normalizeResolvedRawScore(50, 60), 30);
});

// ── resolveAssessmentMode ─────────────────────────────────
check('resolveAssessmentMode defaults to single_paper', () => {
    assert.strictEqual(resolveAssessmentMode(null), 'single_paper');
    assert.strictEqual(resolveAssessmentMode(undefined), 'single_paper');
    assert.strictEqual(
        resolveAssessmentMode({ assessment_mode: 'multi_paper', is_enabled: false, components: [{ id: '1' } as any, { id: '2' } as any] }),
        'single_paper'
    );
    assert.strictEqual(
        resolveAssessmentMode({ assessment_mode: 'multi_paper', is_enabled: true, components: [{ id: '1' } as any] }),
        'single_paper'
    );
    assert.strictEqual(
        resolveAssessmentMode({ assessment_mode: 'multi_paper', is_enabled: true, components: [{ id: '1' } as any, { id: '2' } as any] }),
        'multi_paper'
    );
});

// ── Presets across 8-4-4 (Form 3–4) and CBC Senior (G10–12) ──
check('Presets match subjects across levels', () => {
    assert.strictEqual(getSubjectPresetForPapers('Mathematics Alternative A')?.presetKey, 'mathematics');
    assert.strictEqual(getSubjectPresetForPapers('Mathematics (STEM)')?.presetKey, 'mathematics');
    assert.strictEqual(getSubjectPresetForPapers('English')?.presetKey, 'english');
    assert.strictEqual(getSubjectPresetForPapers('Advanced English')?.presetKey, 'english');
    assert.strictEqual(getSubjectPresetForPapers('Kiswahili')?.presetKey, 'kiswahili');
    assert.strictEqual(getSubjectPresetForPapers('Kiswahili Kipevu')?.presetKey, 'kiswahili');
    assert.strictEqual(getSubjectPresetForPapers('Biology')?.presetKey, 'biology');
    assert.strictEqual(getSubjectPresetForPapers('Chemistry')?.presetKey, 'chemistry');
    assert.strictEqual(getSubjectPresetForPapers('Physics')?.presetKey, 'physics');
    // No preset for these — configurable manually, never forced
    assert.strictEqual(getSubjectPresetForPapers('Geography'), null);
    assert.strictEqual(getSubjectPresetForPapers('Literature in English'), null);
    assert.strictEqual(getSubjectPresetForPapers('History and Government'), null);
});

console.log(`\n${passed} checks passed.`);
