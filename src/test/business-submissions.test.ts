import { describe, expect, it } from 'vitest';
import { businessSubmissionSchema, isAdminHash, normalizeWhatsAppPhone, reviewSubmissionSchema, submissionWhatsAppLink } from '@/lib/business-submissions';

const details = { name: 'Ada Laundry', category: 'Laundry', room: 'Block B Room 7', phone: '08121656603' };
describe('Business submission rules', () => {
  it('converts Nigerian local phone numbers to international WhatsApp digits', () => {
    expect(normalizeWhatsAppPhone('08121656603')).toBe('2348121656603');
  });
  it('requires all four business details without account information', () => {
    expect(businessSubmissionSchema.parse(details)).toEqual({ ...details, phone: '2348121656603' });
    for (const field of ['name', 'category', 'room', 'phone']) {
      expect(businessSubmissionSchema.safeParse({ ...details, [field]: '' }).success).toBe(false);
    }
  });
  it('rejects links and malformed phone numbers as owner phone input', () => {
    expect(businessSubmissionSchema.safeParse({ ...details, phone: 'https://evil.test' }).success).toBe(false);
  });
  it('sends every submitted detail and reference to the requested review number', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const url = new URL(submissionWhatsAppLink(details, id));
    expect(url.origin + url.pathname).toBe('https://wa.me/2348121656603');
    const message = url.searchParams.get('text');
    for (const value of [details.name, details.category, details.room, '2348121656603', id]) expect(message).toContain(value);
  });
  it('requires verification before approval but allows rejection without verification', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(reviewSubmissionSchema.safeParse({ id, decision: 'approved', verified: false }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ id, decision: 'approved', verified: true }).success).toBe(true);
    expect(reviewSubmissionSchema.safeParse({ id, decision: 'rejected', verified: false }).success).toBe(true);
  });
  it('opens the admin console only for the exact admin hash', () => {
    expect(isAdminHash('#admin')).toBe(true);
    expect(isAdminHash('')).toBe(false);
    expect(isAdminHash('#other')).toBe(false);
  });
});