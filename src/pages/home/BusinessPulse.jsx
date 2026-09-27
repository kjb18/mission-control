import SectionHeader from "./SectionHeader";
import { useBusinessPulse } from "../../lib/useBusinessPulse";
import { StatCard } from "../../components/ui";

const CARD_DEFS = [
  { key: "rfqsUnanswered", label: "RFQs Unanswered", color: "blue", href: "/intake" },
  { key: "posUndelivered", label: "POs Undelivered", color: "blue", href: "/pipeline" },
  { key: "pendingPayment", label: "Pending Payment", color: "amber", href: "/ledger" },
  { key: "completedThisYear", label: "Completed This Year", color: "green", href: "/okrs" },
];

export default function BusinessPulse() {
  const { stats, loading } = useBusinessPulse();

  return (
    <section>
      <SectionHeader
        eyebrow="Operations"
        title="Business Pulse"
        subtitle="Live counts pulled straight from the pipeline."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARD_DEFS.map(({ key, label, color, href }) => (
          <StatCard key={key} label={label} value={loading ? "—" : stats[key]} color={color} href={href} />
        ))}
      </div>
    </section>
  );
}
