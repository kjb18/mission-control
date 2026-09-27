import { Badge } from "../../components/ui";

const VARIANTS = {
  Hot: "red",
  Medium: "amber",
  Low: "blue",
  Nurturing: "blue",
};

export default function PriorityBadge({ priority }) {
  return <Badge variant={VARIANTS[priority] ?? "gray"}>{priority}</Badge>;
}
