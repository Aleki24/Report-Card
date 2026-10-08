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
    let left = width, right = -1, top = height, bottom = -1;
    const kept = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            if (alpha[i] < 128) { kept[i] = alpha[i] > 0 && hasInkNear(alpha, width, x, y) ? alpha[i] : 0; continue; }
            if (!hasInkNear(alpha, width, x, y)) continue;
            kept[i] = alpha[i];
            inkPixels++;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
    }

    const share = inkPixels / (width * height);
    if (inkPixels === 0 || share < MIN_INK_SHARE) {
        throw new SignatureImageError('No signature was found in that photo. Sign in dark pen on plain white paper, and fill the frame with the signature.');
    }
    if (share > MAX_INK_SHARE) {
        throw new SignatureImageError('That photo has too much dark in it to be a signature. Photograph only the signature on plain white paper, in good light.');
    }

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

/** A PNG as the data URL the report cards print from. */
export const pngDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
