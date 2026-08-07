const MatchedLead = require("../models/MatchedLead");

function safeString(expression, fallback = "") {
  return {
    $convert: {
      input: { $ifNull: [expression, fallback] },
      to: "string",
      onError: fallback,
      onNull: fallback,
    },
  };
}

function normalizedText(expression, fallback = "") {
  return { $toLower: { $trim: { input: safeString(expression, fallback) } } };
}

function buildFilter(from, to) {
  const filter = { mode: "live" };
  if (!from && !to) return filter;

  const range = {};
  if (from) {
    const d = new Date(`${from}T00:00:00.000`);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.$lte = d;
  }
  if (!Object.keys(range).length) return filter;

  filter.$or = [
    { excelLeadDate: range },
    {
      $and: [
        { $or: [{ excelLeadDate: { $exists: false } }, { excelLeadDate: null }] },
        { capturedAt: range },
      ],
    },
  ];
  return filter;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceMatch(source) {
  if (!source) return null;
  return { $regex: new RegExp(`^${escapeRegex(source.trim())}$`, "i") };
}

async function overview(req, res, next) {
  try {
    const filter = buildFilter(req.query.from, req.query.to);
    const [result] = await MatchedLead.aggregate([
      { $match: filter },
      {
        $project: {
          stage: normalizedText("$excelStage", "new"),
          converted: { $eq: ["$isConverted", true] },
          amount: { $ifNull: ["$paymentAmount", 0] },
        },
      },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          paid: { $sum: { $cond: ["$converted", 1, 0] } },
          dropped: { $sum: { $cond: [{ $eq: ["$stage", "dropped"] }, 1, 0] } },
          trialGiven: {
            $sum: {
              $cond: [
                { $in: ["$stage", ["trial", "trial given", "trial_given", "trial-given"]] },
                1,
                0,
              ],
            },
          },
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const data = result || {
      totalLeads: 0,
      paid: 0,
      dropped: 0,
      trialGiven: 0,
      totalRevenue: 0,
    };

    const conversionRate = data.totalLeads
      ? Number(((data.paid / data.totalLeads) * 100).toFixed(2))
      : 0;
    const dropRate = data.totalLeads
      ? Number(((data.dropped / data.totalLeads) * 100).toFixed(2))
      : 0;
    const averageTicket = data.paid
      ? Number((data.totalRevenue / data.paid).toFixed(2))
      : 0;

    return res.json({
      totalLeads: data.totalLeads,
      paid: data.paid,
      dropped: data.dropped,
      trialGiven: data.trialGiven,
      totalRevenue: data.totalRevenue,
      averageTicket,
      conversionRate,
      dropRate,
      statusBreakdown: {
        Paid: data.paid,
        Dropped: data.dropped,
        "Trial Given": data.trialGiven,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function bySource(req, res, next) {
  try {
    const filter = buildFilter(req.query.from, req.query.to);
    const data = await MatchedLead.aggregate([
      { $match: filter },
      {
        $project: {
          source: normalizedText({ $ifNull: ["$utmSource", "$source"] }, "unknown"),
          converted: { $eq: ["$isConverted", true] },
          amount: { $ifNull: ["$paymentAmount", 0] },
        },
      },
      {
        $group: {
          _id: "$source",
          total: { $sum: 1 },
          paid: { $sum: { $cond: ["$converted", 1, 0] } },
          revenue: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          source: { $cond: [{ $eq: ["$_id", ""] }, "unknown", "$_id"] },
          total: 1,
          paid: 1,
          revenue: 1,
          conversionRate: {
            $cond: [
              { $eq: ["$total", 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ["$paid", "$total"] }, 100] }, 2] },
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);
    return res.json(data);
  } catch (error) {
    next(error);
  }
}

async function funnel(req, res, next) {
  try {
    const filter = buildFilter(req.query.from, req.query.to);
    const sf = sourceMatch(req.query.source);
    if (sf) filter.utmSource = sf;

    const data = await MatchedLead.aggregate([
      { $match: filter },
      {
        $project: {
          source: normalizedText({ $ifNull: ["$utmSource", "$source"] }, "unknown"),
          status: {
            $cond: [
              { $eq: ["$isConverted", true] },
              "paid",
              normalizedText("$excelStage", "new"),
            ],
          },
        },
      },
      { $group: { _id: { source: "$source", status: "$status" }, count: { $sum: 1 } } },
      { $group: { _id: "$_id.source", stages: { $push: { status: "$_id.status", count: "$count" } } } },
      {
        $project: {
          _id: 0,
          source: "$_id",
          stages: {
            $map: {
              input: "$stages",
              as: "s",
              in: {
                status: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$$s.status", "new"] }, then: "New" },
                      { case: { $eq: ["$$s.status", "assigned"] }, then: "Assigned" },
                      { case: { $eq: ["$$s.status", "contacted"] }, then: "Contacted" },
                      { case: { $in: ["$$s.status", ["follow up", "follow-up", "follow_up", "followup"]] }, then: "Follow-up" },
                      { case: { $in: ["$$s.status", ["trial", "trial given", "trial-given", "trial_given"]] }, then: "Trial Given" },
                      { case: { $eq: ["$$s.status", "paid"] }, then: "Paid" },
                      { case: { $eq: ["$$s.status", "dropped"] }, then: "Dropped" },
                    ],
                    default: "$$s.status",
                  },
                },
                count: "$$s.count",
              },
            },
          },
        },
      },
      { $sort: { source: 1 } },
    ]);
    return res.json(data);
  } catch (error) {
    next(error);
  }
}

async function dropReasons(req, res, next) {
  try {
    const filter = buildFilter(req.query.from, req.query.to);
    const sf = sourceMatch(req.query.source);
    if (sf) filter.utmSource = sf;

    const data = await MatchedLead.aggregate([
      { $match: filter },
      {
        $project: {
          source: normalizedText({ $ifNull: ["$utmSource", "$source"] }, "unknown"),
          stage: normalizedText("$excelStage", ""),
          reason: {
            $trim: {
              input: safeString(
                { $ifNull: ["$excelDropReason", { $ifNull: ["$excelLostReason", "$excelLastFeedback"] }] },
                ""
              ),
            },
          },
        },
      },
      { $match: { stage: "dropped" } },
      { $project: { source: 1, reason: { $cond: [{ $eq: ["$reason", ""] }, "Not specified", "$reason"] } } },
      { $group: { _id: { source: "$source", reason: "$reason" }, count: { $sum: 1 } } },
      { $project: { _id: 0, source: "$_id.source", reason: "$_id.reason", count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return res.json(data);
  } catch (error) {
    next(error);
  }
}

async function agentPerformance(req, res, next) {
  try {
    const filter = buildFilter(req.query.from, req.query.to);
    const data = await MatchedLead.aggregate([
      { $match: filter },
      {
        $project: {
          agent: { $trim: { input: safeString("$excelAgent", "") } },
          stage: normalizedText("$excelStage", ""),
          converted: { $eq: ["$isConverted", true] },
          amount: { $ifNull: ["$paymentAmount", 0] },
        },
      },
      { $project: { agent: { $cond: [{ $eq: ["$agent", ""] }, "Unassigned", "$agent"] }, stage: 1, converted: 1, amount: 1 } },
      {
        $group: {
          _id: "$agent",
          totalAssigned: { $sum: 1 },
          paid: { $sum: { $cond: ["$converted", 1, 0] } },
          dropped: { $sum: { $cond: [{ $eq: ["$stage", "dropped"] }, 1, 0] } },
          revenue: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          agent: "$_id",
          totalAssigned: 1,
          paid: 1,
          dropped: 1,
          revenue: 1,
          conversionRate: {
            $cond: [
              { $eq: ["$totalAssigned", 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ["$paid", "$totalAssigned"] }, 100] }, 2] },
            ],
          },
        },
      },
      { $sort: { totalAssigned: -1, agent: 1 } },
    ]);
    return res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = { overview, bySource, funnel, dropReasons, agentPerformance };
