import sharp from 'sharp';

/** Why a photo cannot be used as a signature, worded for the person who took it. */
export class SignatureImageError extends Error {}

/** Photos are worked on at this size: plenty for a signature, quick to process. */
const WORK_SIZE = 1400;
/** The stored signature: a transparent strip, at most this big. */
const OUT_WIDTH = 720;
const OUT_HEIGHT = 200;
/** Dark navy ink, so a signature reads as signed in pen on any card colour. */
const INK = { r: 20, g: 30, b: 72 } as const;
/**
 * Ink is what is darker than the paper around it: below LOW (as a share of the
 * local paper brightness) it is paper, above HIGH it is solid ink, and in
 * between it fades, which keeps strokes smooth.
 */
const LOW = 0.14;
const HIGH = 0.34;
/** Specks and the photo's edges (the table, the paper's edge) are not ink. */
const EDGE_MARGIN = 0.025;
/**
 * A pixel stays ink when this many of its 8 neighbours are ink too (at least
 * INK_NEAR strong). Two keeps a thin ballpoint line, one pixel wide on the
 * diagonal, whole; a lone speck of grain has none.
 */
const MIN_NEIGHBOURS = 2;
const INK_NEAR = 96;
/** Less ink than this is an empty page; more is not a signature on white paper. */
const MIN_INK_SHARE = 0.0004;
const MAX_INK_SHARE = 0.3;
const PADDING = 10;
/** The paper is estimated at this fraction of the working size. */
const PAPER_SCALE = 4;
/** Paper darker than this is not white paper; more than this share of it means a dark photo. */
const DARK_PAPER = 80;
const MAX_DARK_PAPER_SHARE = 0.3;

/**
 * Turns a phone photo of a signature on paper into a clean signature: the
 * paper (with its shadows and uneven light) becomes transparent and the
 * strokes a dark ink, cropped to the signature. Laid over a signature line,
 * it reads as signed rather than as a grey photo pasted on the card.
 *
 * Returns a PNG. Throws SignatureImageError when the photo holds no usable
 * signature.
 */
