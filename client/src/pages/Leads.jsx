import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { leadsApi } from "../api/api";
import StatusBadge from "../components/StatusBadge";

const STAGES = ["New", "Assigned", "Contacted", "Follow-up", "Trial Given", "Paid", "Dropped"];

export default function Leads() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  async function load() {
    const params = { page, limit };
    if (source) params.source = source;
    if (status) params.status = status;
    if (q) params.q = q;
    const { data } = await leadsApi.list(params);
    setItems(data.items);
    setTotal(data.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, source, status]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h2>Leads</h2>
          <p>{total} total leads</p>
        </div>
      </div>

      <form className="filters-bar" onSubmit={handleSearch}>
        <input placeholder="Search name / phone / lead ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          <option>Facebook</option>
          <option>Google Ads</option>
          <option>Instagram</option>
          <option>Website Organic</option>
          <option>YouTube</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn secondary" type="submit">Search</button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Lead ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Status</th>
              <th>Agent</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l._id}>
                <td>
                  <Link to={`/leads/${l.leadId}`}>{l.leadId}</Link>
                </td>
                <td>{l.name}</td>
                <td>{l.phone}</td>
                <td>{l.source}</td>
                <td><StatusBadge status={l.currentStatus} /></td>
                <td>{l.assignedAgentName || "—"}</td>
                <td>{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty-state">No leads match these filters.</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ← Prev
        </button>
        <span style={{ alignSelf: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Page {page} of {totalPages}
        </span>
        <button className="btn secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
