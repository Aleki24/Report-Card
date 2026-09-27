import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/** One row of a scheme of work, as the model returns it and the table stores it. */
export const schemeEntrySchema = z.object({
    week: z.number().int().min(1).max(20),
    lesson: z.number().int().min(1).max(20),
    topic: z.string().trim().min(1).max(300),
    sub_topic: z.string().trim().max(300).nullable(),
    objectives: z.string().trim().max(3000).nullable(),
    activities: z.string().trim().max(3000).nullable(),
    resources: z.string().trim().max(2000).nullable(),
    assessment: z.string().trim().max(2000).nullable(),
});
export type SchemeEntryInput = z.infer<typeof schemeEntrySchema>;

const DRAFT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['entries'],
    properties: {
        entries: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['week', 'lesson', 'topic', 'sub_topic', 'objectives', 'activities', 'resources', 'assessment'],
                properties: {
                    week: { type: 'integer' },
                    lesson: { type: 'integer' },
                    topic: { type: 'string' },
                    sub_topic: { type: ['string', 'null'] },
                    objectives: { type: ['string', 'null'] },
                    activities: { type: ['string', 'null'] },
                    resources: { type: ['string', 'null'] },
                    assessment: { type: ['string', 'null'] },
                },
            },
        },
    },
} as const;

export interface DraftRequest {
    subject: string;
    className: string;
    weeks: number;
    lessonsPerWeek: number;
    /** What the teacher wants covered this term, in their words. */
    topics: string;
}

export type DraftResult = { ok: true; entries: SchemeEntryInput[] } | { ok: false; reason: string };

/**
 * Drafts a term's scheme of work for a Kenyan class with Claude. The teacher
 * reviews and edits every row before it is saved; nothing is stored here.
 */
export async function draftScheme(req: DraftRequest): Promise<DraftResult> {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
        model: process.env.ANTHROPIC_DRAFT_MODEL || 'claude-opus-5',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
        system: 'You help Kenyan teachers prepare professional records that meet TSC and Quality Assurance expectations. Follow the Kenyan curriculum (CBC/CBE or 8-4-4 as the class implies). Write concise, practical entries a teacher can use in class.',
        messages: [{
            role: 'user',
            content: [
                `Draft a scheme of work for ${req.subject}, ${req.className}.`,
                `The term has ${req.weeks} teaching weeks with ${req.lessonsPerWeek} lessons a week; produce one entry per lesson (week 1..${req.weeks}, lesson 1..${req.lessonsPerWeek}).`,
                'For each lesson give the topic, sub-topic (or strand/sub-strand for CBC), specific learning objectives starting "By the end of the lesson, the learner should be able to", learning activities, resources (name textbooks generically, e.g. "course book"), and how learning will be assessed.',
                req.topics.trim() ? `Cover these topics in this order where possible: ${req.topics.trim()}` : 'Follow the usual order of the syllabus for this term.',
                'Leave the last week for revision and assessment.',
            ].join('\n'),
        }],
    });

    if (response.stop_reason === 'refusal') return { ok: false, reason: 'The draft could not be written. Try describing the topics differently.' };
    if (response.stop_reason === 'max_tokens') return { ok: false, reason: 'The draft was too long. Try fewer weeks or lessons.' };
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text');
    if (!text) return { ok: false, reason: 'No draft came back. Try again.' };

    let raw: unknown;
    try { raw = JSON.parse(text.text); } catch { return { ok: false, reason: 'The draft came back malformed. Try again.' }; }
    const parsed = z.object({ entries: z.array(schemeEntrySchema).max(400) }).safeParse(raw);
    if (!parsed.success) return { ok: false, reason: 'The draft came back malformed. Try again.' };
    // One row per week/lesson slot, as the table's unique key requires.
    const seen = new Set<string>();
    const entries = parsed.data.entries.filter(e => {
        const key = `${e.week}|${e.lesson}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return { ok: true, entries };
}
