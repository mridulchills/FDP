import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Debug: Log environment variables
console.log('Environment variables loaded:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '***SET***' : 'NOT SET');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/api/create-user', async (req, res) => {
  const { name, email, employee_id, role, department_id, designation, institution, password } = req.body;

  // 1. Create Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // 2. Insert into users table
  const { error: dbError } = await supabase.from('users').insert({
    name,
    email,
    employee_id,
    role,
    department_id,
    designation,
    institution,
    auth_user_id: authData.user.id,
  });
  if (dbError) {
    return res.status(400).json({ error: dbError.message });
  }

  res.json({ success: true, password });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`User creation backend running on port ${PORT}`);
}); 