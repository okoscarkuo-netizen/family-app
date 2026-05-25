import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDefaultHouseholdId } from "@/lib/household";
import { normalizeDashboardState } from "@/lib/dashboard-state";
import { mergeDashboardStatePreservingExtras } from "@/lib/account-opening-balance-store";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type DashboardStateResponse = {
  state?: unknown;
  source?: "cloud" | "missing";
  message?: string;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function cloudUnavailable(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Dashboard state storage is not ready.";

  return NextResponse.json(
    {
      error: "cloud_unavailable",
      message,
    },
    { status: 503 }
  );
}

function getSupabaseOrResponse():
  | { supabase: NonNullable<ReturnType<typeof createAdminClient>>; response: null }
  | { supabase: null; response: NextResponse } {
  try {
    const supabase = createAdminClient();

    if (!supabase) {
      return {
        supabase: null,
        response: cloudUnavailable("Missing SUPABASE_SERVICE_ROLE_KEY for dashboard state sync."),
      };
    }

    return { supabase, response: null };
  } catch (error) {
    return { supabase: null, response: cloudUnavailable(error) };
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { supabase, response } = getSupabaseOrResponse();
  if (!supabase) return response ?? cloudUnavailable("Dashboard state storage is not ready.");

  const householdId = await ensureDefaultHouseholdId(supabase, user);

  const { data, error } = await supabase
    .from("household_dashboard_state")
    .select("state")
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) return cloudUnavailable(error);

  if (!data?.state) {
    return NextResponse.json<DashboardStateResponse>({
      source: "missing",
      state: null,
      message: "Dashboard state is empty in cloud storage.",
    });
  }

  return NextResponse.json<DashboardStateResponse>({
    source: "cloud",
    state: normalizeDashboardState(data.state),
  });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { supabase, response } = getSupabaseOrResponse();
  if (!supabase) return response ?? cloudUnavailable("Dashboard state storage is not ready.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const householdId = await ensureDefaultHouseholdId(supabase, user);
  const state = normalizeDashboardState((body as { state?: unknown }).state);
  const { data: existingState, error: existingError } = await supabase
    .from("household_dashboard_state")
    .select("state")
    .eq("household_id", householdId)
    .maybeSingle();

  if (existingError) return cloudUnavailable(existingError);

  const mergedState = mergeDashboardStatePreservingExtras(existingState?.state, state);

  const { error } = await supabase.from("household_dashboard_state").upsert(
    {
      household_id: householdId,
      state: mergedState,
      updated_by: user.id,
    },
    { onConflict: "household_id" }
  );

  if (error) return cloudUnavailable(error);

  return NextResponse.json<DashboardStateResponse>({
    source: "cloud",
    state: mergedState as typeof state,
  });
}