export async function cleanSignaturePhoto(input: Buffer): Promise<Buffer> {
    let grey: Buffer;
    let width: number;
    let height: number;
    try {
        const image = sharp(input, { failOn: 'error' })
            .rotate() // the phone's orientation
            .resize({ width: WORK_SIZE, height: WORK_SIZE, fit: 'inside', withoutEnlargement: true })
            .greyscale();
        const { width: w, height: h } = await image.clone().toBuffer({ resolveWithObject: true }).then(r => r.info);
        grey = await greyPixels(image);
        width = w;
        height = h;
    } catch {
        throw new SignatureImageError('That file is not a photo we can read. Take the photo again, or choose a JPEG or PNG.');
    }

    // The paper's brightness at each point, pen strokes removed: a closing
    // (brightest nearby, then darkest nearby) wipes out thin dark lines but
    // keeps large dark areas, so a shadow across the page, even a sharp one,
    // stays paper and is not mistaken for ink.
    // The paper is smooth, so it is worked out on a quarter-size copy (fast)
    // and scaled back up.
    const smallWidth = Math.max(1, Math.round(width / PAPER_SCALE));
    const smallHeight = Math.max(1, Math.round(height / PAPER_SCALE));
    const small = await greyPixels(sharp(grey, { raw: { width, height, channels: 1 } }).resize(smallWidth, smallHeight, { fit: 'fill' }));
    const radius = Math.max(3, Math.round(Math.min(smallWidth, smallHeight) * 0.02));
    const closed = minFilter(maxFilter(small, smallWidth, smallHeight, radius), smallWidth, smallHeight, radius);
    const paper = await greyPixels(sharp(closed, { raw: { width: smallWidth, height: smallHeight, channels: 1 } }).resize(width, height, { fit: 'fill' }).blur(2));

    // A signature is photographed on paper: a mostly dark "paper" is
    // something else (a dark desk, the floor, a screen).
    let darkPaper = 0;
    for (let i = 0; i < paper.length; i++) if (paper[i] < DARK_PAPER) darkPaper++;
    if (darkPaper / paper.length > MAX_DARK_PAPER_SHARE) {
        throw new SignatureImageError('That photo is too dark to be a signature on white paper. Sign on plain white paper and photograph it in good light.');
    }

    const alpha = new Uint8Array(width * height);
    const marginX = Math.round(width * EDGE_MARGIN);
    const marginY = Math.round(height * EDGE_MARGIN);
    for (let y = marginY; y < height - marginY; y++) {
        for (let x = marginX; x < width - marginX; x++) {
            const i = y * width + x;
            const bg = Math.max(paper[i], 1);
            const darker = (bg - grey[i]) / bg;
            const strength = Math.min(1, Math.max(0, (darker - LOW) / (HIGH - LOW)));
            alpha[i] = Math.round(strength * 255);
        }
    }

    // Keep ink that has ink around it; lone specks are dust or grain.
    let inkPixels = 0;
    const kept = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            if (alpha[i] < 128) { kept[i] = alpha[i] > 0 && hasInkNear(alpha, width, x, y) ? alpha[i] : 0; continue; }
            if (!hasInkNear(alpha, width, x, y)) continue;
            kept[i] = alpha[i];
            inkPixels++;
        }
    }

    const share = inkPixels / (width * height);
    if (inkPixels === 0 || share < MIN_INK_SHARE) {
        throw new SignatureImageError('No signature was found in that photo. Sign in dark pen on plain white paper, and fill the frame with the signature.');
    }
    if (share > MAX_INK_SHARE) {
        throw new SignatureImageError('That photo has too much dark in it to be a signature. Photograph only the signature on plain white paper, in good light.');
    }

    const box = keepStrokes(kept, width, height);
    if (!box) {
        throw new SignatureImageError('No signature was found in that photo. Sign in dark pen on plain white paper, and fill the frame with the signature.');
    }
    const { left, top, right, bottom } = box;

    const x0 = Math.max(0, left - PADDING);
    const y0 = Math.max(0, top - PADDING);
    const cropWidth = Math.min(width, right + PADDING + 1) - x0;
    const cropHeight = Math.min(height, bottom + PADDING + 1) - y0;
    const rgba = Buffer.alloc(cropWidth * cropHeight * 4);
    for (let y = 0; y < cropHeight; y++) {
        for (let x = 0; x < cropWidth; x++) {
            const o = (y * cropWidth + x) * 4;
            rgba[o] = INK.r;
            rgba[o + 1] = INK.g;
            rgba[o + 2] = INK.b;
            rgba[o + 3] = kept[(y + y0) * width + (x + x0)];
        }
    }

    return sharp(rgba, { raw: { width: cropWidth, height: cropHeight, channels: 4 } })
        .resize({ width: OUT_WIDTH, height: OUT_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/**
 * One byte per pixel. sharp hands back raw pixels in the image's colour
 * space, which after some operations is RGB again even for a grey image;
 * reading that as one byte per pixel striped the result.
 */
async function greyPixels(image: sharp.Sharp): Promise<Buffer> {
    const { data, info } = await image.toColourspace('b-w').extractChannel(0).raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 1) throw new Error(`expected one channel, got ${info.channels}`);
    return data;
}

/** Each pixel becomes the brightest (max) or darkest (min) within `radius`, as a square window. */
function windowFilter(src: Uint8Array, width: number, height: number, radius: number, pick: (a: number, b: number) => number): Uint8Array {
    const across = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            let v = src[row + x];
            for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) v = pick(v, src[row + k]);
            across[row + x] = v;
        }
    }
    const out = new Uint8Array(src.length);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let v = across[y * width + x];
            for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) v = pick(v, across[k * width + x]);
            out[y * width + x] = v;
        }
    }
    return out;
}

const maxFilter = (src: Uint8Array, w: number, h: number, r: number) => windowFilter(src, w, h, r, Math.max);
const minFilter = (src: Uint8Array, w: number, h: number, r: number) => windowFilter(src, w, h, r, Math.min);

function hasInkNear(alpha: Uint8Array, width: number, x: number, y: number): boolean {
    let near = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && alpha[(y + dy) * width + (x + dx)] >= INK_NEAR) near++;
        }
    }
    return near >= MIN_NEIGHBOURS;
}

/* ── Strokes ──────────────────────────────────────────────── */

/** Strong enough to count as a stroke when finding the signature's extent. */
const STROKE = 96;
/** A clump of ink smaller than this share of all the ink is dust, not a stroke. */
const DUST_SHARE = 0.004;
/** A long thin mark across this share of the image is a ruled line or the paper's edge. */
const RULE_SPAN = 0.6;
const RULE_THICKNESS = 0.06;

export interface InkBox { left: number; top: number; right: number; bottom: number }

/**
 * Finds the signature's strokes in an alpha mask and clears everything else:
 * clumps of dust, and ruled lines or paper edges running across the photo.
 * Either one, left in, stretched the crop to the whole page, and the
 * signature printed as a speck in the middle of it. Returns the strokes'
 * bounding box, or null when nothing but dust and lines is left.
 */
