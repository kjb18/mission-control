import SectionHeader from "./SectionHeader";
import { useBusinessPulse } from "../../lib/useBusinessPulse";
import { StatCard } from "../../components/ui";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export default function BusinessPulse() {
  const { stats, loading } = useBusinessPulse();

  const cards = [
    {
      key: "rfqsUnanswered",
      label: "RFQs Unanswered",
      value: loading ? "—" : stats.rfqsUnanswered,
      color: "blue",
      valueColor: !loading && stats.rfqsUnanswered > 0 ? "red" : undefined,
      href: "/intake",
    },
    {
      key: "posUndelivered",
      label: "POs Undelivered",
      value: loading ? "—" : stats.posUndelivered,
      color: "blue",
      valueColor: !loading && stats.posUndelivered > 0 ? "orange" : undefined,
      href: "/pipeline",
    },
    {
      key: "pendingPayment",
      label: "Pending Payment",
      value: loading ? "—" : currency.format(stats.pendingPayment),
      color: "amber",
      valueColor: "amber",
      href: "/ledger",
    },
    {
      key: "completedThisYear",
      label: "Completed This Year",
      value: loading ? "—" : stats.completedThisYear,
      color: "green",
      valueColor: "green",
      href: "/okrs",
    },
  ];

  return (
    <section>
      <SectionHeader eyebrow="Operations" title="Business Pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {cards.map((c) => (
          <StatCard key={c.key} {...c} />
        ))}
      </div>
    </section>
  );
}
