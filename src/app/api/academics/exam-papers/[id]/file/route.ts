import { NextResponse } from 'next/server';
import { route, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { canOpenFiles, PAPER_FILE_KINDS, type PaperFileKind } from '@/lib/academics/exam-papers';
import { BUCKET, loadPaper } from '@/lib/academics/exam-papers-server';
import { watermarkPdf } from '@/lib/academics/watermark';

type Params = { id: string };

/**
 * Streams a paper or marking scheme. PDFs are stamped with the viewer's name
 * and the time; Word files are served as stored. Every download is audited.
 */
export const GET = route<Params>(
    'exam paper file',
    { module: 'exam_papers', permission: ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'] },
    async ({ access, params, request }) => {
        const kind = request.nextUrl.searchParams.get('kind') ?? 'paper';
        if (!(PAPER_FILE_KINDS as readonly string[]).includes(kind)) throw new HttpError(400, 'Unknown file.');
        const paper = await loadPaper(params.id, access);
        if (!canOpenFiles(paper, access)) throw new HttpError(403, 'You cannot open this paper yet.');
        const path = kind === 'paper' ? paper.paper_path : paper.scheme_path;
        if (!path) throw new HttpError(404, 'No file has been uploaded.');

        const db = createSupabaseAdmin();
        const { data: blob, error } = await db.storage.from(BUCKET).download(path);
        if (error || !blob) throw new Error(`download failed: ${error?.message}`);

        const { data: me } = await db.from('users').select('first_name, last_name').eq('id', access.userId).maybeSingle();
        const who = `${me?.first_name ?? ''} ${me?.last_name ?? ''}`.trim() || access.userId;
        const stamp = `CONFIDENTIAL · ${who} · ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`;

        const isPdf = path.endsWith('.pdf');
        let bytes = new Uint8Array(await blob.arrayBuffer());
        if (isPdf) {
            try { bytes = new Uint8Array(await watermarkPdf(bytes, stamp)); }
            catch (err) { console.error('[exam paper watermark]', err); }
        }
        await audit(access, 'download', 'exam_papers', paper.id, { kind: kind as PaperFileKind, watermarked: isPdf });

        const ext = path.slice(path.lastIndexOf('.') + 1);
        return new NextResponse(Buffer.from(bytes), {
            headers: {
                'Content-Type': blob.type || 'application/octet-stream',
                'Content-Disposition': `${isPdf ? 'inline' : 'attachment'}; filename="${kind}-${paper.id.slice(0, 8)}.${ext}"`,
                'Cache-Control': 'private, no-store',
            },
        });
    },
);
