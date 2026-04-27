import { ReactNode } from "react";
import { ExpertHeader } from "./ExpertHeader";
import { ExpertBottomNav } from "./ExpertBottomNav";
import ErrorBoundary from "@/components/ErrorBoundary";

interface ExpertLayoutProps {
  children: ReactNode;
}

export const ExpertLayout = ({ children }: ExpertLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <ExpertHeader />
      <main className="pt-14 max-w-4xl mx-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      <ExpertBottomNav />
    </div>
  );
};
