"use client";

import React, { useId, useState } from 'react';
import { Camera, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRow } from '@/hooks/useUsersPage';
import { UserAvatar } from '../UserBadges';
import { PHOTO_TYPES, uploadPhoto } from './profileApi';

interface ProfilePhotoProps {
  user: UserRow;
  imageUrl: string | null | undefined;
  /** Persists the uploaded photo's URL on the user's record. */
  onUploaded: (url: string) => Promise<void>;
  className?: string;
}

/** The large profile avatar with a camera button that uploads and saves a new photo. */
export function ProfilePhoto({ user, imageUrl, onUploaded, className }: ProfilePhotoProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await onUploaded(await uploadPhoto(file));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <div className="relative">
        <UserAvatar firstName={user.first_name} lastName={user.last_name} role={user.role} imageUrl={imageUrl} size="lg" className="shadow-lg ring-4 ring-card" />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white">
            <LoaderCircle className="size-7 animate-spin" aria-label="Uploading photo" />
          </div>
        )}
        <input id={inputId} type="file" accept={PHOTO_TYPES.join(',')} className="peer sr-only" onChange={onFile} disabled={uploading} />
        <label
          htmlFor={inputId}
          title={imageUrl ? 'Change photo' : 'Add photo'}
          className={cn(
            'absolute right-0 bottom-0 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          <Camera className="size-4" aria-hidden="true" />
          <span className="sr-only">{imageUrl ? 'Change photo' : 'Add photo'}</span>
        </label>
      </div>
      {error && <p role="alert" className="max-w-48 text-center text-[11px] leading-snug text-destructive">{error}</p>}
    </div>
  );
}
