"use client";

const CUR: Record<string, string> = { AUD: "A$", NZD: "NZ$", USD: "US$" };

function fmt(cents: number, c = "AUD") {
  const s = CUR[c] || "$";
  return `${cents < 0 ? "-" : ""}${s}${(Math.abs(cents) / 100).toLocaleString(
    "en-AU",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  )}`;
}

interface Metrics {
  netWorthAud: number;
  liquidAssetsAud: number;
  totalLiabilitiesAud: number;
  monthlyIncomeAud: number;
  monthlyExpensesAud: number;
  monthlySurplusAud: number;
  monthlyPassiveAud: number;
  savingsRate: number;
  runwayMonths: number;
}

export default function MetricCards({ metrics }: { metrics: Metrics }) {
  const m = metrics;

  const cards = [
    {
      label: "Net Worth",
      value: fmt(m.netWorthAud),
      color: "text-white",
    },
    {
      label: "Monthly Surplus",
      value: fmt(m.monthlySurplusAud),
      color: m.monthlySurplusAud >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Savings Rate",
      value: `${m.savingsRate.toFixed(1)}%`,
      color:
        m.savingsRate >= 20
          ? "text-green-400"
          : m.savingsRate >= 0
          ? "text-amber-400"
          : "text-red-400",
    },
    {
      label: "Runway (months)",
      value: m.runwayMonths >= 999 ? "∞" : m.runwayMonths.toFixed(1),
      color: "text-blue-400",
    },
    {
      label: "Passive Income/mo",
      value: fmt(m.monthlyPassiveAud),
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900 rounded-lg p-4"
        >
          <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
          <p className="text-xs text-gray-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}