import { createClient } from '@supabase/supabase-js';
import { businessSubmissionSchema, type BusinessSubmission } from './business-submissions';

export async function savePendingBusiness(input: BusinessSubmission, url: string, key: string) {
  const business = businessSubmissionSchema.parse(input);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) {
          headers.delete('Authorization');
        }
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await client.rpc('submit_pending_business', {
    submission_name: business.name,
    submission_category: business.category,
    submission_room: business.room,
    submission_phone: business.phone,
  });
  if (error || typeof data !== 'string') {
    console.error('Pending business submission failed', { code: error?.code });
    throw new Error('Could not submit your business. Please try again.');
  }
  return { id: data };
}