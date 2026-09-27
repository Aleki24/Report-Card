import type { ManualFigure } from './types';

/** Desktop shots are 1280×800 at 1.25×; phone shots 390×844 at 2×. */
export const shot = (name: string, alt: string, caption: string): ManualFigure =>
    ({ src: `/manual/${name}.jpg`, width: 1600, height: 1000, alt, caption, device: 'desktop' });

export const phoneShot = (name: string, alt: string, caption: string): ManualFigure =>
    ({ src: `/manual/${name}.jpg`, width: 780, height: 1688, alt, caption, device: 'phone' });
