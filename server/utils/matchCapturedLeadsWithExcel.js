/**
 * Matches your real MongoDB lead-capture collection (source/UTM truth)
 * against the Excel Leads tab (call-journey truth) by phone number, and
 * saves the combined records into the "matched_leads" collection.
 *
 * Only phone numbers present on BOTH sides are saved.
 *
 * Safe to re-run:
 * - Existing matched records are updated.
 * - New matched records are inserted.
 * - Old matched records that no longer match are deleted.
 *
 * Usage:
 *
 * Live data:
 *   node utils/matchCapturedLeadsWithExcel.js
 *
 * Live data with custom Excel file:
 *   node utils/matchCapturedLeadsWithExcel.js "C:\path\to\workbook.xlsx"
 *
 * Demo data:
 *   node utils/matchCapturedLeadsWithExcel.js --demo
 *
 * Demo data with custom Excel file:
 *   node utils/matchCapturedLeadsWithExcel.js --demo "C:\path\to\workbook.xlsx"
 */

require("dotenv").config();

const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const { getCapturedLeadModel } = require("../models/CapturedLead");
const MatchedLead = require("../models/MatchedLead");
const { normalizePhone } = require("./phoneNormalize");
const { fetchGoogleSheetRows } = require("./remoteExcelSource");

const args = process.argv.slice(2);

const isDemo = args.includes("--demo");

const fileArg = args.find((arg) => !arg.startsWith("--"));

const filePath =
  fileArg ||
  path.join(
    __dirname,
    "..",
    "data",
    "sample-leads-export.xlsx"
  );

const mode = isDemo ? "demo" : "live";

const collectionName = isDemo
  ? "captured_leads_demo"
  : process.env.CAPTURED_LEADS_COLLECTION || "leads";

/**
 * Normalize the Excel source value.
 */
function normalizeSource(raw) {
  if (!raw) {
    return "Unknown/Blank";
  }

  const source = String(raw)
    .trim()
    .toLowerCase();

  const sourceMap = {
    app: "App",
    web: "Website",
    website: "Website",
    webinar: "Webinar",
    manual: "Manual",
    "tg lite": "TG Lite",
    csr: "CSR",
    mentor: "Mentor",
    "landing page": "Landing Page",
    commo: "Commodity",
    commodity: "Commodity",
  };

  return (
    sourceMap[source] ||
    String(raw).trim() ||
    "Unknown/Blank"
  );
}

/**
 * Convert the Excel stage into one of the dashboard statuses.
 */
function normalizeStage(rawStage, amountCollected) {
  const amount = Number(amountCollected || 0);

  if (!Number.isNaN(amount) && amount > 0) {
    return {
      status: "Paid",
      dropReason: "",
      note: `Amount collected: ₹${amount}`,
    };
  }

  if (!rawStage) {
    return {
      status: "New",
      dropReason: "",
      note: "",
    };
  }

  const stage = String(rawStage)
    .trim()
    .toLowerCase();

  if (
    [
      "unreachable",
      "unreacheable",
      "unrechebale",
      "hung up",
    ].includes(stage)
  ) {
    return {
      status: "Dropped",
      dropReason: "Unreachable / could not connect",
      note: "",
    };
  }

  if (
    [
      "ni",
      "nc",
      "ni loss cm",
      "band hai",
    ].includes(stage)
  ) {
    return {
      status: "Dropped",
      dropReason: "Not interested",
      note: "",
    };
  }

  if (
    [
      "contacted",
      "connected",
    ].includes(stage)
  ) {
    return {
      status: "Contacted",
      dropReason: "",
      note: "",
    };
  }

  if (stage === "fresh") {
    return {
      status: "New",
      dropReason: "",
      note: "",
    };
  }

  if (
    [
      "assigned",
      "allocated",
    ].includes(stage)
  ) {
    return {
      status: "Assigned",
      dropReason: "",
      note: "",
    };
  }

  if (
    [
      "in trial",
      "trial",
      "trial given",
      "trial completed",
    ].includes(stage)
  ) {
    return {
      status: "Trial Given",
      dropReason: "",
      note: "",
    };
  }

if (
  [
    "enrolled",
    "converted",
    "success",
  ].includes(stage)
) {
  return {
    status: "Contacted",
    dropReason: "",
    note: `Original Excel stage: "${rawStage}". Payment not confirmed in paid subscription sheet.`,
  };
}

  if (
    [
      "drop",
      "dropped",
      "lost",
      "closed lost",
    ].includes(stage)
  ) {
    return {
      status: "Dropped",
      dropReason: "Lead marked as dropped",
      note: "",
    };
  }

  return {
    status: "Follow-up",
    dropReason: "",
    note: `Unclassified original stage: "${rawStage}"`,
  };
}

