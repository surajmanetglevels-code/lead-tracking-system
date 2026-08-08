const mongoose = require("mongoose");
const MatchedLead = require("../models/MatchedLead");

const STATUS_STAGES = [
  "New",
  "Assigned",
  "Contacted",
  "Follow-up",
  "Trial Given",
  "Paid",
  "Dropped",
];

function mapMatchedLead(doc) {
  return {
    _id: doc._id,

    leadId: doc._id.toString(),

    name:
      doc.fullName ||
      doc.excelCustomerName ||
      "Unknown Lead",

    phone: doc.phone || "",

    email: doc.email || "",

source:
  doc.utmSource ||
  doc.source ||
  doc.excelSource ||
  "Unknown",

captureSource:
  doc.utmSource ||
  doc.source ||
  doc.excelSource ||
  "Unknown",

    campaign:
      doc.utmCampaign || "",

    landingPageUrl: "",

    leadType:
      doc.excelLeadType || "",

    excelCustomerName:
      doc.excelCustomerName || "",

    excelSource:
      doc.excelSource || "",

    excelLeadDate:
      doc.excelLeadDate || null,

    currentStatus:
      doc.excelStage || "New",

    rawStage:
      doc.excelRawStage || "",

    dropReason:
      doc.excelLostReason ||
      doc.excelDropReason ||
      "",

    assignedAgent: null,

    assignedAgentName:
      doc.excelAgent || "",

    groupLeader:
      doc.excelGroupLeader || "",

    feedback:
      doc.excelLastFeedback || "",

    amountCollected:
      Number(doc.excelAmountCollected || 0),

    utmSource:
      doc.utmSource || "",

    utmMedium:
      doc.utmMedium || "",

    utmCampaign:
      doc.utmCampaign || "",

    utmContent:
      doc.utmContent || "",

    utmTerm:
      doc.utmTerm || "",

    capturedAt:
      doc.capturedAt || null,

    createdAt:
      doc.capturedAt ||
      doc.excelLeadDate ||
      doc.createdAt,

    updatedAt:
      doc.updatedAt,

    // Payment / conversion fields
    isConverted:
      Boolean(doc.isConverted),

    paymentAmount:
      Number(doc.paymentAmount || 0),

    paymentDate:
      doc.paymentDate || null,

    paymentStudentName:
      doc.paymentStudentName || "",

    paymentCourse:
      doc.paymentCourse || "",

    paymentPlan:
      doc.paymentPlan || "",

    paymentStatus:
      doc.paymentStatus || "",

    paymentTransactionId:
      doc.paymentTransactionId || "",

    paymentTransactionCount:
      Number(
        doc.paymentTransactionCount || 0
      ),

    history: [
      {
        status:
          doc.excelStage || "New",

        reason:
          doc.excelLostReason ||
          doc.excelDropReason ||
          "",

        note:
          doc.excelLastFeedback || "",

        agentName:
          doc.excelAgent || "",

        changedAt:
          doc.excelLeadDate ||
          doc.updatedAt ||
          doc.createdAt,
      },
    ],
  };
}

// POST /api/leads
// Matched leads should only be created by the matching script.
async function createLead(req, res) {
  return res.status(405).json({
    message:
      "Leads are created only after matching MongoDB submissions with Excel phone numbers.",
  });
}

