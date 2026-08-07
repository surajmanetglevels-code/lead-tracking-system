import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { matchedApi } from "../api/api";
import StatusBadge, { COLORS } from "../components/StatusBadge";

const UTM_COLORS = ["#4F46E5", "#0EA5E9", "#F59E0B", "#16A34A", "#A855F7", "#DC2626", "#64748B"];
const STAGES = ["New", "Assigned", "Contacted", "Follow-up", "Trial Given", "Paid", "Dropped"];

export default function MatchedDashboard() {
  const mode = "live";
  const [overview, setOverview] = useState(null);
  const [byUtm, setByUtm] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [dropReasons, setDropReasons] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [syncState, setSyncState] = useState(null);
  const [syncing, setSyncing] = useState(false);

  async function loadSyncState() {
    try {
      const { data } = await matchedApi.syncStatus();
      setSyncState(data);
    } catch {
      // sync status is a nice-to-have; don't block the page on it
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await matchedApi.syncNow();
      await loadSyncState();
      await loadAll();
    } catch (e) {
      setErr(e.response?.data?.message || "Manual sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const params = { mode };
      const [o, u, f, d, l] = await Promise.all([
        matchedApi.overview(params),
        matchedApi.byUtmSource(params),
        matchedApi.funnel(params),
        matchedApi.dropReasons(params),
        matchedApi.list({ ...params, limit: 20, q }),
      ]);
      setOverview(o.data);
      setByUtm(u.data);
      setFunnel(f.data);
      setDropReasons(d.data);
      setItems(l.data.items);
      setTotal(l.data.total);
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to load matched-lead data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    loadSyncState();
    const interval = setInterval(loadSyncState, 15000); // poll every 15s so "last synced" stays fresh
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    loadAll();
  }

  const funnelRows = funnel.map((row) => {
    const entry = { utmSource: row.utmSource || "Unknown" };
    STAGES.forEach((stage) => {
      const found = row.stages.find((s) => s.status === stage);
      entry[stage] = found ? found.count : 0;
    });
    return entry;
  });

  function timeAgo(dateStr) {
    if (!dateStr) return "never";
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h2>Source-Matched Lead Journeys</h2>
          <p>Joined by phone number: MongoDB (source/UTM truth) × Excel (call-journey truth)</p>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Live data only
        </div>
      </div>

      <div className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {syncState?.enabled ? (
            <>
              🟢 Live sync <strong>on</strong> — source: <code>{syncState.sourceType === "google_sheet" ? "Google Sheet" : "Local Excel"}</code>
              {" · "}last synced: <strong>{timeAgo(syncState.lastSyncedAt)}</strong>
              {syncState.lastResult && (
                <> ({syncState.lastResult.matched} matched, {syncState.lastResult.staleRecordsDeleted} stale removed)</>
              )}
              {syncState.lastError && <span style={{ color: "#DC2626" }}> — last error: {syncState.lastError}</span>}
            </>
          ) : (
            <>⚪ Live sync is off. Enable spreadsheet synchronization in the server environment.</>
          )}
        </div>
        <button className="btn secondary" onClick={handleSyncNow} disabled={syncing}>
          {syncing ? "Syncing…" : "🔄 Sync now"}
        </button>
      </div>

      {err && <div className="card" style={{ color: "#DC2626" }}>{err}</div>}

      {loading ? (
        <div className="empty-state">Loading matched data…</div>
      ) : overview && overview.totalMatched === 0 ? (
        <div className="card empty-state">
          No live matched leads are available yet.
          <br />
          Use <strong>Sync now</strong> after confirming the Google Sheet and MongoDB submissions are available.
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="label">Matched Leads</div>
              <div className="value">{overview.totalMatched}</div>
              <div className="sub">Present on both MongoDB &amp; Excel</div>
            </div>
            <div className="stat-card">
              <div className="label">Conversion Rate</div>
              <div className="value">{overview.conversionRate}%</div>
            </div>
            <div className="stat-card">
              <div className="label">Drop Rate</div>
              <div className="value">{overview.dropRate}%</div>
            </div>
            <div className="stat-card">
              <div className="label">Paid</div>
              <div className="value">{overview.stageBreakdown["Paid"] || 0}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Matched leads by UTM source</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byUtm}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" />
                  <XAxis dataKey="utmSource" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {byUtm.map((entry, i) => (
                      <Cell key={entry.utmSource} fill={UTM_COLORS[i % UTM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Top drop-off reasons by UTM source</h3>
              {dropReasons.length === 0 ? (
                <div className="empty-state">No dropped leads yet.</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>UTM Source</th><th>Reason</th><th>Count</th></tr>
                  </thead>
                  <tbody>
                    {dropReasons.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td>{r.utmSource || "Unknown"}</td>
                        <td>{r.reason || "Unspecified"}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Funnel by UTM source</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={funnelRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" />
                <XAxis dataKey="utmSource" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {STAGES.map((stage) => (
                  <Bar key={stage} dataKey={stage} stackId="a" fill={COLORS[stage]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3>Matched leads ({total})</h3>
            <form className="filters-bar" onSubmit={handleSearch}>
              <input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn secondary" type="submit">Search</button>
            </form>
            <table>
              <thead>
                <tr>
                  <th>Phone</th><th>Name</th><th>UTM Source</th><th>Medium</th><th>Campaign</th><th>Stage</th><th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l._id}>
                    <td><Link to={`/matched/${l.phone}?mode=${mode}`}>{l.phone}</Link></td>
                    <td>{l.fullName || l.excelCustomerName}</td>
                    <td>{l.utmSource || "—"}</td>
                    <td>{l.utmMedium || "—"}</td>
                    <td>{l.utmCampaign || "—"}</td>
                    <td><StatusBadge status={l.excelStage} /></td>
                    <td>{l.excelAgent || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div className="empty-state">No matches for this search.</div>}
          </div>
        </>
      )}
    </div>
  );
}
