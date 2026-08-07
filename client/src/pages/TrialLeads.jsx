import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { matchedApi } from "../api/api";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
}

export default function TrialLeads() {
  const [items, setItems] = useState([]);

  const [summary, setSummary] = useState({
    total: 0,
    started: 0,
    completed: 0,
    converted: 0,
  });

  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const { data } = await matchedApi.trials({
        mode: "live",
        q,
        limit: 100,
      });

      setItems(data.items || []);
      setTotal(data.total || 0);

      setSummary(
        data.summary || {
          total: 0,
          started: 0,
          completed: 0,
          converted: 0,
        }
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load trial journeys"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function submit(event) {
    event.preventDefault();
    load();
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h2>Trial Lead Journeys</h2>

          <p>
            All matched leads that currently have or previously had
            trial activity in the live Google Sheet.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ color: "#dc2626" }}
        >
          {error}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">
            Total Trial Journeys
          </div>

          <div className="value">
            {summary.total}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">
            Trial Started
          </div>

          <div className="value">
            {summary.started}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">
            Trial Completed
          </div>

          <div className="value">
            {summary.completed}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">
            Converted
          </div>

          <div className="value">
            {summary.converted}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="trial-list-header">
          <div>
            <h3>
              Trial journeys ({total})
            </h3>

            <p
              style={{
                margin: "4px 0 0",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Includes current and historical trial activity.
            </p>
          </div>

          <form
            className="filters-bar"
            onSubmit={submit}
          >
            <input
              placeholder="Search name, phone or agent"
              value={q}
              onChange={(event) =>
                setQ(event.target.value)
              }
            />

            <button
              className="btn secondary"
              type="submit"
            >
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading trial journeys…
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            No trial information is available. Run Sync now
            after trial fields are updated in the Google Sheet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Name</th>
                  <th>Agent</th>
                  <th>Current Lead Stage</th>
                  <th>Trial Status</th>
                  <th>Trial Start</th>
                  <th>Day 1</th>
                  <th>Day 2</th>
                  <th>Day 3</th>
                  <th>Extended Until</th>
                  <th>Conviction</th>
                </tr>
              </thead>

              <tbody>
                {items.map((lead) => (
                  <tr key={lead._id}>
                    <td>
                      <Link
                        to={`/trials/${lead.phone}?mode=live`}
                      >
                        {lead.phone}
                      </Link>
                    </td>

                    <td>
                      {lead.fullName ||
                        lead.excelCustomerName ||
                        "—"}
                    </td>

                    <td>
                      {lead.excelAgent || "—"}
                    </td>

                    <td>
                      {lead.excelStage || "—"}
                    </td>

                    <td>
                      {lead.trialStatus ||
                        lead.excelRawStage ||
                        "Trial activity"}
                    </td>

                    <td>
                      {formatDate(lead.trialStart)}
                    </td>

                    <td>
                      {formatDate(lead.trialDay1)}
                    </td>

                    <td>
                      {formatDate(lead.trialDay2)}
                    </td>

                    <td>
                      {formatDate(lead.trialDay3)}
                    </td>

                    <td>
                      {formatDate(
                        lead.trialExtendedUntil
                      )}
                    </td>

                    <td>
                      {lead.trialConviction || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}