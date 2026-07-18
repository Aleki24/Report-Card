import React from 'react';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = regex.exec(text))) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        if (match[1] !== undefined) {
            parts.push(<strong key={`${keyPrefix}-${i++}`}>{match[1]}</strong>);
        } else if (match[2] !== undefined) {
            parts.push(<em key={`${keyPrefix}-${i++}`}>{match[2]}</em>);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}

/**
 * Renders the small markdown-style subset FormattedTextarea's toolbar
 * produces (**bold**, *italic*, "- " bullet lines) as real React nodes —
 * no dangerouslySetInnerHTML, so there's no HTML-injection surface even
 * though the content comes from user input.
 */
export function renderFormattedText(content: string): React.ReactNode {
    const lines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let bulletBuffer: string[] = [];
    let textBuffer: string[] = [];
    let key = 0;

    const flushText = () => {
        if (textBuffer.length === 0) return;
        const buffered = textBuffer;
        blocks.push(
            <p key={`p-${key++}`} className="m-0">
                {buffered.map((line, i) => (
                    <React.Fragment key={i}>
                        {renderInline(line, `t${key}-${i}`)}
                        {i < buffered.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </p>
        );
        textBuffer = [];
    };

    const flushBullets = () => {
        if (bulletBuffer.length === 0) return;
        const buffered = bulletBuffer;
        blocks.push(
            <ul key={`ul-${key++}`} className="my-1 list-disc pl-5">
                {buffered.map((item, i) => <li key={i}>{renderInline(item, `l${key}-${i}`)}</li>)}
            </ul>
        );
        bulletBuffer = [];
    };

    for (const line of lines) {
        if (line.startsWith('- ')) {
            flushText();
            bulletBuffer.push(line.slice(2));
        } else {
            flushBullets();
            textBuffer.push(line);
        }
    }
    flushText();
    flushBullets();

    return <>{blocks}</>;
}