/**
 * Safely convert a value into a JavaScript Date.
 */
function toDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? undefined
      : value;
  }

  if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value);

    if (excelDate) {
      return new Date(
        excelDate.y,
        excelDate.m - 1,
        excelDate.d,
        excelDate.H || 0,
        excelDate.M || 0,
        excelDate.S || 0
      );
    }
  }

  const text = String(value).trim();

  const dayFirst = text.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (dayFirst) {
    const [
      ,
      day,
      month,
      year,
      hour = "0",
      minute = "0",
      second = "0",
    ] = dayFirst;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    return Number.isNaN(date.getTime())
      ? undefined
      : date;
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime())
    ? undefined
    : date;
}

/**
 * Read the phone number from an Excel lead row.
 */
function getExcelPhone(row) {
  return normalizePhone(
    row["Phone"] ||
      row["phone"] ||
      row["Phone Number"] ||
      row["Mobile"] ||
      row["Mobile Number"] ||
      row["Contact Number"]
  );
}

/**
 * Read the phone number from a MongoDB captured lead.
 */
function getMongoPhone(doc) {
  return normalizePhone(
    doc.phone ||
      doc.phoneNumber ||
      doc.mobile ||
      doc.mobileNumber ||
      doc.contactNumber
  );
}

/**
 * Convert any value into a clean string.
 */
function cleanString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/**
 * Return the first non-empty value from a row.
 */
function firstValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

/**
 * Read the phone number from a payment-sheet row.
 */
function getPaymentPhone(row) {
  return normalizePhone(
    firstValue(row, [
      "Contact",
      "contact",
      "Phone",
      "phone",
      "Mobile",
      "Mobile Number",
      "Phone Number",
      "Contact Number",
      "Contact No",
      "Mobile No",
      "WhatsApp Number",
      "Whatsapp Number",
      "Student Phone",
      "Customer Phone",
    ])
  );
}

/**
 * Convert a payment amount into a number.
 */
function parseAmount(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const normalized = String(value)
    .replace(/[₹,\s]/g, "")
    .replace(/[^0-9.-]/g, "");

  const amount = Number(normalized);

  return Number.isFinite(amount)
    ? amount
    : 0;
}

/**
 * Read the paid amount from a payment-sheet row.
 */
function getPaymentAmount(row) {
  return parseAmount(
    firstValue(row, [
      "Count",
      "count",
      "Amount",
      "amount",
      "Paid Amount",
      "Payment Amount",
      "Amount Paid",
      "Fees",
      "Fee",
      "Total Amount",
      "Subscription Amount",
      "Amount Collected",
      "Amount Collected (₹)",
      "Net Amount",
      "Total",
      "Offer Amount",
    ])
  );
}

/**
 * Extract trial-journey information from one lead-sheet row.
 * Multiple heading variants are supported because the live sheet headings
 * may contain spaces or slightly different wording.
 */
