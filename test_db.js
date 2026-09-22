import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fvtigyeqnjukijjmtvhv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dGlneWVxbmp1a2lqam10dmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyODM5ODcsImV4cCI6MjEwMzg1OTk4N30.jtj2fjzuZIhF98a0oxK50dAjnXqTE2R6dwCMw-HRZnY');

async function test() {
  const { data, error } = await supabase
    .from('review_submit_data')
    .select('id, submitted_username, status, earner_id, bulker_id, app_id')
    .eq('app_id', '28a0b103-da14-4fdd-928d-b686399a0234')
    .limit(5);
  console.log("Error:", error);
  console.log("Data:", data);
}
test();
