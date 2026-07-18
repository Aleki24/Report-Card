import React from 'react';

interface WordmarkProps {
  text?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Renders the brand name in the logo's two-tone treatment: "skul" in blue, "base" in green. */
export function Wordmark({ text = 'Skulbase', className, style }: WordmarkProps) {
  return (
    <span className={className} style={style}>
      <span style={{ color: 'var(--viz-info)' }}>{text.slice(0, 4)}</span>
      <span style={{ color: 'var(--viz-good)' }}>{text.slice(4)}</span>
    </span>
  );
}
