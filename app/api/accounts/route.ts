import {
  accountFromRow,
  accountToRow,
  initialAccounts,
  normalizeAccounts,
  type AccountRow,
} from "@/lib/accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user !== null
  } catch {
    return false
  }
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
        : "Supabase accounts storage is not ready.";

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
        response: cloudUnavailable("Missing SUPABASE_SERVICE_ROLE_KEY for server-side account sync."),
      };
    }

    return { supabase, response: null };
  } catch (error) {
    return { supabase: null, response: cloudUnavailable(error) };
  }
}

export async function GET() {
  if (!await isAuthenticated()) return unauthorized();

  const { supabase, response } = getSupabaseOrResponse();
  if (!supabase) return response ?? cloudUnavailable("Supabase accounts storage is not ready.");

  const { data, error } = await supabase
    .from("family_accounts")
    .select("id, name, type, owner, kind, balance, currency, hidden, sort_order")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return cloudUnavailable(error);

  if (!data?.length) {
    const rows = initialAccounts.map(accountToRow);
    const { error: seedError } = await supabase.from("family_accounts").upsert(rows, { onConflict: "id" });

    if (seedError) return cloudUnavailable(seedError);

    return NextResponse.json({
      accounts: initialAccounts,
      source: "seeded",
    });
  }

  return NextResponse.json({
    accounts: (data ?? []).map((row) => accountFromRow(row as AccountRow)),
    source: "cloud",
  });
}

export async function PUT(request: NextRequest) {
  if (!await isAuthenticated()) return unauthorized();

  const { supabase, response } = getSupabaseOrResponse();
  if (!supabase) return response ?? cloudUnavailable("Supabase accounts storage is not ready.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const accounts = normalizeAccounts((body as { accounts?: unknown }).accounts);

  if (accounts.length > 250) {
    return NextResponse.json({ error: "too_many_accounts" }, { status: 400 });
  }

  const rows = accounts.map(accountToRow);

  if (rows.length) {
    const { error } = await supabase.from("family_accounts").upsert(rows, { onConflict: "id" });
    if (error) return cloudUnavailable(error);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("is_archived", false);

  if (existingError) return cloudUnavailable(existingError);

  const incomingIds = new Set(accounts.map((account) => account.id));
  const idsToArchive = (existingRows ?? [])
    .map((row) => row.id)
    .filter((id) => !incomingIds.has(id));

  if (idsToArchive.length) {
    const { error } = await supabase
      .from("family_accounts")
      .update({ is_archived: true })
      .in("id", idsToArchive);

    if (error) return cloudUnavailable(error);
  }

  return NextResponse.json({ accounts });
}
