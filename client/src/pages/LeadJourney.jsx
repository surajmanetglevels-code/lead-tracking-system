import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { leadsApi } from "../api/api";
import StatusBadge from "../components/StatusBadge";

function Field({ label, value }) {
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
        {value === null ||
        value === undefined ||
        value === ""
          ? "—"
          : value}
      </div>
    </div>
  );
}

function formatDate(value, withTime = true) {
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

export default function LeadJourney() {
  const { id } = useParams();

  const [lead, setLead] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setLead(null);

    leadsApi
      .get(id)
      .then(({ data }) => {
        setLead(data);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ||
            "Lead could not be loaded."
        );
      });
  }, [id]);

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
        Loading lead…
      </div>
    );
  }

  const journey = Array.isArray(lead.history)
    ? lead.history
    : [];

  const isConverted =
    Boolean(lead.isConverted) ||
    lead.currentStatus === "Paid";

  const displayedAmount = isConverted
    ? lead.paymentAmount
    : lead.amountCollected;

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h2>
            {lead.name ||
              lead.fullName ||
              "Unnamed lead"}
          </h2>

          <p>
            {lead.phone || "—"} · Current stage:{" "}
            {lead.currentStatus || "New"}
          </p>
        </div>

        <Link
          to="/leads"
          className="btn secondary"
        >
          ← Back to leads
        </Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Where this lead came from</h3>

          <Field
            label="Full name"
            value={
              lead.name ||
              lead.fullName
            }
          />

          <Field
            label="Phone"
            value={lead.phone}
          />

          <Field
            label="Email"
            value={lead.email}
          />

          <Field
            label="Source"
            value={
              lead.captureSource ||
              lead.source
            }
          />

          <Field
            label="Campaign"
            value={
              lead.campaign ||
              lead.utmCampaign
            }
          />

          <Field
            label="UTM Source"
            value={lead.utmSource}
          />

          <Field
            label="UTM Medium"
            value={lead.utmMedium}
          />

          <Field
            label="UTM Campaign"
            value={lead.utmCampaign}
          />

          <Field
            label="UTM Content"
            value={lead.utmContent}
          />

          <Field
            label="UTM Term"
            value={lead.utmTerm}
          />

          <Field
            label="Captured At"
            value={formatDate(
              lead.capturedAt ||
                lead.createdAt
            )}
          />
        </div>

        <div className="card">
          <h3>Excel call journey</h3>

          <div style={{ marginBottom: 16 }}>
            <StatusBadge
              status={lead.currentStatus}
            />

            {lead.rawStage && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginLeft: 8,
                }}
              >
                (original sheet value: &quot;
                {lead.rawStage}
                &quot;)
              </span>
            )}
          </div>

          <Field
            label="Customer name in sheet"
            value={
              lead.excelCustomerName ||
              lead.name ||
              lead.fullName
            }
          />

          <Field
            label="Sheet source"
            value={lead.excelSource}
          />

          <Field
            label="Lead type"
            value={
              lead.leadType ||
              lead.excelLeadType
            }
          />

          <Field
            label="Assigned agent"
            value={
              lead.assignedAgentName ||
              lead.excelAgent
            }
          />

          <Field
            label="Group leader"
            value={
              lead.groupLeader ||
              lead.excelGroupLeader
            }
          />

          <Field
            label="Last feedback"
            value={
              lead.feedback ||
              lead.excelLastFeedback
            }
          />

          <Field
            label="Drop reason"
            value={
              lead.dropReason ||
              lead.excelDropReason
            }
          />

          <Field
            label="Amount collected"
            value={formatCurrency(
              displayedAmount
            )}
          />

          <Field
            label="Lead date"
            value={formatDate(
              lead.excelLeadDate,
              false
            )}
          />

          {isConverted && (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 10,
                border:
                  "1px solid #bbf7d0",
                background: "#f0fdf4",
              }}
            >
              <h3
                style={{
                  margin: "0 0 14px",
                  color: "#166534",
                  fontSize: 16,
                }}
              >
                Payment information
              </h3>

              <Field
                label="Paid amount"
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
                label="Course"
                value={lead.paymentCourse}
              />

              <Field
                label="Plan"
                value={lead.paymentPlan}
              />

              <Field
                label="Payment date"
                value={formatDate(
                  lead.paymentDate,
                  false
                )}
              />

              <Field
                label="Conversation ID"
                value={
                  lead.paymentTransactionId
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Entire lead journey</h3>

        {journey.length === 0 ? (
          <div className="empty-state">
            No journey information is available.
          </div>
        ) : (
          <div className="timeline">
            {journey.map(
              (item, index) => (
                <div
                  className="timeline-item"
                  key={`${item.status}-${index}`}
                >
                  <div className="timeline-dot" />

                  <div className="t-status">
                    <StatusBadge
                      status={item.status}
                    />

                    {item.reason
                      ? ` — ${item.reason}`
                      : ""}
                  </div>

                  <div className="t-meta">
                    {formatDate(
                      item.changedAt
                    )}

                    {item.agentName
                      ? ` · Agent: ${item.agentName}`
                      : ""}
                  </div>

                  {item.note && (
                    <div className="t-note">
                      {item.note}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}