// GET /api/leads
async function listLeads(req, res) {
  try {
    const {
      source,
      status,
      agent,
      from,
      to,
      q,
      page = 1,
      limit = 25,
    } = req.query;

    const filter = {
      mode: "live",
    };

    if (source) {
      filter.$or = [
        {
          utmSource: {
            $regex: `^${source}$`,
            $options: "i",
          },
        },
        {
          source: {
            $regex: `^${source}$`,
            $options: "i",
          },
        },
        {
          excelSource: {
            $regex: `^${source}$`,
            $options: "i",
          },
        },
      ];
    }

    if (status) {
      filter.excelStage = status;
    }

    if (agent) {
      filter.excelAgent = {
        $regex: `^${agent}$`,
        $options: "i",
      };
    }

    if (from || to) {
      filter.capturedAt = {};

      if (from) {
        filter.capturedAt.$gte =
          new Date(from);
      }

      if (to) {
        const endDate = new Date(to);

        endDate.setHours(
          23,
          59,
          59,
          999
        );

        filter.capturedAt.$lte =
          endDate;
      }
    }

    if (q) {
      const searchConditions = [
        {
          fullName: {
            $regex: q,
            $options: "i",
          },
        },
        {
          excelCustomerName: {
            $regex: q,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: q,
            $options: "i",
          },
        },
      ];

      if (filter.$or) {
        filter.$and = [
          {
            $or: filter.$or,
          },
          {
            $or: searchConditions,
          },
        ];

        delete filter.$or;
      } else {
        filter.$or =
          searchConditions;
      }
    }

    const pageNumber =
      Math.max(Number(page), 1);

    const limitNumber =
      Math.min(
        Math.max(Number(limit), 1),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const [documents, total] =
      await Promise.all([
        MatchedLead.find(filter)
          .sort({
            capturedAt: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        MatchedLead.countDocuments(
          filter
        ),
      ]);

    const items =
      documents.map(mapMatchedLead);

    return res.json({
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (error) {
    console.error(
      "List matched leads error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load matched leads",
    });
  }
}

// GET /api/leads/:id
async function getLead(req, res) {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message: "Invalid lead ID",
      });
    }

    const document =
      await MatchedLead.findOne({
        _id: req.params.id,
        mode: "live",
      }).lean();

    if (!document) {
      return res.status(404).json({
        message: "Matched lead not found",
      });
    }

    return res.json(
      mapMatchedLead(document)
    );
  } catch (error) {
    console.error(
      "Get matched lead error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load matched lead",
    });
  }
}

// PATCH /api/leads/:id/assign
async function assignLead(req, res) {
  try {
    const {
      agentName,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message: "Invalid lead ID",
      });
    }

    const document =
      await MatchedLead.findOneAndUpdate(
        {
          _id: req.params.id,
          mode: "live",
        },
        {
          $set: {
            excelAgent:
              agentName || "",
            excelStage: "Assigned",
          },
        },
        {
          new: true,
        }
      ).lean();

    if (!document) {
      return res.status(404).json({
        message: "Matched lead not found",
      });
    }

    return res.json(
      mapMatchedLead(document)
    );
  } catch (error) {
    console.error(
      "Assign matched lead error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to assign matched lead",
    });
  }
}

// PATCH /api/leads/:id/status
async function updateStatus(req, res) {
  try {
    const {
      status,
      reason,
      note,
      agentName,
    } = req.body;

    if (
      !STATUS_STAGES.includes(status)
    ) {
      return res.status(400).json({
        message: `status must be one of: ${STATUS_STAGES.join(
          ", "
        )}`,
      });
    }

    if (
      status === "Dropped" &&
      !reason
    ) {
      return res.status(400).json({
        message:
          "reason is required when status is Dropped",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message: "Invalid lead ID",
      });
    }

    const update = {
      excelStage: status,
      excelRawStage: status,
    };

    if (reason !== undefined) {
      update.excelDropReason =
        reason || "";

      update.excelLostReason =
        reason || "";
    }

    if (note !== undefined) {
      update.excelLastFeedback =
        note || "";
    }

    if (agentName !== undefined) {
      update.excelAgent =
        agentName || "";
    }

    const document =
      await MatchedLead.findOneAndUpdate(
        {
          _id: req.params.id,
          mode: "live",
        },
        {
          $set: update,
        },
        {
          new: true,
        }
      ).lean();

    if (!document) {
      return res.status(404).json({
        message: "Matched lead not found",
      });
    }

    return res.json(
      mapMatchedLead(document)
    );
  } catch (error) {
    console.error(
      "Update matched lead status error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to update matched lead",
    });
  }
}

module.exports = {
  createLead,
  listLeads,
  getLead,
  assignLead,
  updateStatus,
  STATUS_STAGES,
};