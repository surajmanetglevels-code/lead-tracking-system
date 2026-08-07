import { useEffect, useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { matchedApi } from "../api/api";
import StatusBadge from "../components/StatusBadge";

function Field({ label, value }) {
  const empty =
    value === null ||
    value === undefined ||
    value === "";

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          overflowWrap: "anywhere",
        }}
      >
        {empty ? "—" : value}
      </div>
    </div>
  );
}

function formatDate(value, withTime = false) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return withTime
    ? date.toLocaleString("en-IN")
    : date.toLocaleDateString("en-IN");
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function TrialLeadDetail() {
  const { phone } = useParams();

  const [searchParams] = useSearchParams();

  const mode =
    searchParams.get("mode") || "live";

  const [lead, setLead] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLead(null);
    setError("");

    matchedApi
      .trial(phone, { mode })
      .then(({ data }) => {
        setLead(data);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ||
            "Trial journey could not be loaded"
        );
      });
  }, [phone, mode]);

  if (error) {
    return (
      <div className="main empty-state">
        {error}
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="main empty-state">
        Loading trial journey…
      </div>
    );
  }

  const milestones = [
    ["Trial started", lead.trialStart],
    ["Trial day 1", lead.trialDay1],
    ["Trial day 2", lead.trialDay2],
    ["Trial day 3", lead.trialDay3],
    ["Trial day 4", lead.trialDay4],
    [
      "Trial extended until",
      lead.trialExtendedUntil,
    ],
    [
      "Trial completed",
      lead.trialCompletedAt,
    ],
  ].filter(([, value]) => value);

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h2>
            {lead.fullName ||
              lead.excelCustomerName ||
              "Trial lead"}
          </h2>

          <p>
            {lead.phone || "—"} · Agent:{" "}
            {lead.excelAgent || "—"}
          </p>
        </div>

        <Link
          className="btn secondary"
          to="/trials"
        >
          ← Back to trial journeys
        </Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Lead and source</h3>

          <Field
            label="Full name"
            value={
              lead.fullName ||
              lead.excelCustomerName
            }
          />

          <Field
            label="Phone"
            value={lead.phone}
          />

          <Field
            label="Source"
            value={lead.source}
          />

          <Field
            label="Platform"
            value={lead.platform}
          />

          <Field
            label="Source type"
            value={lead.sourceType}
          />

          <Field
            label="UTM source"
            value={lead.utmSource}
          />

          <Field
            label="UTM medium"
            value={lead.utmMedium}
          />

          <Field
            label="UTM campaign"
            value={lead.utmCampaign}
          />

          <Field
            label="UTM content"
            value={lead.utmContent}
          />

          <Field
            label="UTM term"
            value={lead.utmTerm}
          />

          <Field
            label="Agent"
            value={lead.excelAgent}
          />

          <Field
            label="Group leader"
            value={lead.excelGroupLeader}
          />

          <Field
            label="Lead date"
            value={formatDate(
              lead.excelLeadDate
            )}
          />

          <Field
            label="Captured at"
            value={formatDate(
              lead.capturedAt,
              true
            )}
          />
        </div>

        <div className="card">
          <h3>Trial information</h3>

          <div style={{ marginBottom: 14 }}>
            <StatusBadge
              status={
                lead.excelStage ||
                "Trial Given"
              }
            />
          </div>

          <Field
            label="Current lead stage"
            value={lead.excelStage}
          />

          <Field
            label="Original sheet stage"
            value={lead.excelRawStage}
          />

          <Field
            label="Trial status"
            value={
              lead.trialStatus ||
              lead.excelRawStage
            }
          />

          <Field
            label="Trial start"
            value={formatDate(
              lead.trialStart,
              true
            )}
          />

          <Field
            label="Trial day 1"
            value={formatDate(
              lead.trialDay1,
              true
            )}
          />

          <Field
            label="Trial day 2"
            value={formatDate(
              lead.trialDay2,
              true
            )}
          />

          <Field
            label="Trial day 3"
            value={formatDate(
              lead.trialDay3,
              true
            )}
          />

          <Field
            label="Trial day 4"
            value={formatDate(
              lead.trialDay4,
              true
            )}
          />

          <Field
            label="Extended until"
            value={formatDate(
              lead.trialExtendedUntil,
              true
            )}
          />

          <Field
            label="Completed at"
            value={formatDate(
              lead.trialCompletedAt,
              true
            )}
          />

          <Field
            label="Reason"
            value={lead.trialReason}
          />

          <Field
            label="Conviction"
            value={lead.trialConviction}
          />

          <Field
            label="First contact"
            value={formatDate(
              lead.trialFirstContact,
              true
            )}
          />

          <Field
            label="Call timestamps"
            value={lead.trialCallTimestamps}
          />

          <Field
            label="Unreachable tries"
            value={lead.trialUnreachableTry}
          />

          <Field
            label="Last feedback"
            value={lead.excelLastFeedback}
          />
        </div>
      </div>

      {lead.isConverted && (
        <div
          className="card"
          style={{ marginTop: 20 }}
        >
          <h3>Conversion information</h3>

          <div className="grid-2">
            <div>
              <Field
                label="Conversion status"
                value="Paid / Converted"
              />

              <Field
                label="Course"
                value={lead.paymentCourse}
              />

              <Field
                label="Plan"
                value={lead.paymentPlan}
              />
            </div>

            <div>
              <Field
                label="Amount paid"
                value={formatCurrency(
                  lead.paymentAmount
                )}
              />

              <Field
                label="Payment status"
                value={
                  lead.paymentStatus ||
                  "Paid"
                }
              />

              <Field
                label="Payment date"
                value={formatDate(
                  lead.paymentDate,
                  true
                )}
              />

              <Field
                label="Conversation ID"
                value={
                  lead.paymentTransactionId
                }
              />
            </div>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{ marginTop: 20 }}
      >
        <h3>Trial timeline</h3>

        {milestones.length === 0 ? (
          <div className="empty-state">
            No dated trial milestone is available.
          </div>
        ) : (
          <div className="timeline">
            {milestones.map(
              ([label, value]) => (
                <div
                  className="timeline-item"
                  key={label}
                >
                  <div className="timeline-dot" />

                  <div className="t-status">
                    {label}
                  </div>

                  <div className="t-meta">
                    {formatDate(value, true)}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}