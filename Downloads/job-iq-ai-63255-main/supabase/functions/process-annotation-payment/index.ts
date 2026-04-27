import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PRICE_PER_ANNOTATION = 1.00;
const MIN_TIME_SECONDS = 90;
const MIN_COMMENT_LENGTH = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // === Body size check ===
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 50_000) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Authentication ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userRoles } = await supabase
      .from('user_roles').select('role').eq('user_id', userId);
    const roles = userRoles?.map(r => r.role) || [];

    const PaymentSchema = z.object({
      action: z.enum(["record_annotation", "get_stats", "mark_paid"]),
      taskId: z.string().uuid().optional(),
      feedbackId: z.string().uuid().optional(),
      annotatorId: z.string().uuid().optional(),
      paymentIds: z.array(z.string().uuid()).max(100).optional(),
      paidBy: z.string().max(100).optional(),
    });
    const rawBody = await req.json();
    const parseResult = PaymentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { action, taskId, feedbackId, annotatorId, paymentIds, paidBy } = parseResult.data;

    // record_annotation: expert or admin
    if (action === 'record_annotation') {
      if (!roles.some(r => ['expert', 'admin'].includes(r))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[payment] Recording annotation for task: ${taskId}`);
      const { data: task, error: taskError } = await supabase
        .from('annotation_tasks').select('*').eq('id', taskId).single();
      if (taskError || !task) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: feedback } = await supabase
        .from('rlhf_feedback').select('id, time_spent_seconds, free_text_comment').eq('id', feedbackId).single();
      if (!feedback) {
        return new Response(JSON.stringify({ error: 'Feedback not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const issues: string[] = [];
      if (feedback.time_spent_seconds < MIN_TIME_SECONDS) issues.push(`Temps insuffisant: ${feedback.time_spent_seconds}s < ${MIN_TIME_SECONDS}s`);
      if ((feedback.free_text_comment?.length || 0) < MIN_COMMENT_LENGTH) issues.push(`Commentaire trop court`);

      if (issues.length > 0 && annotatorId) {
        await supabase.from('annotation_warnings').insert({ annotator_id: annotatorId, task_id: taskId, warning_type: 'low_quality', severity: 1, details: issues.join('; ') });
        const { data: annotator } = await supabase.from('annotator_profiles').select('warnings_count').eq('id', annotatorId).single();
        if (annotator) {
          const newWarnings = (annotator.warnings_count || 0) + 1;
          const updateData: any = { warnings_count: newWarnings };
          if (newWarnings >= 3) { updateData.suspended_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); updateData.suspension_reason = 'Trop de warnings qualité'; }
          await supabase.from('annotator_profiles').update(updateData).eq('id', annotatorId);
        }
      }

      const { data: payment, error: payError } = await supabase
        .from('annotation_payments').insert({
          annotator_id: task.assigned_annotator_id, task_id: taskId, feedback_id: feedbackId,
          base_amount: PRICE_PER_ANNOTATION, bonus_amount: 0, penalty_amount: issues.length > 0 ? 0.25 : 0,
          status: issues.length > 0 ? 'flagged' : 'pending', time_spent_seconds: feedback.time_spent_seconds,
        }).select().single();

      if (payError) {
        return new Response(JSON.stringify({ error: 'Failed to record payment' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, paymentId: payment.id, amount: payment.final_amount, flagged: issues.length > 0, issues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // get_stats: expert (own stats) or admin
    if (action === 'get_stats') {
      if (!roles.some(r => ['expert', 'admin'].includes(r))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If expert, verify they own this annotator profile
      if (!roles.includes('admin') && annotatorId) {
        const { data: ownProfile } = await supabase
          .from('annotator_profiles').select('id')
          .eq('id', annotatorId)
          .eq('expert_id', (await supabase.from('expert_profiles').select('id').eq('user_id', userId).single()).data?.id)
          .single();
        if (!ownProfile) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const { data: payments } = await supabase
        .from('annotation_payments').select('status, final_amount, created_at').eq('annotator_id', annotatorId);
      const stats = { totalPending: 0, totalPaid: 0, annotationsCount: payments?.length || 0, flaggedCount: 0 };
      payments?.forEach((p: any) => {
        const amount = p.final_amount || 0;
        if (p.status === 'pending') stats.totalPending += amount;
        else if (p.status === 'paid') stats.totalPaid += amount;
        else if (p.status === 'flagged') { stats.flaggedCount++; stats.totalPending += amount; }
      });

      return new Response(JSON.stringify(stats), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // mark_paid: admin only
    if (action === 'mark_paid') {
      if (!roles.includes('admin')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!paymentIds || !Array.isArray(paymentIds)) {
        return new Response(JSON.stringify({ error: 'Payment IDs required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.from('annotation_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString(), approved_by: paidBy }).in('id', paymentIds);
      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to mark payments' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, count: paymentIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[payment] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
