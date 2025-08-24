import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCredentialsRequest {
  name: string;
  email: string;
  employee_id: string;
  password: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, employee_id, password, role }: SendCredentialsRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "FDTS System <onboarding@resend.dev>",
      to: [email],
      subject: "Your FDTS Account Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
            Welcome to FDTS
          </h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e293b; margin-top: 0;">Hello ${name},</h2>
            <p style="color: #475569; line-height: 1.6;">
              Your account has been created successfully in the Faculty Development Tracking System (FDTS). 
              Please use the following credentials to log in:
            </p>
          </div>

          <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Login Credentials</h3>
            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 10px 0;">
              <p style="margin: 5px 0;"><strong>Employee ID:</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${employee_id}</code></p>
              <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
              <p style="margin: 5px 0;"><strong>Role:</strong> <span style="text-transform: capitalize;">${role}</span></p>
            </div>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h4 style="color: #92400e; margin-top: 0;">Important Security Notes:</h4>
            <ul style="color: #92400e; margin: 10px 0; padding-left: 20px;">
              <li>Please change your password after your first login</li>
              <li>Do not share your credentials with anyone</li>
              <li>Log out when you're done using the system</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('SUPABASE_URL')?.replace('/api', '') || 'https://your-app-url.com'}" 
               style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Login to FDTS
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 30px;">
            <p style="color: #64748b; font-size: 14px; text-align: center;">
              If you have any questions or need assistance, please contact the system administrator.
            </p>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 10px;">
              Faculty Development Tracking System (FDTS)
            </p>
          </div>
        </div>
      `,
    });

    console.log("Credentials email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-user-credentials function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);