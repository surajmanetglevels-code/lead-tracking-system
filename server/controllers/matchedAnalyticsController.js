const MatchedLead = require("../models/MatchedLead");

function buildFilter(req) {
  const mode =
    req.query.mode === "demo"
      ? "demo"
      : "live";

  const filter = { mode };

  if (req.query.utmSource) {
    filter.utmSource =
      req.query.utmSource;
  }

  if (req.query.from || req.query.to) {
    filter.capturedAt = {};

    if (req.query.from) {
      filter.capturedAt.$gte =
        new Date(req.query.from);
    }

    if (req.query.to) {
      const toDate =
        new Date(req.query.to);

      toDate.setHours(
        23,
        59,
        59,
        999
      );

      filter.capturedAt.$lte =
        toDate;
    }
  }

  return filter;
}

function cleanMatchedSourceExpression() {
  return {
    $let: {
      vars: {
        rawSource: {
          $toLower: {
            $trim: {
              input: {
                $convert: {
                  input: {
                    $ifNull: ["$utmSource", ""],
                  },
                  to: "string",
                  onError: "",
                  onNull: "",
                },
              },
            },
          },
        },
      },

      in: {
        $cond: [
          {
            $or: [
              { $eq: ["$$rawSource", ""] },
              { $eq: ["$$rawSource", "legacy"] },

              {
                $regexMatch: {
                  input: "$$rawSource",
                  regex: /^[0-9]+$/,
                },
              },
            ],
          },

          "unknown",

          "$$rawSource",
        ],
      },
    },
  };
}

/**
 * A genuine trial journey is a lead that:
 * - currently has the normalized stage "Trial Given", or
 * - has at least one real trial date.
 *
 * This preserves historical trial activity even when the
 * lead's current stage later changes to Contacted, Paid, etc.
 */
function buildGenuineTrialFilter(req) {
  return {
    ...buildFilter(req),

    $or: [
      {
        excelStage: "Trial Given",
      },
      {
        trialStart: {
          $type: "date",
        },
      },
      {
        trialDay1: {
          $type: "date",
        },
      },
      {
        trialDay2: {
          $type: "date",
        },
      },
      {
        trialDay3: {
          $type: "date",
        },
      },
      {
        trialCompletedAt: {
          $type: "date",
        },
      },
      {
        trialExtendedUntil: {
          $type: "date",
        },
      },
    ],
  };
}

// GET /api/matched/analytics/overview?mode=live|demo
async function overview(req, res) {
  try {
    const filter =
      buildFilter(req);

    const [total, byStage] =
      await Promise.all([
        MatchedLead.countDocuments(
          filter
        ),

        MatchedLead.aggregate([
          {
            $match: filter,
          },
          {
            $group: {
              _id: "$excelStage",
              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

    const stageMap =
      Object.fromEntries(
        byStage.map((stage) => [
          stage._id,
          stage.count,
        ])
      );

    const paid =
      stageMap.Paid || 0;

    const dropped =
      stageMap.Dropped || 0;

    return res.json({
      totalMatched: total,

      stageBreakdown:
        stageMap,

      conversionRate: total
        ? Number(
            (
              (paid / total) *
              100
            ).toFixed(2)
          )
        : 0,

      dropRate: total
        ? Number(
            (
              (dropped / total) *
              100
            ).toFixed(2)
          )
        : 0,
    });
  } catch (error) {
    console.error(
      "Matched overview error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load matched analytics overview",
    });
  }
}

// GET /api/matched/analytics/by-utm-source
async function byUtmSource(req, res) {
  try {
    const filter = buildFilter(req);

    const data = await MatchedLead.aggregate([
      {
        $match: filter,
      },

      {
        $project: {
          source: cleanMatchedSourceExpression(),
        },
      },

      {
        $group: {
          _id: "$source",
          total: {
            $sum: 1,
          },
        },
      },

      {
        $project: {
          _id: 0,

          utmSource: {
            $cond: [
              {
                $or: [
                  {
                    $eq: ["$_id", ""],
                  },
                  {
                    $eq: ["$_id", null],
                  },
                ],
              },

              "unknown",

              "$_id",
            ],
          },

          total: 1,
        },
      },

      {
        $sort: {
          total: -1,
        },
      },
    ]);

    return res.json(data);
  } catch (error) {
    console.error(
      "UTM source analytics error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load UTM source analytics",
    });
  }
}

// GET /api/matched/analytics/funnel
async function funnelByUtmSource(req, res) {
  try {
    const filter = buildFilter(req);

    const data = await MatchedLead.aggregate([
      {
        $match: filter,
      },

      {
        $project: {
          utmSource: cleanMatchedSourceExpression(),
          stage: "$excelStage",
        },
      },

      {
        $group: {
          _id: {
            utmSource: "$utmSource",
            stage: "$stage",
          },
          count: {
            $sum: 1,
          },
        },
      },

      {
        $group: {
          _id: "$_id.utmSource",

          stages: {
            $push: {
              status: "$_id.stage",
              count: "$count",
            },
          },
        },
      },

      {
        $project: {
          _id: 0,
          utmSource: "$_id",
          stages: 1,
        },
      },

      {
        $sort: {
          utmSource: 1,
        },
      },
    ]);

    return res.json(data);
  } catch (error) {
    console.error(
      "Matched funnel error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load matched funnel analytics",
    });
  }
}

// GET /api/matched/analytics/drop-reasons
async function dropReasonsByUtmSource(
  req,
  res
) {
  try {
    const filter = {
      ...buildFilter(req),
      excelStage: "Dropped",
    };

    const data =
      await MatchedLead.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: {
              utmSource: {
                $ifNull: [
                  "$utmSource",
                  "Unknown",
                ],
              },

              reason: {
                $ifNull: [
                  "$excelDropReason",
                  "Unknown",
                ],
              },
            },

            count: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            utmSource:
              "$_id.utmSource",
            reason:
              "$_id.reason",
            count: 1,
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ]);

    return res.json(data);
  } catch (error) {
    console.error(
      "Drop reason analytics error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load drop-reason analytics",
    });
  }
}