function extractTrialInformation(row) {
  const trialStart = toDate(firstValue(row, [
    "Trial Start", "Trial Started", "Trial Start Date", "Trial Scheduled",
  ]));
  const trialDay1 = toDate(firstValue(row, ["Trial Day 1", "Trial Day1", "Day 1"]));
  const trialDay2 = toDate(firstValue(row, ["Trial Day 2", "Trial Day2", "Day 2"]));
  const trialDay3 = toDate(firstValue(row, ["Trial Day 3", "Trial Day3", "Day 3"]));
  const trialDay4 = toDate(firstValue(row, ["Trial Day 4", "Trial Day4", "Day 4"]));
  const trialExtendedUntil = toDate(firstValue(row, [
    "Extended Until", "Trial Extended Until", "Extended Till",
  ]));
  const trialCompletedAt = toDate(firstValue(row, [
    "Trial Completed", "Trial Completion", "Trial Completed At",
  ]));
  const trialStatus = cleanString(firstValue(row, [
    "Trial Status", "Trial Result", "Trial Outcome",
  ]));
  const trialReason = cleanString(firstValue(row, [
    "Reason", "Trial Reason", "Trial Drop Reason",
  ]));
  const trialConviction = cleanString(firstValue(row, [
    "Conviction", "Trial Conviction",
  ]));
  const trialFirstContact = toDate(firstValue(row, [
    "First Contact", "First Contact Date",
  ]));
  const trialCallTimestamps = cleanString(firstValue(row, [
    "Call Timestamps", "Call Timestamp",
  ]));
  const trialUnreachableTry = Number(firstValue(row, [
    "Unreachable Try", "Unreachable Tries", "Unreachable Attempt",
  ]) || 0) || 0;

  const normalizedStage = cleanString(row?.Stage).toLowerCase();
  const stageShowsTrial = [
    "in trial", "trial", "trial given", "trial completed",
  ].includes(normalizedStage);

  const hasTrial = Boolean(
    stageShowsTrial || trialStart || trialDay1 || trialDay2 || trialDay3 ||
    trialDay4 || trialExtendedUntil || trialCompletedAt || trialStatus ||
    trialReason || trialConviction
  );

  return {
    hasTrial,
    trialStart,
    trialDay1,
    trialDay2,
    trialDay3,
    trialDay4,
    trialExtendedUntil,
    trialCompletedAt,
    trialStatus: trialStatus || (stageShowsTrial ? cleanString(row?.Stage) : ""),
    trialReason,
    trialConviction,
    trialFirstContact,
    trialCallTimestamps,
    trialUnreachableTry,
    trialRawRow: hasTrial ? row : null,
  };
}

/**
 * Combine all payment rows belonging to one phone number.
 */
function summarizePayments(rows) {
  if (!rows || !rows.length) {
    return {
      isConverted: false,
      paymentAmount: 0,
      paymentDate: undefined,
      paymentStudentName: "",
      paymentCourse: "",
      paymentPlan: "",
      paymentStatus: "",
      paymentTransactionId: "",
      paymentTransactionCount: 0,
      paymentRawRow: null,
    };
  }

  let total = 0;
  let latestDate;
  let latestRow = rows[rows.length - 1];

  for (const row of rows) {
    total += getPaymentAmount(row);

    const date = toDate(
      firstValue(row, [
        "Payment Date",
        "Paid Date",
        "Date",
        "Subscription Date",
        "Transaction Date",
        "Created At",
        "Payment Time",
      ])
    );

    if (date && (!latestDate || date > latestDate)) {
      latestDate = date;
      latestRow = row;
    }
  }

  return {
    isConverted: true,

    paymentAmount: total,

    paymentDate: latestDate,

    paymentStudentName: cleanString(
      firstValue(latestRow, [
        "Student Name",
        "Customer Name",
        "Name",
        "Full Name",
        "Learner Name",
      ])
    ),

    paymentCourse: cleanString(
      firstValue(latestRow, [
        "Course",
        "Course Name",
        "Product",
        "Product Name",
        "Subscription",
      ])
    ),

    paymentPlan: cleanString(
      firstValue(latestRow, [
        "Month",
        "Plan",
        "Subscription Plan",
        "Package",
        "Batch",
        "Duration",
      ])
    ),

    paymentStatus:
      cleanString(
        firstValue(latestRow, [
          "Payment Status",
          "Status",
          "Transaction Status",
        ])
      ) || "Paid",

    paymentTransactionId: cleanString(
      firstValue(latestRow, [
        "Conversation ID",
        "Conversation Id",
        "Transaction ID",
        "Transaction Id",
        "Payment ID",
        "Payment Id",
        "Order ID",
        "Order Id",
        "Receipt ID",
        "Receipt No",
      ])
    ),

    paymentTransactionCount: rows.length,

    paymentRawRow: latestRow,
  };
}

