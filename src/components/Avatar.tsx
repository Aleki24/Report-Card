import React from 'react';

interface AvatarProps {
  imageUrl?: string | null;
  firstName?: string;
  lastName?: string;
  size: number;
  background?: string;
  color?: string;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Shows the user's real photo (e.g. copied from Google on sign-in) when available, otherwise falls back to initials. */
export function Avatar({ imageUrl, firstName, lastName, size, background, color, fontSize, className, style }: AvatarProps) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Clerk/OAuth-hosted URL, not a local asset
      <img
        src={imageUrl}
        alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Profile picture'}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fontSize ?? size * 0.4,
        fontWeight: 700,
        color: color || '#fff',
        flexShrink: 0,
        background: background || 'var(--color-accent)',
        ...style,
      }}
    >
      {initials}
    </div>
  );
}