export function keepStrokes(alpha: Uint8Array, width: number, height: number): InkBox | null {
    const label = new Int32Array(width * height).fill(-1);
    const components: { pixels: number[]; left: number; top: number; right: number; bottom: number }[] = [];
    let total = 0;
    const stack: number[] = [];
    for (let start = 0; start < alpha.length; start++) {
        if (alpha[start] < STROKE || label[start] !== -1) continue;
        const c = { pixels: [] as number[], left: width, top: height, right: -1, bottom: -1 };
        label[start] = components.length;
        stack.push(start);
        while (stack.length > 0) {
            const i = stack.pop()!;
            const x = i % width;
            const y = (i - x) / width;
            c.pixels.push(i);
            if (x < c.left) c.left = x;
            if (x > c.right) c.right = x;
            if (y < c.top) c.top = y;
            if (y > c.bottom) c.bottom = y;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const n = ny * width + nx;
                    if (alpha[n] >= STROKE && label[n] === -1) { label[n] = components.length; stack.push(n); }
                }
            }
        }
        total += c.pixels.length;
        components.push(c);
    }

    const dust = Math.max(4, total * DUST_SHARE);
    const thinness = (extent: number) => Math.max(3, extent * RULE_THICKNESS);
    // A ruled line: one long thin mark, or (photographed small, it breaks
    // up) a row of thin dashes that together run across the image.
    const rules = new Set<(typeof components)[number]>();
    for (const c of components) {
        const w = c.right - c.left + 1;
        const h = c.bottom - c.top + 1;
        if ((w >= width * RULE_SPAN && h <= thinness(height)) || (h >= height * RULE_SPAN && w <= thinness(width))) rules.add(c);
    }
    const dashes = components
        .filter(c => !rules.has(c) && c.bottom - c.top + 1 <= thinness(height) && c.right - c.left + 1 >= 3 * (c.bottom - c.top + 1))
        .sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));
    for (let i = 0; i < dashes.length;) {
        let j = i + 1;
        while (j < dashes.length && (dashes[j].top + dashes[j].bottom) - (dashes[j - 1].top + dashes[j - 1].bottom) <= 2 * thinness(height)) j++;
        const row = dashes.slice(i, j);
        const span = Math.max(...row.map(c => c.right)) - Math.min(...row.map(c => c.left)) + 1;
        if (row.length > 1 && span >= width * RULE_SPAN) for (const c of row) rules.add(c);
        i = j;
    }
    let box: InkBox | null = null;
    for (const c of components) {
        if (c.pixels.length < dust || rules.has(c)) {
            for (const i of c.pixels) alpha[i] = 0;
            continue;
        }
        box = box
            ? { left: Math.min(box.left, c.left), top: Math.min(box.top, c.top), right: Math.max(box.right, c.right), bottom: Math.max(box.bottom, c.bottom) }
            : { left: c.left, top: c.top, right: c.right, bottom: c.bottom };
    }
    return box;
}

/**
 * A stored signature cropped to its strokes, for printing. Signatures kept
 * before uploads were cropped this way are whole pages of paper with the
 * signature small inside; printed at signature height, the ink came out a
 * fraction of it. Anything that is not a PNG or JPEG data URL, or holds no
 * strokes, comes back as it was.
 */
export async function cropSignatureToInk(src: string): Promise<string> {
    const match = /^data:image\/(?:png|jpeg);base64,(.+)$/.exec(src);
    if (!match) return src;
    try {
        const { data, info } = await sharp(Buffer.from(match[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const { width, height } = info;
        const alpha = new Uint8Array(width * height);
        for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
        const strong = Uint8Array.from(alpha);
        const box = keepStrokes(strong, width, height);
        if (!box) return src;
        // Strokes cleared as dust or rules disappear; faint edges of real strokes stay.
        for (let i = 0; i < alpha.length; i++) if (alpha[i] >= STROKE && strong[i] === 0) data[i * 4 + 3] = 0;
        const left = Math.max(0, box.left - PADDING);
        const top = Math.max(0, box.top - PADDING);
        const png = await sharp(data, { raw: { width, height, channels: 4 } })
            .extract({ left, top, width: Math.min(width, box.right + PADDING + 1) - left, height: Math.min(height, box.bottom + PADDING + 1) - top })
            .png({ compressionLevel: 9 })
            .toBuffer();
        return pngDataUrl(png);
    } catch {
        return src;
    }
}

/** A PNG as the data URL the report cards print from. */
export const pngDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