/**
 * Supports both MongoDB submission formats:
 *
 * 1. Old format:
 *    UTM values stored directly on the document.
 *
 * 2. New format:
 *    UTM values stored inside the touchpoints array.
 */
function getLeadAttribution(doc) {
  const touchpoints = Array.isArray(doc.touchpoints)
    ? doc.touchpoints.filter(Boolean)
    : [];

  /*
   * Do not sort the original Mongoose document array.
   * Create a copied array before sorting.
   */
  const latestTouchpoint = [...touchpoints].sort(
    (first, second) => {
      const firstDate =
        toDate(first?.capturedAt)?.getTime() || 0;

      const secondDate =
        toDate(second?.capturedAt)?.getTime() || 0;

      return secondDate - firstDate;
    }
  )[0];

  return {
    source: cleanString(
      doc.source ||
        latestTouchpoint?.platform ||
        latestTouchpoint?.sourceType ||
        doc.utmSource
    ),

    utmSource: cleanString(
      doc.utmSource ||
        latestTouchpoint?.utmSource
    ),

    utmMedium: cleanString(
      doc.utmMedium ||
        latestTouchpoint?.utmMedium
    ),

    utmCampaign: cleanString(
      doc.utmCampaign ||
        latestTouchpoint?.utmCampaign
    ),

    utmContent: cleanString(
      doc.utmContent ||
        latestTouchpoint?.utmContent
    ),

    utmTerm: cleanString(
      doc.utmTerm ||
        latestTouchpoint?.utmTerm
    ),

    capturedAt:
      toDate(doc.capturedAt) ||
      toDate(doc.createdAt) ||
      toDate(doc.submittedAt) ||
      toDate(doc.firstTouchAt) ||
      toDate(latestTouchpoint?.capturedAt),

    platform: cleanString(
      latestTouchpoint?.platform
    ),

    sourceType: cleanString(
      latestTouchpoint?.sourceType
    ),

    utmId: cleanString(
      doc.utmId ||
        latestTouchpoint?.utmId
    ),

    gclid: cleanString(
      doc.gclid ||
        latestTouchpoint?.gclid
    ),

    fbclid: cleanString(
      doc.fbclid ||
        latestTouchpoint?.fbclid
    ),

    landingPage:
      latestTouchpoint?.landingPage ||
      doc.landingPage ||
      null,
  };
}

