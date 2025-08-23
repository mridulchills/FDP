import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { name, email, employee_id, role, department_id, designation, institution, password } = await req.json()

    console.log('Creating user with email:', email)

    // 1. Create Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }

    console.log('Auth user created:', authData.user.id)

    // 2. Insert user record in users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      name,
      email,
      employee_id,
      role,
      department_id,
      designation,
      institution,
      auth_user_id: authData.user.id,
    })

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log('User record created in database')

    // 3. Send credentials email
    const { error: emailError } = await supabaseAdmin.functions.invoke('send-user-credentials', {
      body: {
        name,
        email,
        employee_id,
        password,
        role,
      },
    })

    if (emailError) {
      console.warn('Email sending failed:', emailError)
      // Don't throw error for email failure, just log it
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authData.user,
        password: password 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error creating user:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to create user' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})