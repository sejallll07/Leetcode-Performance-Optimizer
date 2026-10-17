import { Hero } from "@/components/marketing/hero";
import { NotADashboard } from "@/components/marketing/not-a-dashboard";
import { CoreLoop } from "@/components/marketing/core-loop";
import { RoadmapPreview } from "@/components/marketing/roadmap-preview";
import { Cta } from "@/components/marketing/cta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <NotADashboard />
      <CoreLoop />
      <RoadmapPreview />
      <Cta />
    </>
  );
}