async function run(options = {}) {
  const {
    filePath: filePathOverride,
    mode: modeOverride,

    /*
     * Set this to false when called by the running server,
     * because the server already holds the MongoDB connection.
     */
    manageConnection = true,
  } = options;

  const effectiveFilePath =
    filePathOverride || filePath;

  const effectiveMode =
    modeOverride || mode;

  const effectiveCollectionName =
    effectiveMode === "demo"
      ? "captured_leads_demo"
      : process.env.CAPTURED_LEADS_COLLECTION ||
        "leads";

  if (manageConnection) {
    await connectDB();
  }

  const CapturedLead =
    getCapturedLeadModel(effectiveCollectionName);

  console.log(`Mode: ${effectiveMode}`);

  console.log(
    `Reading captured leads from MongoDB collection: "${effectiveCollectionName}"`
  );

  /*
   * Latest MongoDB submission comes first.
   * If the same phone appears multiple times,
   * only the latest document is used.
   */
  const capturedLeads = await CapturedLead.find({})
    .sort({
      createdAt: -1,
      lastTouchAt: -1,
      firstTouchAt: -1,
      _id: -1,
    })
    .lean();

  console.log(
    `Found ${capturedLeads.length} documents in that collection.`
  );

  const sourceType = String(
    options.sourceType ||
      process.env.EXCEL_SOURCE_TYPE ||
      "local"
  ).toLowerCase();

  let excelRows;
  let sourceDescription;

  if (sourceType === "google_sheet") {
    const googleSheetUrl =
      options.googleSheetUrl ||
      process.env.GOOGLE_SHEET_URL;

    if (!googleSheetUrl) {
      throw new Error(
        "GOOGLE_SHEET_URL is required when EXCEL_SOURCE_TYPE=google_sheet."
      );
    }

    sourceDescription = googleSheetUrl;

    console.log(
      `Fetching current rows from Google Sheet: ${googleSheetUrl}`
    );

    excelRows =
      await fetchGoogleSheetRows(googleSheetUrl);
  } else {
    sourceDescription = effectiveFilePath;

    console.log(
      `Reading Excel workbook: ${effectiveFilePath}`
    );

    const workbook = XLSX.readFile(
      effectiveFilePath,
      {
        cellDates: true,
      }
    );

    const sheetName =
      workbook.SheetNames.includes("Leads")
        ? "Leads"
        : workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error(
        "No worksheet was found in the Excel workbook."
      );
    }

    excelRows = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      {
        defval: null,
        raw: false,
      }
    );
  }

  if (!Array.isArray(excelRows)) {
    throw new Error(
      "Lead sheet data could not be read as an array."
    );
  }

  console.log(
    `Found ${excelRows.length} rows in the Excel Leads tab.`
  );

  /*
   * Optional second Google Sheet containing
   * successful subscription payments.
   */
  const paymentSheetUrl =
    options.paymentGoogleSheetUrl ||
    process.env.PAYMENT_GOOGLE_SHEET_URL;

  let paymentRows = [];

  if (paymentSheetUrl) {
    console.log(
      `Fetching paid subscription rows from Google Sheet: ${paymentSheetUrl}`
    );

    paymentRows =
      await fetchGoogleSheetRows(paymentSheetUrl);

    if (!Array.isArray(paymentRows)) {
      throw new Error(
        "Paid subscription sheet data could not be read as an array."
      );
    }

    console.log(
      `Found ${paymentRows.length} rows in the paid subscription sheet.`
    );

    if (paymentRows[0]) {
      console.log(
        `Paid sheet columns: ${Object.keys(
          paymentRows[0]
        ).join(", ")}`
      );
    }
  } else {
    console.log(
      "Paid subscription sheet is not configured; conversion data will be empty."
    );
  }

  /*
   * Build payment phone -> payment rows lookup.
   *
   * One phone may have multiple payment transactions,
   * so each phone maps to an array.
   */
  const paymentByPhone = new Map();

  let paymentSkippedNoPhone = 0;

  for (const row of paymentRows) {
    const paymentPhone =
      getPaymentPhone(row);

    if (!paymentPhone) {
      paymentSkippedNoPhone++;
      continue;
    }

    const existingRows =
      paymentByPhone.get(paymentPhone) || [];

    existingRows.push(row);

    paymentByPhone.set(
      paymentPhone,
      existingRows
    );
  }

  /*
   * Build phone -> Excel lead row lookup.
   *
   * The last Excel row wins when the same phone
   * number appears multiple times.
   */
  const excelByPhone = new Map();

  let excelSkippedNoPhone = 0;

  for (const row of excelRows) {
    const phone = getExcelPhone(row);

    if (!phone) {
      excelSkippedNoPhone++;
      continue;
    }

    excelByPhone.set(phone, row);
  }

  /*
   * Track MongoDB phones already processed.
   *
   * Since the captured leads are sorted newest first,
   * only the latest MongoDB submission for each phone
   * will be used.
   */
  const processedMongoPhones = new Set();

  let matched = 0;
  let mongoSkippedNoPhone = 0;
  let mongoNoExcelMatch = 0;
  let duplicateMongoPhonesSkipped = 0;
  let errors = 0;

  const bulkOps = [];
  const currentMatchedPhones = [];

  for (const doc of capturedLeads) {
    const phone = getMongoPhone(doc);

    if (!phone) {
      mongoSkippedNoPhone++;
      continue;
    }

    if (processedMongoPhones.has(phone)) {
      duplicateMongoPhonesSkipped++;
      continue;
    }

    processedMongoPhones.add(phone);

    const excelRow = excelByPhone.get(phone);

    if (!excelRow) {
      mongoNoExcelMatch++;
      continue;
    }

    /*
     * Read source and UTM information from either:
     *
     * 1. Root-level MongoDB fields
     * 2. The latest touchpoint in touchpoints[]
     */
    const attribution =
      getLeadAttribution(doc);

    try {
      const {
        status,
        dropReason,
        note,
      } = normalizeStage(
        excelRow["Stage"],
        excelRow["Amount Collected (₹)"]
      );

      const excelLostReason = cleanString(
        excelRow["Lost Reason"] ||
          excelRow["Drop Reason"]
      );

      const finalDropReason =
        excelLostReason ||
        dropReason ||
        "";

      const payment = summarizePayments(
        paymentByPhone.get(phone)
      );

      const trial = extractTrialInformation(excelRow);

      const finalStatus =
        payment.isConverted
          ? "Paid"
          : status;

      const merged = {
        phone,
        mode: effectiveMode,

        mongoSubmissionId: doc._id,

        fullName:
          cleanString(doc.fullName) ||
          cleanString(doc.name) ||
          cleanString(
            excelRow["Customer Name"]
          ),

        email: cleanString(
          doc.email ||
            doc.emailAddress
        ),

        /*
         * Source information supports both MongoDB schemas.
         */
        source: attribution.source,

        utmSource:
          attribution.utmSource,

        utmMedium:
          attribution.utmMedium,

        utmCampaign:
          attribution.utmCampaign,

        utmContent:
          attribution.utmContent,

        utmTerm:
          attribution.utmTerm,

        capturedAt:
          attribution.capturedAt,

        /*
         * Additional attribution fields available
         * in the touchpoints schema.
         */
        platform:
          attribution.platform,

        sourceType:
          attribution.sourceType,

        utmId:
          attribution.utmId,

        gclid:
          attribution.gclid,

        fbclid:
          attribution.fbclid,

        landingPage:
          attribution.landingPage,

        excelUserid: cleanString(
          excelRow["Userid"] ||
            excelRow["User ID"]
        ),

        excelCustomerName: cleanString(
          excelRow["Customer Name"] ||
            excelRow["Name"]
        ),

        excelSource: normalizeSource(
          excelRow["Source"]
        ),

        excelLeadType: cleanString(
          excelRow["Type"] ||
            excelRow["Lead Type"]
        ),

        excelStage:
          finalStatus,

        excelRawStage: cleanString(
          excelRow["Stage"]
        ),

        excelDropReason:
          finalDropReason,

        excelAgent: cleanString(
          excelRow["Agent"] ||
            excelRow["Assigned Agent"]
        ),

        excelGroupLeader: cleanString(
          excelRow["Group Leader"]
        ),

        excelLastFeedback: cleanString(
          excelRow[
            "Last Feedback  (one line)"
          ] ||
            excelRow[
              "Last Feedback (one line)"
            ] ||
            excelRow["Last Feedback"] ||
            excelRow["Feedback"]
        ),

        excelLostReason:
          excelLostReason,

        excelLeadDate: toDate(
          excelRow["Lead Date"]
        ),

        excelAmountCollected:
          parseAmount(
            excelRow[
              "Amount Collected (₹)"
            ]
          ),

        /* Trial journey information from the live lead sheet. */
        hasTrial: trial.hasTrial,
        trialStart: trial.trialStart,
        trialDay1: trial.trialDay1,
        trialDay2: trial.trialDay2,
        trialDay3: trial.trialDay3,
        trialDay4: trial.trialDay4,
        trialExtendedUntil: trial.trialExtendedUntil,
        trialCompletedAt: trial.trialCompletedAt,
        trialStatus: trial.trialStatus,
        trialReason: trial.trialReason,
        trialConviction: trial.trialConviction,
        trialFirstContact: trial.trialFirstContact,
        trialCallTimestamps: trial.trialCallTimestamps,
        trialUnreachableTry: trial.trialUnreachableTry,
        trialRawRow: trial.trialRawRow,

        /*
         * Payment and conversion information.
         */
        isConverted:
          payment.isConverted,

        paymentAmount:
          payment.paymentAmount,

        paymentDate:
          payment.paymentDate,

        paymentStudentName:
          payment.paymentStudentName,

        paymentCourse:
          payment.paymentCourse,

        paymentPlan:
          payment.paymentPlan,

        paymentStatus:
          payment.paymentStatus,

        paymentTransactionId:
          payment.paymentTransactionId,

        paymentTransactionCount:
          payment.paymentTransactionCount,

        paymentRawRow:
          payment.paymentRawRow,

        matchNote: payment.isConverted
          ? `${
              note
                ? `${note}; `
                : ""
            }Converted from paid subscription sheet`
          : note,

        matchedAt: new Date(),
      };

      currentMatchedPhones.push(phone);

      bulkOps.push({
        updateOne: {
          filter: {
            phone,
            mode: effectiveMode,
          },

          update: {
            $set: merged,
          },

          upsert: true,
        },
      });

      matched++;
    } catch (error) {
      errors++;

      console.error(
        `Row error for phone ${phone}:`,
        error.message
      );
    }
  }

  /*
   * Remove stale records.
   *
   * A stale record is a document that previously existed
   * in matched_leads but is no longer present in the latest
   * MongoDB + Google Sheet matching result.
   */
  let deleteResult;

  if (currentMatchedPhones.length === 0) {
    /*
     * When no current matches exist, remove all records
     * belonging to the current mode.
     */
    deleteResult =
      await MatchedLead.deleteMany({
        mode: effectiveMode,
      });
  } else {
    deleteResult =
      await MatchedLead.deleteMany({
        mode: effectiveMode,

        phone: {
          $nin: currentMatchedPhones,
        },
      });
  }

  /*
   * Insert new matches and update existing matches.
   */
  let bulkResult = null;

  if (bulkOps.length > 0) {
    bulkResult =
      await MatchedLead.bulkWrite(
        bulkOps,
        {
          ordered: false,
        }
      );
  }

  const convertedMatchedLeads =
    currentMatchedPhones.filter(
      (phone) =>
        paymentByPhone.has(phone)
    ).length;

  console.log(
    "\n--- Match summary ---"
  );

  console.log(
    `Captured leads read from MongoDB:            ${capturedLeads.length}`
  );

  console.log(
    `Excel rows read:                             ${excelRows.length} (skipped ${excelSkippedNoPhone} with no usable phone)`
  );

  console.log(
    `Matched on phone (present on BOTH sides):    ${matched}`
  );

  console.log(
    `Mongo docs skipped — no usable phone:        ${mongoSkippedNoPhone}`
  );

  console.log(
    `Duplicate Mongo phones skipped:              ${duplicateMongoPhonesSkipped}`
  );

  console.log(
    `Mongo docs with NO Excel match (excluded):   ${mongoNoExcelMatch}`
  );

  console.log(
    `Old stale matched records deleted:           ${deleteResult.deletedCount}`
  );

  console.log(
    `Paid subscription rows read:                 ${paymentRows.length} (skipped ${paymentSkippedNoPhone} with no usable phone)`
  );

  console.log(
    `Converted matched leads:                     ${convertedMatchedLeads}`
  );

  console.log(
    `Errors:                                      ${errors}`
  );

  if (bulkResult) {
    console.log(
      `Matched records inserted:                   ${
        bulkResult.upsertedCount || 0
      }`
    );

    console.log(
      `Matched records updated:                    ${
        bulkResult.modifiedCount || 0
      }`
    );
  }

  console.log(
    `\nSaved ${matched} current matched record(s) into the "matched_leads" collection (mode="${effectiveMode}").`
  );

  if (manageConnection) {
    await mongoose.disconnect();
  }

  return {
    mode: effectiveMode,
    sourceType,
    source: sourceDescription,
    capturedLeadsRead: capturedLeads.length,
    excelRowsRead: excelRows.length,
    paymentRowsRead: paymentRows.length,
    converted: currentMatchedPhones.filter(
      (phone) => paymentByPhone.has(phone)
    ).length,
    matched,
    mongoSkippedNoPhone,
    duplicateMongoPhonesSkipped,
    mongoNoExcelMatch,
    staleRecordsDeleted: deleteResult.deletedCount,
    errors,
    syncedAt: new Date(),
  };
}

if (require.main === module) {
  run()
    .then(() => {
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(
        "Match failed:",
        error.message
      );

      try {
        await mongoose.disconnect();
      } catch {
        // Ignore disconnect errors.
      }

      process.exit(1);
    });
}

module.exports = { run };