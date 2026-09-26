import SectionHeader from "./SectionHeader";
import { useBusinessPulse } from "../../lib/useBusinessPulse";
import { IntakeIcon, PipelineIcon, LedgerIcon, OkrIcon } from "../../components/icons";

const CARD_DEFS = [
  {
    key: "rfqsUnanswered",
    label: "RFQs Unanswered",
    icon: IntakeIcon,
    tone: "text-blue-500 bg-blue-500/10",
    topBorder: "border-t-blue-500",
  },
  {
    key: "posUndelivered",
    label: "POs Undelivered",
    icon: PipelineIcon,
    tone: "text-blue-500 bg-blue-500/10",
    topBorder: "border-t-blue-500",
  },
  {
    key: "pendingPayment",
    label: "Pending Payment",
    icon: LedgerIcon,
    tone: "text-amber-500 bg-amber-500/10",
    topBorder: "border-t-amber-500",
  },
  {
    key: "completedThisYear",
    label: "Completed This Year",
    icon: OkrIcon,
    tone: "text-emerald-500 bg-emerald-500/10",
    topBorder: "border-t-emerald-500",
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
        {CARD_DEFS.map(({ key, label, icon: Icon, tone, topBorder }) => (
          <div
            key={key}
            className={`rounded-[10px] border-[0.5px] border-line border-t-2 ${topBorder} bg-base-900 px-3 py-2.5 flex items-center gap-2.5`}
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
