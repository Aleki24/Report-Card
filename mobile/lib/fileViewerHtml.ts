import { isImageType, type AttachmentMimeType } from '@shared/attachments';

/** What the in-app viewer can show itself; anything else opens in another app. */
export type PreviewKind = 'pdf' | 'image' | 'docx' | 'text';

const CDN = 'https://cdnjs.cloudflare.com';
const PDFJS = `${CDN}/ajax/libs/pdf.js/3.11.174`;
const MAMMOTH = `${CDN}/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js`;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The page's origin: pdf.js starts its worker from the same place it is served. */
export const VIEWER_BASE_URL = `${CDN}/`;

/** Messages the page posts back: it is showing the file, or it could not. */
export const VIEWER_READY = 'ready';
export const VIEWER_ERROR = 'error';

export function previewKind(type: AttachmentMimeType | null): PreviewKind | null {
    if (!type) return null;
    if (type === 'application/pdf') return 'pdf';
    if (isImageType(type)) return 'image';
    if (type === DOCX) return 'docx';
    if (type === 'text/plain') return 'text';
    return null;
}

/**
 * The document's own content (a Word file's HTML, a text file) can load
 * nothing from outside: scripts only from the CDN, images only inline.
 */
const CSP = [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${CDN}`,
    `worker-src blob: ${CDN}`,
    `connect-src data: blob: ${CDN}`,
    "img-src data: blob:",
    "style-src 'unsafe-inline'",
    "font-src data:",
].join('; ');

const STYLE = `
    html, body { margin: 0; background: #e5e7eb; }
    #status { font: 14px -apple-system, Roboto, sans-serif; color: #4b5563; text-align: center; padding: 32px 16px; }
    #pages canvas { display: block; width: calc(100% - 16px); margin: 8px auto; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    #doc:empty { display: none; }
    #doc { background: #fff; margin: 8px; padding: 20px 18px; font: 15px/1.55 Georgia, serif; color: #111; overflow-wrap: anywhere; }
    #doc img, #image { max-width: 100%; height: auto; }
    #doc table { border-collapse: collapse; max-width: 100%; }
    #doc td, #doc th { border: 1px solid #d1d5db; padding: 4px 6px; }
    #doc pre { white-space: pre-wrap; font: 13px/1.5 ui-monospace, Menlo, monospace; margin: 0; }
    #image { display: block; margin: 0 auto; }
`;

/** Shared by every kind: report back to the app, and decode the file. */
const PRELUDE = `
    function post(message) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message); }
    function fail(reason) { post('${VIEWER_ERROR}:' + (reason || 'unknown')); }
    function fileBytes() {
        var bin = atob(window.FILE_DATA), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    window.onerror = function (message) { fail(String(message)); };
`;

const PDF_SCRIPT = `
    if (!window.pdfjsLib) { fail('viewer did not load'); }
    else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
        pdfjsLib.getDocument({ data: fileBytes(), isEvalSupported: false }).promise.then(async function (pdf) {
            var box = document.getElementById('pages');
            var status = document.getElementById('status');
            var ratio = Math.min(window.devicePixelRatio || 1, 2);
            for (var n = 1; n <= pdf.numPages; n++) {
                var page = await pdf.getPage(n);
                var width = page.getViewport({ scale: 1 }).width;
                var viewport = page.getViewport({ scale: (box.clientWidth / width) * ratio });
                var canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                box.appendChild(canvas);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
                if (n === 1) { status.remove(); post('${VIEWER_READY}'); }
            }
        }).catch(function (e) { fail(e && e.message); });
    }
`;

const DOCX_SCRIPT = `
    if (!window.mammoth) { fail('viewer did not load'); }
    else {
        mammoth.convertToHtml({ arrayBuffer: fileBytes().buffer }).then(function (result) {
            document.getElementById('status').remove();
            document.getElementById('doc').innerHTML = result.value;
            post('${VIEWER_READY}');
        }).catch(function (e) { fail(e && e.message); });
    }
`;

const TEXT_SCRIPT = `
    document.getElementById('status').remove();
    var pre = document.createElement('pre');
    pre.textContent = new TextDecoder('utf-8').decode(fileBytes());
    document.getElementById('doc').appendChild(pre);
    post('${VIEWER_READY}');
`;

/**
 * A page that shows one file in the app's web view. The file arrives as
 * base64 in the page itself, so nothing about it leaves the phone; only the
 * viewer libraries come from the CDN.
 */
export function viewerHtml(kind: PreviewKind, base64: string, type: AttachmentMimeType): string {
    const head = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>${STYLE}</style></head><body>`;
    if (kind === 'image') {
        return `${head}<img id="image" alt="" src="data:${type};base64,${base64}">
<script>${PRELUDE}
var img = document.getElementById('image');
img.onload = function () { post('${VIEWER_READY}'); };
img.onerror = function () { fail('image'); };
</script></body></html>`;
    }
    const library = kind === 'pdf' ? `${PDFJS}/pdf.min.js` : kind === 'docx' ? MAMMOTH : null;
    const script = kind === 'pdf' ? PDF_SCRIPT : kind === 'docx' ? DOCX_SCRIPT : TEXT_SCRIPT;
    return `${head}<div id="status">Opening…</div><div id="pages"></div><div id="doc"></div>
<script>${PRELUDE}window.FILE_DATA = "${base64}";</script>
${library ? `<script src="${library}" onerror="fail('viewer did not load')"></script>` : ''}
<script>${script}</script></body></html>`;
}
