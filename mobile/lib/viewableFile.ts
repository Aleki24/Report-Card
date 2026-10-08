import { attachmentName, attachmentTypeOf, type AttachmentMimeType } from '@shared/attachments';
import type { FileSource } from './api';

/** A file to show in the viewer: where it is, what to call it, and its type (null when unknown). */
export interface ViewableFile {
    source: FileSource;
    name: string;
    type: AttachmentMimeType | null;
}

/** A homework attachment or hand-in, from its stored link. */
export const viewableAttachment = (url: string): ViewableFile => ({
    source: { kind: 'url', url },
    name: attachmentName(url),
    type: attachmentTypeOf(url),
});
