import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tasks with deadlines in the next 30 minutes that haven't had reminders sent
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, deadline, user_id, status')
      .eq('reminder_sent', false)
      .neq('status', 'completed')
      .not('deadline', 'is', null)
      .gte('deadline', now.toISOString())
      .lte('deadline', thirtyMinutesFromNow.toISOString());

    if (tasksError) {
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} tasks needing reminders`);

    // Create notifications for each task
    for (const task of tasks || []) {
      const deadlineDate = new Date(task.deadline);
      const minutesUntilDeadline = Math.round((deadlineDate.getTime() - now.getTime()) / 60000);

      // Create notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: task.user_id,
          title: '⏰ Deadline Reminder',
          message: `Your task "${task.title}" is due in ${minutesUntilDeadline} minutes!`,
          type: 'deadline_reminder',
          task_id: task.id,
        });

      if (notifError) {
        console.error(`Error creating notification for task ${task.id}:`, notifError);
        continue;
      }

      // Mark reminder as sent
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ reminder_sent: true })
        .eq('id', task.id);

      if (updateError) {
        console.error(`Error updating reminder_sent for task ${task.id}:`, updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: tasks?.length || 0 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error checking deadlines:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
