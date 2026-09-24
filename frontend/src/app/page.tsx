/**
 * Public landing page — reproduced from the real, approved Stitch export
 * (project 18072378067396819631, screen 671f69847aff45f6813834e1b1f25588,
 * "Make My Wedding Plan - Private Wedding Management Platform"), fetched
 * directly via the Stitch MCP `get_screen`/`list_screens` download URLs.
 * Structure, copy, data, and imagery below are transcribed from that export,
 * not written from doc/prd.md — including sections (e.g. the "Smart Stay &
 * Travel Desk" module) that describe product surfaces not yet built. That's
 * a deliberate call: match the approved design as-is rather than trim it to
 * current backend scope. See frontend/CLAUDE.md for the full picture.
 */
import { EventsGrid } from "@/components/marketing/EventsGrid";
import { FamilyCouncil } from "@/components/marketing/FamilyCouncil";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Footer } from "@/components/marketing/Footer";
import { GuestPortal } from "@/components/marketing/GuestPortal";
import { Header } from "@/components/marketing/Header";
import { Hero } from "@/components/marketing/Hero";
import { PhotoVault } from "@/components/marketing/PhotoVault";
import { PlanningEssentials } from "@/components/marketing/PlanningEssentials";
import { PrivacyTrust } from "@/components/marketing/PrivacyTrust";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { WorkspaceModules } from "@/components/marketing/WorkspaceModules";

export default function Home() {
  return (
    <>
      <Header />
      <main className="min-h-screen w-full bg-surface pt-20">
        <div className="flex w-full flex-col">
          <Hero />
          <ProblemSolution />
          <WorkspaceModules />
          <FamilyCouncil />
          <EventsGrid />
          <GuestPortal />
          <PlanningEssentials />
          <PhotoVault />
          <PrivacyTrust />
          <FinalCta />
        </div>
      </main>
      <Footer />
    </>
  );
}
