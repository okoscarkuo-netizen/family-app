import { Dashboard } from "@/app/dashboard";
import { BottomNav } from "@/components/BottomNav";

export default async function HomePage() {
  return (
    <>
      <Dashboard activePage="home" userEmail="私人家庭空間" />
      <BottomNav />
    </>
  );
}
