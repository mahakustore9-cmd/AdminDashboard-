// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Supabase Edge Function: provision-user
// Secure Server-Side Account Provisioning with Service Role
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProvisionRequest {
  email: string;
  fullName: string;
  phone?: string;
  role: "school_admin" | "parent" | "guard" | "teacher";
  schoolId?: string;
  temporaryPassword?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Edge Function configuration missing required environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Client for verifying caller identity via their JWT
    const callerClient = createClient(supabaseUrl, supabaseAnonKey || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Invalid or expired authentication session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Admin client with service_role key to perform trusted operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Verify caller permissions
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, is_super_admin")
      .eq("id", callerUser.id)
      .single();

    const isSuperAdmin = callerProfile?.is_super_admin === true;

    // Parse body
    const body: ProvisionRequest = await req.json();
    const { email, fullName, phone, role, schoolId, temporaryPassword } = body;

    if (!email || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: "email, fullName, and role are required fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: "Invalid email format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Role authorization validation
    if (role === "school_admin") {
      // Only Super Admin can provision School Admins
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized. Only Super Admins can provision School Admins." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!schoolId) {
        return new Response(
          JSON.stringify({ error: "schoolId is required when provisioning a School Admin." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (["parent", "guard", "teacher"].includes(role)) {
      if (!schoolId) {
        return new Response(
          JSON.stringify({ error: "schoolId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!isSuperAdmin) {
        // If not super admin, caller MUST be an active School Admin for this exact school
        const { data: roleCheck } = await adminClient
          .from("user_school_roles")
          .select("id, status")
          .eq("user_id", callerUser.id)
          .eq("school_id", schoolId)
          .eq("role", "school_admin")
          .eq("status", "active")
          .maybeSingle();

        if (!roleCheck) {
          return new Response(
            JSON.stringify({ error: "Unauthorized. You are not an active School Admin for this school." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid role specified." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verify the target school exists and is active
    if (schoolId) {
      const { data: school, error: schoolErr } = await adminClient
        .from("schools")
        .select("id, status, school_name")
        .eq("id", schoolId)
        .single();

      if (schoolErr || !school) {
        return new Response(
          JSON.stringify({ error: "Target school not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (school.status !== "active") {
        return new Response(
          JSON.stringify({ error: "Cannot provision accounts for a deactivated school." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Check if user already exists in auth.users
    let targetUserId: string | null = null;
    let isNewUser = false;

    // Attempt to create user with temporary password or invite
    const passwordToUse = temporaryPassword && temporaryPassword.length >= 8
      ? temporaryPassword
      : `Mahaku@${Math.random().toString(36).slice(-6)}!`;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: passwordToUse,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        phone: phone?.trim() || null,
        is_super_admin: false,
      },
    });

    if (createError) {
      // If user already registered, lookup existing user ID
      if (createError.message.toLowerCase().includes("already registered") || createError.status === 422) {
        // Find existing profile
        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();

        if (existingProfile) {
          targetUserId = existingProfile.id;
        } else {
          return new Response(
            JSON.stringify({ error: "A user with this email already exists." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: `Failed to create auth user: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (newUser?.user) {
      targetUserId = newUser.user.id;
      isNewUser = true;
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve target user ID." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Ensure profile is updated
    await adminClient.from("profiles").upsert({
      id: targetUserId,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      is_super_admin: false,
    });

    // 8. Link to school role
    if (schoolId) {
      const { error: roleError } = await adminClient.from("user_school_roles").upsert({
        user_id: targetUserId,
        school_id: schoolId,
        role: role,
        status: "active",
      }, { onConflict: "user_id, school_id, role" });

      if (roleError) {
        return new Response(
          JSON.stringify({ error: `Failed to assign school role: ${roleError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 9. Return safe, minimal response without passwords or sensitive secrets
    return new Response(
      JSON.stringify({
        success: true,
        message: isNewUser ? "Account provisioned successfully." : "User role mapped successfully.",
        user: {
          id: targetUserId,
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          role: role,
          schoolId: schoolId,
          isNewAccount: isNewUser,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unexpected server error";
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
