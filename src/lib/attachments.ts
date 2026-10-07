/**
 * Files teachers attach to homework and learners hand in. Client-safe: the
 * upload route, the web pages and the mobile app all read types from here.
 */

/** The image types photos are stored as. */
export const IMAGE_MIME_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
} as const satisfies Record<string, string>;

/** Worksheets and notes: PDF, Office documents and plain text. */
export const DOCUMENT_MIME_TYPES = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
} as const satisfies Record<string, string>;

export type ImageMimeType = keyof typeof IMAGE_MIME_TYPES;
export type AttachmentMimeType = ImageMimeType | keyof typeof DOCUMENT_MIME_TYPES;

const EXTENSION_BY_TYPE: Readonly<Record<AttachmentMimeType, string>> = { ...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES };

export const IMAGE_TYPES = Object.keys(IMAGE_MIME_TYPES) as ImageMimeType[];
export const ATTACHMENT_TYPES = Object.keys(EXTENSION_BY_TYPE) as AttachmentMimeType[];

const TYPE_BY_EXTENSION: Readonly<Record<string, AttachmentMimeType>> = {
    ...Object.fromEntries(Object.entries(EXTENSION_BY_TYPE).map(([type, ext]) => [ext, type as AttachmentMimeType])),
    jpeg: 'image/jpeg',
};

/** Names phones and browsers use for the same types. */
const MIME_ALIASES: Readonly<Record<string, AttachmentMimeType>> = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
};

const isAttachmentType = (type: string): type is AttachmentMimeType => Object.hasOwn(EXTENSION_BY_TYPE, type);

/** The file's extension, lower-cased: "Notes.PDF" → "pdf". */
export function fileExtension(name: string): string {
    const base = name.split(/[?#]/)[0].split('/').pop() ?? '';
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/**
 * What a picked file really is, or null when it is not a type homework takes.
 *
 * Phones do not always say: Android reports many Word and PDF files as
 * "application/octet-stream" and some photos as "image/jpg", and every such
 * file was turned away as the wrong type. The reported type wins when it is a
 * known one; otherwise the file name decides.
 */
export function resolveAttachmentType(name: string, reportedType: string | null | undefined): AttachmentMimeType | null {
    const reported = (reportedType ?? '').toLowerCase().split(';')[0].trim();
    if (isAttachmentType(reported)) return reported;
    if (MIME_ALIASES[reported]) return MIME_ALIASES[reported];
    return TYPE_BY_EXTENSION[fileExtension(name)] ?? null;
}

export const extensionFor = (type: AttachmentMimeType): string => EXTENSION_BY_TYPE[type];
export const isImageType = (type: AttachmentMimeType): type is ImageMimeType => Object.hasOwn(IMAGE_MIME_TYPES, type);

/** "Fractions worksheet (2).pdf" → "Fractions-worksheet-2", safe in a storage path. */
export function storageSafeName(name: string): string {
    const base = (name.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
    return base.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
}

/**
 * How an attachment is named to people, from its stored URL:
 * ".../attachments/1712_ab12cd/Fractions-worksheet.pdf" → "Fractions-worksheet.pdf",
 * and for older uploads ".../submissions/1712_ab12cd.pdf" → "Attachment (PDF)".
 */
export function attachmentName(url: string): string {
    const path = url.split(/[?#]/)[0];
    const segment = decodeURIComponent(path.split('/').pop() ?? '');
    if (path.includes('/attachments/') && segment) return segment;
    const ext = fileExtension(segment).toUpperCase();
    return ext && ext.length <= 4 ? `Attachment (${ext})` : 'Attachment';
}

/** The type an attachment URL was stored as, from its extension. */
export const attachmentTypeOf = (url: string): AttachmentMimeType | null => TYPE_BY_EXTENSION[fileExtension(url)] ?? null;

/** What /api/school/upload/sign answers: where to send the file, and where it will then be. */
export interface SignedUpload {
    uploadUrl: string;
    headers: Record<string, string>;
    /** The file's type as the server resolved it (phones mislabel some files). */
    type: string;
    url: string;
}

/** Files at most this big may still go through the server when a direct upload fails (Vercel caps bodies at 4.5 MB). */
export const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
