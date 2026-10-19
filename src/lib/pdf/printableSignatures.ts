import { cropSignatureToInk } from '@/lib/signature-image';

/** The signature images a report card or mark sheet prints. */
interface SignatureFields {
    principalSignatureUrl?: string;
    classTeacherSignatureUrl?: string;
}

/**
 * The documents with each signature cropped to its ink, so it prints at full
 * size rather than as a speck in a photo of the whole page. A class shares a
 * handful of signatures across every card, so each is cropped once.
 */
export async function withPrintableSignatures<T extends SignatureFields>(documents: T[]): Promise<T[]> {
    const cropped = new Map<string, Promise<string>>();
    const crop = (src?: string): Promise<string | undefined> => {
        if (!src) return Promise.resolve(src);
        let done = cropped.get(src);
        if (!done) {
            done = cropSignatureToInk(src);
            cropped.set(src, done);
        }
        return done;
    };
    return Promise.all(documents.map(async doc => ({
        ...doc,
        principalSignatureUrl: await crop(doc.principalSignatureUrl),
        classTeacherSignatureUrl: await crop(doc.classTeacherSignatureUrl),
    })));
}
