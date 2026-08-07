import { useEffect, useState } from "react";
import {
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import { matchedApi } from "../api/api";
import StatusBadge from "../components/StatusBadge";

function Field({ label, value }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "";

  return (
    <div style={{ marginBottom: 10 }}>
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
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `₹${amount.toLocaleString("en-IN")}`;
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

export default function MatchedLeadDetail() {
  const { phone } = useParams();
  const [searchParams] = useSearchParams();

  const mode =
    searchParams.get("mode") || "live";

  const [lead, setLead] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLead(null);
    setErr("");

    matchedApi
      .get(phone, { mode })
      .then(({ data }) => {
        setLead(data);
      })
      .catch((error) => {
        setErr(
          error.response?.data?.message ||
            "Not found"
        );
      });
  }, [phone, mode]);

  if (err) {
    return (
      <div className="main empty-state">
        {err}
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="main empty-state">
        Loading…
      </div>
    );
  }

  const displayedAmount = lead.isConverted
    ? lead.paymentAmount
    : lead.excelAmountCollected;

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h2>
            {lead.fullName ||
              lead.excelCustomerName ||
              "Unnamed lead"}
          </h2>

          <p>
            {lead.phone} · mode: {lead.mode}
          </p>
        </div>

        <Link
          to="/matched"
          className="btn secondary"
        >
          ← Back to matched leads
        </Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>
            Where this lead came from (MongoDB)
          </h3>

          <Field
            label="Full name"
            value={lead.fullName}
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
            label="UTM ID"
            value={lead.utmId}
          />

          <Field
            label="GCLID"
            value={lead.gclid}
          />

          <Field
            label="FBCLID"
            value={lead.fbclid}
          />

          <Field
            label="Captured At"
            value={formatDate(lead.capturedAt)}
          />
        </div>

        <div className="card">
          <h3>
            What happened to them
            (Excel call journey)
          </h3>

          <div style={{ marginBottom: 14 }}>
            <StatusBadge
              status={lead.excelStage}
            />

            {lead.excelRawStage && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginLeft: 8,
                }}
              >
                (original sheet value: "
                {lead.excelRawStage}")
              </span>
            )}
          </div>

          <Field
            label="Customer name (in Excel)"
            value={lead.excelCustomerName}
          />

          <Field
            label="Excel's own Source column"
            value={lead.excelSource}
          />

          <Field
            label="Lead type"
            value={lead.excelLeadType}
          />

          <Field
            label="Agent"
            value={lead.excelAgent}
          />

          <Field
            label="Group Leader"
            value={lead.excelGroupLeader}
          />

          {lead.excelStage === "Dropped" && (
            <Field
              label="Drop reason"
              value={lead.excelDropReason}
            />
          )}

          <Field
            label="Last feedback (agent notes)"
            value={lead.excelLastFeedback}
          />

          <Field
            label="Lost reason (sheet field)"
            value={lead.excelLostReason}
          />

          <Field
            label="Lead date"
            value={formatDate(
              lead.excelLeadDate,
              false
            )}
          />

          <Field
            label={
              lead.isConverted
                ? "Paid amount"
                : "Amount collected"
            }
            value={formatCurrency(
              displayedAmount
            )}
          />
        </div>
      </div>

      <div
        className="card"
        style={{ marginTop: 20 }}
      >
        <h3>Subscription conversion</h3>

        {lead.isConverted ? (
          <div className="grid-2">
            <div>
              <Field
                label="Conversion status"
                value="Paid / Converted"
              />

              <Field
                label="Student name"
                value={
                  lead.paymentStudentName ||
                  lead.excelCustomerName ||
                  lead.fullName
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
            </div>

            <div>
              <Field
                label="Amount paid"
                value={formatCurrency(
                  lead.paymentAmount
                )}
              />

              <Field
                label="Payment date"
                value={formatDate(
                  lead.paymentDate
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
                label="Conversation ID"
                value={
                  lead.paymentTransactionId
                }
              />

              <Field
                label="Transactions"
                value={
                  lead.paymentTransactionCount
                }
              />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            No paid subscription entry found
            for this phone number.
          </div>
        )}
      </div>
    </div>
  );
}