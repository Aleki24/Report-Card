import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/school/exam-marks/scan
 *
 * Extracts student → mark pairs from a photo of a paper marksheet using
 * Claude vision. This endpoint only extracts — it never writes marks.
 * The client matches rows against the roster and saves through the
 * regular /api/school/exam-marks flow after teacher review.
 */

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

// ~10 MB of base64 (client downscales well below this; hard cap for safety)
const MAX_BASE64_LENGTH = 14_000_000;

interface ScanRow {
  row: number;
  student_name: string;
  admission_number: string | null;
  score: number | null;
  confidence: 'high' | 'medium' | 'low';
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          row: { type: 'integer', description: '1-based row position on the sheet' },
          student_name: { type: 'string', description: 'Student name exactly as written' },
          admission_number: {
            type: ['string', 'null'],
            description: 'Admission/index number if present on the row, else null',
          },
          score: {
            type: ['number', 'null'],
            description: 'The mark for this student; null if blank or unreadable',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'How certain the transcription of THIS row is',
          },
        },
        required: ['row', 'student_name', 'admission_number', 'score', 'confidence'],
        additionalProperties: false,
      },
    },
    sheet_readable: {
      type: 'boolean',
      description: 'False if the photo is too blurry/dark to extract anything useful',
    },
    notes: {
      type: ['string', 'null'],
      description: 'Short note about problems (cropped columns, ambiguous handwriting), else null',
    },
  },
  required: ['rows', 'sheet_readable', 'notes'],
  additionalProperties: false,
} as const;

function parseDataUrl(image: string): { mediaType: AllowedMediaType; data: string } | null {
  const match = /^data:(image\/[a-z+]+);base64,([\s\S]+)$/.exec(image);
  if (!match) return null;
  const mediaType = match[1] as AllowedMediaType;
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) return null;
  return { mediaType, data: match[2] };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', userId)
      .single();

    if (!userProfile || !['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Marksheet scanning is not configured for this server. Ask your administrator to set ANTHROPIC_API_KEY.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { image, max_score } = body as { image?: string; max_score?: number };

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'image (data URL) is required' }, { status: 400 });
    }
    if (image.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large. Please retake or compress the photo.' }, { status: 413 });
    }

    const parsed = parseDataUrl(image);
    if (!parsed) {
      return NextResponse.json({ error: 'image must be a base64 data URL (jpeg, png, webp, or gif)' }, { status: 400 });
    }

    const maxScore = typeof max_score === 'number' && max_score > 0 ? max_score : 100;

    const client = new Anthropic();
    const model = process.env.ANTHROPIC_SCAN_MODEL || 'claude-opus-4-8';

    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
            },
            {
              type: 'text',
              text: [
                'This photo shows a school marksheet: a handwritten or printed list of students and their exam marks.',
                `Marks are out of ${maxScore}.`,
                'Extract every student row you can read. Transcribe names exactly as written (do not correct spelling).',
                'If a row has an admission/index number, include it. If a mark is blank, absent, or unreadable, use null for score.',
                `Ignore header rows, totals, averages, and signatures. A score greater than ${maxScore} is likely a misread — mark that row low confidence.`,
                'Rate confidence per row: high = clearly legible, medium = probably right, low = a guess.',
              ].join(' '),
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'The image could not be processed. Please retake the photo of the marksheet.' },
        { status: 422 }
      );
    }

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    );
    if (!textBlock) {
      return NextResponse.json({ error: 'No extraction result returned. Try again.' }, { status: 502 });
    }

    let extraction: { rows: ScanRow[]; sheet_readable: boolean; notes: string | null };
    try {
      extraction = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json({ error: 'Could not parse extraction result. Try again.' }, { status: 502 });
    }

    if (!extraction.sheet_readable || extraction.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Could not read the marksheet. Retake the photo closer, with more light, and keep the sheet flat.',
          notes: extraction.notes,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      rows: extraction.rows,
      notes: extraction.notes,
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Scanning is busy right now — try again in a minute.' }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'The scanning API key is invalid. Ask your administrator to check ANTHROPIC_API_KEY.' },
        { status: 503 }
      );
    }
    if (err instanceof Anthropic.BadRequestError && err.message.toLowerCase().includes('credit balance')) {
      return NextResponse.json(
        { error: 'The scanning account is out of API credits. Ask your administrator to top up at console.anthropic.com → Plans & Billing.' },
        { status: 503 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Scan API error:', err.status, err.message);
      return NextResponse.json({ error: 'Scanning service error. Try again shortly.' }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
