'use client';

import React, { useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';

interface FormattedTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    minHeight?: number;
}

function wrapSelection(textarea: HTMLTextAreaElement, value: string, onChange: (v: string) => void, marker: string) {
    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd) || 'text';
    const next = value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd);
    onChange(next);
    const cursor = selectionStart + marker.length;
    requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor + selected.length);
    });
}

function toggleBulletLines(textarea: HTMLTextAreaElement, value: string, onChange: (v: string) => void) {
    const { selectionStart, selectionEnd } = textarea;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextBreak = value.indexOf('\n', selectionEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;

    const lines = value.slice(lineStart, lineEnd).split('\n');
    const allBulleted = lines.every(l => l.trim() === '' || l.startsWith('- '));
    const nextBlock = lines.map(l => (l.trim() === '' ? l : allBulleted ? l.replace(/^- /, '') : `- ${l}`)).join('\n');

    onChange(value.slice(0, lineStart) + nextBlock + value.slice(lineEnd));
    requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart + nextBlock.length);
    });
}

/**
 * Plain textarea plus a small toolbar that inserts markdown-style markers
 * (**bold**, *italic*, "- " bullets) around the current selection — no
 * contentEditable/rich-text-editor dependency, so content stays a plain
 * string safe to render back out (see renderFormattedText) without any
 * HTML-sanitization surface.
 */
export function FormattedTextarea({ value, onChange, placeholder, rows = 14, minHeight = 320 }: FormattedTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const apply = (fn: (ta: HTMLTextAreaElement) => void) => {
        if (textareaRef.current) fn(textareaRef.current);
    };

    return (
        <div className="flex flex-col">
            <div className="mb-1.5 flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button type="button" title="Bold" className="btn-icon" onClick={() => apply(ta => wrapSelection(ta, value, onChange, '**'))}>
                    <Bold size={14} />
                </button>
                <button type="button" title="Italic" className="btn-icon" onClick={() => apply(ta => wrapSelection(ta, value, onChange, '*'))}>
                    <Italic size={14} />
                </button>
                <button type="button" title="Bullet list" className="btn-icon" onClick={() => apply(ta => toggleBulletLines(ta, value, onChange))}>
                    <List size={14} />
                </button>
                <span className="ml-1 text-[11px] text-muted-foreground">Select text, then click a button to format it</span>
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="input-field w-full resize-y"
                style={{ minHeight }}
            />
        </div>
    );
}
