import { LiveRiskDashboard } from "@/components/LiveRiskDashboard";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-800/80 px-5 py-7">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-bold tracking-tight text-slate-50">
            Smart Road Guardian AI X
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Predict. Explain. Prevent. — explainable multimodal transportation risk
            intelligence
          </p>
        </div>
      </header>
      <LiveRiskDashboard />
    </main>
  );
}
