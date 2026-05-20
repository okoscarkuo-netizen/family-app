import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_HOUSEHOLD_NAME = "家庭記帳";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function displayNameFromUser(user: AuthUser) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return metadataName || user.email?.split("@")[0] || "家庭成員";
}

export async function ensureDefaultHouseholdId(supabase: AdminClient, user: AuthUser) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) throw membershipError;

  const existingHouseholdId = membershipRows?.[0]?.household_id;
  if (existingHouseholdId) return existingHouseholdId as string;

  const { data: householdRows, error: householdError } = await supabase
    .from("households")
    .select("id")
    .eq("name", DEFAULT_HOUSEHOLD_NAME)
    .order("created_at", { ascending: true })
    .limit(1);

  if (householdError) throw householdError;

  let householdId = householdRows?.[0]?.id as string | undefined;
  const isNewHousehold = !householdId;

  if (!householdId) {
    const { data: createdHousehold, error: createHouseholdError } = await supabase
      .from("households")
      .insert({
        name: DEFAULT_HOUSEHOLD_NAME,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createHouseholdError) throw createHouseholdError;
    householdId = createdHousehold.id as string;
  }

  const { error: memberError } = await supabase.from("household_members").upsert(
    {
      household_id: householdId,
      user_id: user.id,
      role: isNewHousehold ? "owner" : "member",
      display_name: displayNameFromUser(user),
    },
    { onConflict: "household_id,user_id" }
  );

  if (memberError) throw memberError;

  return householdId;
}
