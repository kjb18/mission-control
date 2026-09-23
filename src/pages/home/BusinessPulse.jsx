import SectionHeader from "./SectionHeader";
import { useBusinessPulse } from "../../lib/useBusinessPulse";
import { IntakeIcon, PipelineIcon, LedgerIcon, OkrIcon } from "../../components/icons";

const CARD_DEFS = [
  {
    key: "rfqsUnanswered",
    label: "RFQs Unanswered",
    icon: IntakeIcon,
    tone: "text-amber-300 bg-amber-400/10",
  },
  {
    key: "posUndelivered",
    label: "POs Undelivered",
    icon: PipelineIcon,
    tone: "text-sky-300 bg-sky-400/10",
  },
  {
    key: "pendingPayment",
    label: "Pending Payment",
    icon: LedgerIcon,
    tone: "text-rose-300 bg-rose-400/10",
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARD_DEFS.map(({ key, label, icon: Icon, tone }) => (
          <div
            key={key}
            className="rounded-2xl border border-white/10 bg-base-900 p-4 flex flex-col gap-3"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {loading ? "—" : stats[key]}
              </p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
