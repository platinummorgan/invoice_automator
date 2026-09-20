import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase environment is not configured for account deletion.');
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Unauthorized.' }, 401);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: authHeader,
      },
    });

    if (!userResponse.ok) {
      return jsonResponse({ success: false, error: 'Unauthorized.' }, 401);
    }

    const userData = await userResponse.json();
    const userId = userData?.id;

    if (!userId) {
      return jsonResponse({ success: false, error: 'Unable to resolve authenticated user.' }, 401);
    }

    const serviceHeaders = {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    };

    const deleteLogoResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/logos/${encodeURIComponent(userId)}/logo`,
      {
        method: 'DELETE',
        headers: serviceHeaders,
      }
    );

    if (!deleteLogoResponse.ok && deleteLogoResponse.status !== 404) {
      console.warn('Logo delete failed:', await deleteLogoResponse.text());
    }

    const deleteProfileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          ...serviceHeaders,
          Prefer: 'return=minimal',
        },
      }
    );

    if (!deleteProfileResponse.ok) {
      throw new Error(`Failed to delete account data: ${await deleteProfileResponse.text()}`);
    }

    const deleteUserResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: serviceHeaders,
      }
    );

    if (!deleteUserResponse.ok) {
      throw new Error(`Failed to delete auth user: ${await deleteUserResponse.text()}`);
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('delete-account error:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Unexpected server error.' },
      500
    );
  }
});
