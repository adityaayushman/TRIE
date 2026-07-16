import { RiskDashboard } from "@/components/RiskDashboard";
import { mockRiskAssessment } from "@/lib/mockData";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-bold">Smart Road Guardian AI X</h1>
        <p className="text-sm text-slate-500">Predict. Explain. Prevent.</p>
      </header>
      <RiskDashboard assessment={mockRiskAssessment} />
    </main>
  );
}
