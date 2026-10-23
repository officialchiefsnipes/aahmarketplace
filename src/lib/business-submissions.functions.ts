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
    // Use the Admin client to bypass RLS for the admin check
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    
    const { data: role, error: roleError } = await supabaseAdmin.from('user_roles')
      .select('role').eq('user_id', context.userId).maybeSingle();
      
    if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');
    
    // Use the Admin client to fetch pending submissions
    const { data, error } = await supabaseAdmin.from('business_submissions')
      .select('id,name,category,room,phone,created_at').eq('status', 'pending').order('created_at');
      
    if (error) throw new Error('Could not load submissions. Please retry.');
    return data;
  });

export const reviewBusinessSubmission = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSubmissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Use the Admin client to bypass RLS for the admin check
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    
    const { data: role, error: roleError } = await supabaseAdmin.from('user_roles')
      .select('role').eq('user_id', context.userId).maybeSingle();
      
    if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');

    // Perform the action directly with the Admin client (No RPC needed)
    if (data.decision === 'approve') {
      const { error } = await supabaseAdmin.from('business_submissions')
        .update({ status: 'approved' })
        .eq('id', data.id);
      if (error) throw new Error('Could not approve this submission. Refresh and try again.');
    } else if (data.decision === 'reject') {
      const { error } = await supabaseAdmin.from('business_submissions')
        .delete()
        .eq('id', data.id);
      if (error) throw new Error('Could not reject this submission. Refresh and try again.');
    } else {
      throw new Error('Invalid decision.');
    }

    return { success: true };
  });
