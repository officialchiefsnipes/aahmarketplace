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
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    
    const { data: role, error: roleError } = await supabaseAdmin.from('user_roles')
      .select('role').eq('user_id', context.userId).maybeSingle();
      
    if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');
    
    const { data, error } = await supabaseAdmin.from('business_submissions')
      .select('id,name,category,room,phone,created_at').eq('status', 'pending').order('created_at');
      
    if (error) throw new Error('Could not load submissions. Please retry.');
    return data;
  });

export const reviewBusinessSubmission = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSubmissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    
    // 1. Verify Admin
    const { data: role, error: roleError } = await supabaseAdmin.from('user_roles')
      .select('role').eq('user_id', context.userId).maybeSingle();
    if (roleError || role?.role !== 'admin') throw new Error('Admin access required.');

    // 2. Accept any variation of "approve" or "reject"
    const decisionStr = String(data.decision).toLowerCase();
    const isApprove = decisionStr.includes('approv') || decisionStr === 'accept';
    const isReject = decisionStr.includes('reject') || decisionStr === 'deny';

    if (isApprove) {
      // Get the submission details
      const { data: submission, error: fetchError } = await supabaseAdmin.from('business_submissions')
        .select('*').eq('id', data.id).single();

      if (fetchError || !submission) throw new Error('Submission not found.');

      // Copy it to the main 'businesses' table
      const { error: insertError } = await supabaseAdmin.from('businesses').insert({
        name: submission.name,
        category: submission.category,
        room: submission.room,
        contact_type: submission.contact_type || 'WhatsApp link',
        contact: submission.phone
      });

      if (insertError) {
        console.error("Insert Error:", insertError);
        throw new Error('Failed to publish to marketplace.');
      }

      // Mark as approved in the submissions table
      const { error: updateError } = await supabaseAdmin.from('business_submissions')
        .update({ status: 'approved' })
        .eq('id', data.id);
      if (updateError) throw new Error('Could not update submission status.');
      
    } else if (isReject) {
      const { error: deleteError } = await supabaseAdmin.from('business_submissions')
        .delete()
        .eq('id', data.id);
      if (deleteError) throw new Error('Could not reject this submission.');
    } else {
      throw new Error(`Invalid decision value: ${data.decision}`);
    }

    return { success: true };
  });
