import { Dashboard } from "@/app/dashboard";
import { BottomNav } from "@/components/BottomNav";

export default async function RemindersPage() {
  return (
    <>
      <Dashboard activePage="reminders" userEmail="私人家庭空間" />
      <BottomNav />
    </>
  );
}
