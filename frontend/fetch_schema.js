import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../backend/.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkSchema() {
  const tables = ['users', 'cards', 'attempts', 'daily_plans', 'weak_topics', 'tutor_sessions', 'micro_sessions'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Error reading ${table}:`, error.message);
    } else {
      console.log(`Table ${table} structure:`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        console.log("No rows, but table exists.");
      }
    }
  }
}

checkSchema();
