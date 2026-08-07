const COLORS = {
  New: "var(--stage-new)",
  Assigned: "var(--stage-assigned)",
  Contacted: "var(--stage-contacted)",
  "Follow-up": "var(--stage-followup)",
  "Trial Given": "var(--stage-trial)",
  Paid: "var(--stage-paid)",
  Dropped: "var(--stage-dropped)",
};

export default function StatusBadge({ status }) {
  const bg = COLORS[status] || "#94A3B8";
  return (
    <span className="badge" style={{ background: bg }}>
      {status}
    </span>
  );
}

export { COLORS };
