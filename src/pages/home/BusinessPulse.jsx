import SectionHeader from "./SectionHeader";
import { useBusinessPulse } from "../../lib/useBusinessPulse";
import { IntakeIcon, PipelineIcon, LedgerIcon, OkrIcon } from "../../components/icons";

const CARD_DEFS = [
  {
    key: "rfqsUnanswered",
    label: "RFQs Unanswered",
    icon: IntakeIcon,
    tone: "text-orange-400 bg-orange-500/10",
  },
  {
    key: "posUndelivered",
    label: "POs Undelivered",
    icon: PipelineIcon,
    tone: "text-blue-400 bg-blue-500/10",
  },
  {
    key: "pendingPayment",
    label: "Pending Payment",
    icon: LedgerIcon,
    tone: "text-red-300 bg-red-400/10",
  },
  {
    key: "completedThisYear",
    label: "Completed This Year",
    icon: OkrIcon,
    tone: "text-emerald-300 bg-emerald-400/10",
  },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[6px]">
        {CARD_DEFS.map(({ key, label, icon: Icon, tone }) => (
          <div
            key={key}
            className="rounded-lg border-[0.5px] border-line bg-base-900 px-3 py-2.5 flex items-center gap-2.5"
          >
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
              <Icon className="w-[14px] h-[14px]" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium tabular-nums" style={{ fontSize: 18 }}>
                {loading ? "—" : stats[key]}
              </p>
              <p className="uppercase text-ink-muted truncate" style={{ fontSize: 8, letterSpacing: "0.06em" }}>
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