// GET /api/matched/leads?mode=&utmSource=&q=&page=&limit=
async function listMatched(req, res) {
  try {
    const filter =
      buildFilter(req);

    const {
      page = 1,
      limit = 25,
      q,
    } = req.query;

    if (q) {
      filter.$or = [
        {
          fullName: {
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
        {
          excelCustomerName: {
            $regex: q,
            $options: "i",
          },
        },
      ];
    }

    const pageNumber =
      Math.max(
        Number(page),
        1
      );

    const limitNumber =
      Math.min(
        Math.max(
          Number(limit),
          1
        ),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const [items, total] =
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

// GET /api/matched/leads/:phone?mode=live|demo
async function getOne(req, res) {
  try {
    const mode =
      req.query.mode === "demo"
        ? "demo"
        : "live";

    const lead =
      await MatchedLead.findOne({
        mode,
        phone: req.params.phone,
      }).lean();

    if (!lead) {
      return res.status(404).json({
        message:
          "No matched lead found for this phone",
      });
    }

    return res.json(lead);
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

// GET /api/matched/trials?mode=&q=&status=&from=&to=&page=&limit=
async function listTrials(req, res) {
  try {
    const genuineTrialFilter =
      buildGenuineTrialFilter(req);

    const {
      page = 1,
      limit = 25,
      q,
      status,
    } = req.query;

    const filter = {
      ...genuineTrialFilter,
    };

    if (status) {
      filter.trialStatus = {
        $regex: `^${status}$`,
        $options: "i",
      };
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
          phone: {
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
          excelAgent: {
            $regex: q,
            $options: "i",
          },
        },
      ];

      /*
       * Preserve the trial conditions while
       * applying the text search conditions.
       */
      filter.$and = [
        {
          $or:
            genuineTrialFilter.$or,
        },
        {
          $or:
            searchConditions,
        },
      ];

      delete filter.$or;
    }

    const pageNumber =
      Math.max(
        Number(page),
        1
      );

    const limitNumber =
      Math.min(
        Math.max(
          Number(limit),
          1
        ),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const summaryFilter =
      buildGenuineTrialFilter(req);

    const [
      items,
      total,
      summaryRows,
    ] = await Promise.all([
      MatchedLead.find(filter)
        .sort({
          trialStart: -1,
          capturedAt: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      MatchedLead.countDocuments(
        filter
      ),

      MatchedLead.aggregate([
        {
          $match:
            summaryFilter,
        },
        {
          $group: {
            _id: null,

            total: {
              $sum: 1,
            },

            started: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $type:
                          "$trialStart",
                      },
                      "date",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            completed: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $type:
                          "$trialCompletedAt",
                      },
                      "date",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            converted: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$isConverted",
                      true,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const summary =
      summaryRows[0] || {
        total: 0,
        started: 0,
        completed: 0,
        converted: 0,
      };

    return res.json({
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
      summary,
    });
  } catch (error) {
    console.error(
      "List trial leads error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load trial leads",
    });
  }
}

// GET /api/matched/trials/:phone?mode=live|demo
async function getTrial(req, res) {
  try {
    const mode =
      req.query.mode === "demo"
        ? "demo"
        : "live";

    const trialConditions =
      buildGenuineTrialFilter({
        query: {
          mode,
        },
      }).$or;

    const lead =
      await MatchedLead.findOne({
        mode,
        phone: req.params.phone,
        $or: trialConditions,
      }).lean();

    if (!lead) {
      return res.status(404).json({
        message:
          "No trial journey found for this phone",
      });
    }

    return res.json(lead);
  } catch (error) {
    console.error(
      "Get trial lead error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load trial lead",
    });
  }
}

module.exports = {
  overview,
  byUtmSource,
  funnelByUtmSource,
  dropReasonsByUtmSource,
  listMatched,
  getOne,
  listTrials,
  getTrial,
};