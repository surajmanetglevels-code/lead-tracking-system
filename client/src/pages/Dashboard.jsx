import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { analyticsApi } from "../api/api";
import { COLORS } from "../components/StatusBadge";

const SOURCE_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#F59E0B",
  "#16A34A",
  "#A855F7",
  "#DC2626",
  "#64748B",
];

const STAGES = [
  "New",
  "Assigned",
  "Contacted",
  "Follow-up",
  "Trial Given",
  "Paid",
  "Dropped",
];

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getToday() {
  return formatLocalDate(new Date());
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getRangeFromPreset(preset) {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  switch (preset) {
    case "yesterday":
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;
    case "last7":
      from.setDate(from.getDate() - 6);
      break;
    case "last30":
      from.setDate(from.getDate() - 29);
      break;
    case "thisMonth":
      from.setDate(1);
      break;
    case "today":
    default:
      break;
  }

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
}

export default function Dashboard() {
  const today = useMemo(() => getToday(), []);
  const [overview, setOverview] = useState(null);
  const [bySource, setBySource] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [dropReasons, setDropReasons] = useState([]);
  const [agentPerf, setAgentPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dashboard opens with today's lead journey.
const defaultRange = useMemo(
  () => getRangeFromPreset("last30"),
  []
);

const [fromDate, setFromDate] = useState(
  defaultRange.from
);

const [toDate, setToDate] = useState(
  defaultRange.to
);

const [appliedRange, setAppliedRange] =
  useState({
    from: defaultRange.from,
    to: defaultRange.to,
  });

const [preset, setPreset] =
  useState("last30");

  async function loadAll(range = appliedRange) {
    setLoading(true);
    setError("");

    try {
      const params = {
        from: range.from,
        to: range.to,
      };

      const [o, s, f, d, a] = await Promise.all([
        analyticsApi.overview(params),
        analyticsApi.bySource(params),
        analyticsApi.funnel(params),
        analyticsApi.dropReasons(params),
        analyticsApi.agentPerformance(params),
      ]);

      setOverview(o.data);
      setBySource(Array.isArray(s.data) ? s.data : []);
      setFunnel(Array.isArray(f.data) ? f.data : []);
      setDropReasons(Array.isArray(d.data) ? d.data : []);
      setAgentPerf(Array.isArray(a.data) ? a.data : []);
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  loadAll(defaultRange);

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  function applyDateFilter(event) {
    event?.preventDefault();

    if (!fromDate || !toDate) {
      setError("Please select both From Date and To Date.");
      return;
    }

    if (fromDate > toDate) {
      setError("From Date cannot be later than To Date.");
      return;
    }

    const nextRange = { from: fromDate, to: toDate };
    setAppliedRange(nextRange);
    loadAll(nextRange);
  }

  function applyPreset(nextPreset) {
    const range = getRangeFromPreset(nextPreset);
    setPreset(nextPreset);
    setFromDate(range.from);
    setToDate(range.to);
    setAppliedRange(range);
    loadAll(range);
  }

  function handleDateChange(setter) {
    return (event) => {
      setter(event.target.value);
      setPreset("custom");
    };
  }

  const funnelRows = funnel.map((row) => {
    const entry = { source: row.source };

    STAGES.forEach((stage) => {
      const found = Array.isArray(row.stages)
        ? row.stages.find((item) => item.status === stage)
        : null;
      entry[stage] = found ? found.count : 0;
    });

    return entry;
  });

  return (
    <div className="main">
      <div className="page-header dashboard-header-with-filter">
        <div>
          <h2>Lead Source &amp; Conversion Dashboard</h2>
          <p>Live analysis of matched MongoDB and Google Sheet leads</p>
        </div>

        <form className="dashboard-date-filter" onSubmit={applyDateFilter}>
          <div className="date-filter-field">
            <label htmlFor="dashboard-from-date">From Date</label>
            <input
              id="dashboard-from-date"
              type="date"
              value={fromDate}
              max={toDate || today}
              onChange={handleDateChange(setFromDate)}
            />
          </div>

          <div className="date-filter-field">
            <label htmlFor="dashboard-to-date">To Date</label>
            <input
              id="dashboard-to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              max={today}
              onChange={handleDateChange(setToDate)}
            />
          </div>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Apply Filter"}
          </button>

        
        </form>
      </div>

      <div className="dashboard-quick-filters" aria-label="Quick date filters">
{[
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 Days"],
  ["last30", "Last 30 Days"],
  ["thisMonth", "This Month"],
].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`quick-filter-btn ${preset === value ? "active" : ""}`}
            onClick={() => applyPreset(value)}
            disabled={loading}
          >
            {label}
          </button>
        ))}

        <span className="active-date-range">
          Showing: {appliedRange.from} to {appliedRange.to}
        </span>
      </div>

      {error && (
        <div className="card dashboard-error-card">
          <strong>Dashboard could not load:</strong> {error}
          <button className="btn secondary" onClick={() => loadAll()}>
            Retry
          </button>
        </div>
      )}

      {loading && !overview ? (
        <div className="empty-state">Loading dashboard…</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="label">Total Leads</div>
              <div className="value">{overview?.totalLeads || 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">Conversion Rate</div>
              <div className="value">{overview?.conversionRate || 0}%</div>
              <div className="sub">Paid / Total Leads</div>
            </div>
            <div className="stat-card">
              <div className="label">Drop Rate</div>
              <div className="value">{overview?.dropRate || 0}%</div>
              <div className="sub">Dropped / Total Leads</div>
            </div>
            <div className="stat-card">
              <div className="label">Paid Subscribers</div>
              <div className="value">{overview?.paid || 0}</div>
              <div className="sub">Matched in payment sheet</div>
            </div>
            <div className="stat-card">
              <div className="label">Trial Given</div>
              <div className="value">{overview?.trialGiven || 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">Total Revenue</div>
              <div className="value currency-value">
                {formatCurrency(overview?.totalRevenue)}
              </div>
              <div className="sub">From paid subscription sheet</div>
            </div>
            <div className="stat-card">
              <div className="label">Average Ticket</div>
              <div className="value currency-value">
                {formatCurrency(overview?.averageTicket)}
              </div>
              <div className="sub">Revenue / Paid subscribers</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Leads received by source</h3>
              {bySource.length === 0 ? (
                <div className="empty-state">No leads found for this date range.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={bySource}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" />
                    <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {bySource.map((entry, index) => (
                        <Cell
                          key={`${entry.source}-${index}`}
                          fill={SOURCE_COLORS[index % SOURCE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h3>Top drop-off reasons</h3>
              {dropReasons.length === 0 ? (
                <div className="empty-state">No dropped leads for this date range.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Reason</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dropReasons.slice(0, 8).map((reason, index) => (
                      <tr key={`${reason.source}-${reason.reason}-${index}`}>
                        <td>{reason.source}</td>
                        <td>{reason.reason || "Unspecified"}</td>
                        <td>{reason.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Conversion and revenue by source</h3>
            {bySource.length === 0 ? (
              <div className="empty-state">No conversion data for this date range.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Total Leads</th>
                    <th>Paid</th>
                    <th>Conversion Rate</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((row) => (
                    <tr key={`conversion-${row.source}`}>
                      <td>{row.source}</td>
                      <td>{row.total || 0}</td>
                      <td>{row.paid || 0}</td>
                      <td>{row.conversionRate || 0}%</td>
                      <td>{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>Funnel by source — where each source&apos;s leads currently stand</h3>
            {funnelRows.length === 0 ? (
              <div className="empty-state">No funnel data for this date range.</div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={funnelRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" />
                  <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {STAGES.map((stage) => (
                    <Bar
                      key={stage}
                      dataKey={stage}
                      stackId="a"
                      fill={COLORS[stage]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3>Agent performance</h3>
            {agentPerf.length === 0 ? (
              <div className="empty-state">No agent data for this date range.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Assigned</th>
                    <th>Paid</th>
                    <th>Dropped</th>
                    <th>Revenue</th>
                    <th>Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerf.map((agent) => (
                    <tr key={agent.agent}>
                      <td>{agent.agent}</td>
                      <td>{agent.totalAssigned}</td>
                      <td>{agent.paid}</td>
                      <td>{agent.dropped}</td>
                      <td>{formatCurrency(agent.revenue)}</td>
                      <td>{agent.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
