"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, PenLine, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api-error-message';
import { SIGNATURES_URL, SIGNATURE_PHOTO_MAX_BYTES, SIGNATURE_TIPS, type SignatureRecord, type SignatureTarget } from '@/lib/signatures';

const urlFor = (target: SignatureTarget) => `${SIGNATURES_URL}?target=${encodeURIComponent(target)}`;

async function readRecord(res: Response, fallback: string): Promise<SignatureRecord> {
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, fallback));
    return (json as { data: SignatureRecord }).data;
}

/**
 * A signature that prints on report cards and mark sheets, saved from a
 * photo: the server removes the paper and crops it, and what comes back is
 * shown exactly as it will print. Saves on its own, apart from any form.
 * `target` is `me`, `principal` or a staff member's id.
 */
export function SignatureField({ target, label, description }: { target: SignatureTarget; label: string; description: string }) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const [record, setRecord] = useState<SignatureRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setRecord(await readRecord(await fetch(urlFor(target), { cache: 'no-store' }), 'Could not load the signature.'));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the signature.');
        } finally {
            setLoading(false);
        }
    }, [target]);
    useEffect(() => { void load(); }, [load]);

    const upload = async (file: File) => {
        if (file.size > SIGNATURE_PHOTO_MAX_BYTES) { setError('That photo is too large. Crop it to just the signature and try again.'); return; }
        const body = new FormData();
        body.append('target', target);
        body.append('photo', file);
        setBusy(true);
        setError(null);
        try {
            setRecord(await readRecord(await fetch(SIGNATURES_URL, { method: 'POST', body }), 'Could not save the signature.'));
            toast.success('Signature saved. It now prints on report cards and mark sheets.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save the signature.');
        } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
        }
    };

    const remove = async () => {
        if (!window.confirm('Remove this signature? Report cards and mark sheets will print an empty line to sign by hand.')) return;
        setBusy(true);
        setError(null);
        try {
            setRecord(await readRecord(await fetch(urlFor(target), { method: 'DELETE' }), 'Could not remove the signature.'));
            toast.success('Signature removed.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not remove the signature.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-w-0">
            <p className="text-sm font-medium" id={`${id}-label`}>{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

            {/* Always white: the signature is dark ink on a printed page. */}
            <div className="mt-3 rounded-xl border border-border bg-white px-4 pt-3 pb-2" aria-labelledby={`${id}-label`}>
                {loading ? (
                    <div className="skeleton-bone h-14 rounded-lg" />
                ) : record?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a data URL, not an optimisable asset
                    <img src={record.image} alt={`${label} on file`} className="h-14 w-full object-contain object-left" />
                ) : (
                    <p className="flex h-14 items-center justify-center gap-2 text-xs text-slate-500"><PenLine className="size-4" aria-hidden />No signature yet: cards print an empty line.</p>
                )}
                <div className="mt-0.5 h-px bg-slate-400" />
                {record?.name && <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{record.name}</p>}
            </div>

            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <input
                    ref={input}
                    id={`${id}-photo`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }}
                />
                <button type="button" className="btn-secondary w-full justify-center sm:w-auto" disabled={busy} onClick={() => input.current?.click()}>
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
                    {record?.image ? 'Replace from a photo' : 'Take or choose a photo'}
                </button>
                {record?.image && (
                    <button type="button" className="btn-secondary w-full justify-center text-destructive sm:w-auto" disabled={busy} onClick={() => void remove()}>
                        <Trash2 className="size-4" aria-hidden />Remove
                    </button>
                )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{SIGNATURE_TIPS}</p>
        </div>
    );
}
