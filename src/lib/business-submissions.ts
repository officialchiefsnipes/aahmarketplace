import { z } from 'zod';

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/[\s()+-]/g, '');
  if (/^0[789]\d{9}$/.test(digits)) return `234${digits.slice(1)}`;
  return digits;
}

export const businessSubmissionSchema = z.object({
  name: z.string().trim().min(2, 'Enter your business name.').max(120),
  category: z.string().trim().min(2, 'Enter the nature of your business.').max(80),
  room: z.string().trim().min(1, 'Enter your room information.').max(120),
  phone: z.string().trim().max(30).transform(normalizeWhatsAppPhone)
    .pipe(z.string().regex(/^[1-9]\d{9,14}$/, 'Enter a valid WhatsApp phone number, including country code for non-Nigerian numbers.')),
});
export type BusinessSubmission = z.infer<typeof businessSubmissionSchema>;
export type PendingBusiness = BusinessSubmission & { id: string; created_at: string };
export const reviewSubmissionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  verified: z.boolean(),
}).refine((value) => value.decision !== 'approved' || value.verified, {
  message: 'Verify the WhatsApp copy before approving.',
});

export function submissionWhatsAppLink(value: BusinessSubmission, id: string) {
  const business = businessSubmissionSchema.parse(value);
  const reference = z.string().uuid().parse(id);
  const message = `Abdulsalami Marketplace — business submission\nReference: ${reference}\nBusiness name: ${business.name}\nNature of business: ${business.category}\nRoom information: ${business.room}\nPhone: +${business.phone}\nWhatsApp: https://wa.me/${business.phone}`;
  return `https://wa.me/2348121656603?text=${encodeURIComponent(message)}`;
}

export function isAdminHash(hash: string) { return hash === '#admin'; }