import {
  accountFromRow,
  accountToRow,
  initialAccounts,
  normalizeAccounts,
  type AccountRow,
} from "@/lib/accounts";
import {
  getAccountOpeningBalancesForHousehold,
  getFavoriteAccountIdsForHousehold,
  setAccountOpeningBalancesForHousehold,
  setFavoriteAccountForHousehold,
} from "@/lib/account-opening-balance-store";
import { supportsFavoriteColumn, supportsOpeningBalanceColumn } from "@/lib/accounts-db";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultHouseholdId } from "@/lib/household";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user ?? null
  } catch {
    return null
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
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized();

  const { supabase, response } = getSupabaseOrResponse();
  if (!supabase) return response ?? cloudUnavailable("Supabase accounts storage is not ready.");
  const householdId = await ensureDefaultHouseholdId(supabase, user)
  const [supportsOpeningBalance, supportsFavorite] = await Promise.all([
    supportsOpeningBalanceColumn(),
    supportsFavoriteColumn(),
  ])

  let query = supabase
    .from("family_accounts")
    .select("*")
    .eq("is_archived", false)
  if (supportsFavorite) {
    query = query.order("favorite", { ascending: false })
  }
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return cloudUnavailable(error);

  if (!data?.length) {
    const rows = initialAccounts.map((account, index) =>
      accountToRow(account, index, {
        includeOpeningBalance: supportsOpeningBalance,
        includeFavorite: supportsFavorite,
      })
    );
    const { error: seedError } = await supabase.from("family_accounts").upsert(rows, { onConflict: "id" });

    if (seedError) return cloudUnavailable(seedError);

    if (!supportsOpeningBalance) {
      const openingBalances = Object.fromEntries(
        initialAccounts.map((account) => [account.id, account.balance])
      );
      try {
        await setAccountOpeningBalancesForHousehold(
          supabase,
          householdId,
          openingBalances,
          user.id
        );
      } catch (error) {
        console.error("[accounts-route] seed opening balance sync error:", error);
      }
    }

    return NextResponse.json({
      accounts: initialAccounts,
      source: "seeded",
    });
  }

  const openingBalances: Record<string, number> = supportsOpeningBalance
    ? {}
    : await getAccountOpeningBalancesForHousehold(supabase, householdId);
  const favoriteIds = supportsFavorite
    ? new Set<string>()
    : await getFavoriteAccountIdsForHousehold(supabase, householdId);

  return NextResponse.json({
    accounts: (data ?? []).map((row) =>
      accountFromRow(
        row as AccountRow,
        supportsOpeningBalance ? undefined : openingBalances[row.id],
        favoriteIds.has(row.id),
      )
    ),
    source: "cloud",
  });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized();

  const { supabase, response } = getSupabaseOrResponse();
  if (!supabase) return response ?? cloudUnavailable("Supabase accounts storage is not ready.");
  const householdId = await ensureDefaultHouseholdId(supabase, user)
  const [supportsOpeningBalance, supportsFavorite] = await Promise.all([
    supportsOpeningBalanceColumn(),
    supportsFavoriteColumn(),
  ])

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

  const rows = accounts.map((account, index) =>
    accountToRow(account, index, {
      includeOpeningBalance: supportsOpeningBalance,
      includeFavorite: supportsFavorite,
    })
  );

  if (rows.length) {
    const { error } = await supabase.from("family_accounts").upsert(rows, { onConflict: "id" });
    if (error) return cloudUnavailable(error);
  }

  if (!supportsOpeningBalance) {
    const openingBalances = Object.fromEntries(
      accounts.map((account) => [account.id, account.openingBalance ?? account.balance])
    );
    try {
      await setAccountOpeningBalancesForHousehold(
        supabase,
        householdId,
        openingBalances,
        user.id
      );
    } catch (error) {
      return cloudUnavailable(error);
    }
  }

  if (!supportsFavorite) {
    for (const account of accounts) {
      try {
        await setFavoriteAccountForHousehold(
          supabase,
          householdId,
          account.id,
          Boolean(account.favorite),
          user.id,
        );
      } catch (error) {
        return cloudUnavailable(error);
      }
    }
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
