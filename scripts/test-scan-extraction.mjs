/**
 * Smoke-test the marksheet extraction used by /api/school/exam-marks/scan
 * without running the app.
 *
 *   ANTHROPIC_API_KEY=sk-... node scripts/test-scan-extraction.mjs [image] [maxScore]
 *
 * Defaults to the synthetic fixture at scripts/fixtures/sample-marksheet.png.
 * Uses the same model default, prompt, and JSON schema as the API route —
 * if this prints rows, the in-app scan flow will work.
 */
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const imagePath = process.argv[2] || path.join(import.meta.dirname, 'fixtures', 'sample-marksheet.png');
const maxScore = Number(process.argv[3]) || 100;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY first.');
  process.exit(1);
}

const mediaType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
const data = fs.readFileSync(imagePath).toString('base64');

const schema = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          row: { type: 'integer' },
          student_name: { type: 'string' },
          admission_number: { type: ['string', 'null'] },
          score: { type: ['number', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['row', 'student_name', 'admission_number', 'score', 'confidence'],
        additionalProperties: false,
      },
    },
    sheet_readable: { type: 'boolean' },
    notes: { type: ['string', 'null'] },
  },
  required: ['rows', 'sheet_readable', 'notes'],
  additionalProperties: false,
};

const client = new Anthropic();
const model = process.env.ANTHROPIC_SCAN_MODEL || 'claude-opus-4-8';
console.log(`Scanning ${imagePath} with ${model} (marks out of ${maxScore})…`);

const response = await client.messages.create({
  model,
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  output_config: { format: { type: 'json_schema', schema } },
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
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
  console.error('Refused:', response.stop_details);
  process.exit(1);
}
const text = response.content.find((b) => b.type === 'text')?.text ?? '';
const result = JSON.parse(text);
console.log(`sheet_readable: ${result.sheet_readable}  notes: ${result.notes ?? '—'}`);
console.table(result.rows);
console.log(`tokens: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
