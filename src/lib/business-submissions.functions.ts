import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { businessSubmissionSchema, reviewSubmissionSchema } from './business-submissions';

export const submitBusiness = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => businessSubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    // Public endpoint: only validated pending submissions can be inserted.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: saved, error } = await supabaseAdmin.from('business_submissions')
      .insert({ ...data, status: 'pending' }).select('id').single();
    if (error || !saved) throw new Error('Could not submit your business. Please try again.');
    return { id: saved.id };
  });

export const listBusinessSubmissions = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role, error: roleError } = await context.supabase.from('user_roles')
      .select('role').eq('user_id', context.userId).maybeSingle();
    if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');
    const { data, error } = await context.supabase.from('business_submissions')
      .select('id,name,category,room,phone,created_at').eq('status', 'pending').order('created_at');
    if (error) throw new Error('Could not load submissions. Please retry.');
    return data;
  });

export const reviewBusinessSubmission = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSubmissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await context.supabase.from('user_roles')
      .select('role').eq('user_id', context.userId).maybeSingle();
    if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');
    const { error } = await context.supabase.rpc('review_business_submission', {
      submission_id: data.id, decision: data.decision,
    });
    if (error) throw new Error('Could not review this submission. Refresh and try again.');
    return { success: true };
  });