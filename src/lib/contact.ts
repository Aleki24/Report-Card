import { z } from 'zod';

/** The public contact form, checked the same way in the browser and on the server. */
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Keep your name under 120 characters.'),
  email: z.string().trim().email('Enter a valid email address.').max(200),
  schoolName: z.string().trim().max(160, 'Keep the school name under 160 characters.').optional().default(''),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(4000, 'Keep your message under 4,000 characters.'),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactField = keyof ContactInput;

export const CONTACT_DETAILS = {
  email: 'alexotieno293@gmail.com',
  phoneDisplay: '0740 129 444',
  phoneHref: 'tel:+254740129444',
  location: 'Kenya',
} as const;
