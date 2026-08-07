require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Lead = require("../models/Lead");

const SOURCES = ["Facebook", "Google Ads", "Instagram", "Website Organic", "YouTube"];
const DROP_REASONS = ["Price too high", "Not interested", "Not reachable", "Timing issue", "Already enrolled elsewhere"];
const STAGES = ["New", "Assigned", "Contacted", "Follow-up", "Trial Given", "Paid", "Dropped"];

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generateLeadId() {
  return "LD-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 900 + 100);
}
function randomPastDate(daysBack) {
  return new Date(Date.now() - Math.floor(Math.random() * daysBack) * 24 * 60 * 60 * 1000);
}

async function run() {
  await connectDB();

  console.log("Clearing existing demo data...");
  await User.deleteMany({});
  await Lead.deleteMany({});

  console.log("Creating users...");
  const admin = await User.create({ name: "Admin", email: "admin@demo.com", password: "admin123", role: "admin" });
  const agents = await Promise.all(
    ["Riya Sharma", "Karan Mehta", "Ananya Rao"].map((name, i) =>
      User.create({ name, email: `agent${i + 1}@demo.com`, password: "agent123", role: "agent" })
    )
  );

  console.log("Creating sample leads...");
  const leads = [];
  for (let i = 0; i < 150; i++) {
    const source = randomOf(SOURCES);
    const createdAt = randomPastDate(60);
    const finalStatus = randomOf(STAGES.slice(1)); // never leave at "New" only, for realistic funnel
    const agent = randomOf(agents);

    const history = [{ status: "New", note: "Lead captured from landing page", changedAt: createdAt }];
    const stageOrder = ["Assigned", "Contacted", "Follow-up", "Trial Given"];
    const finalIndex = STAGES.indexOf(finalStatus);
    for (const stage of stageOrder) {
      if (STAGES.indexOf(stage) <= finalIndex) {
        history.push({
          status: stage,
          agent: agent._id,
          agentName: agent.name,
          note: `${stage} update`,
          changedAt: new Date(createdAt.getTime() + history.length * 3600 * 1000),
        });
      }
    }
    let dropReason = "";
    if (finalStatus === "Dropped") {
      dropReason = randomOf(DROP_REASONS);
      history.push({
        status: "Dropped",
        reason: dropReason,
        agent: agent._id,
        agentName: agent.name,
        changedAt: new Date(createdAt.getTime() + history.length * 3600 * 1000),
      });
    } else if (finalStatus === "Paid") {
      history.push({
        status: "Paid",
        agent: agent._id,
        agentName: agent.name,
        note: "Course fee received",
        changedAt: new Date(createdAt.getTime() + history.length * 3600 * 1000),
      });
    }

    leads.push({
      leadId: generateLeadId(),
      name: `Lead ${i + 1}`,
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      email: `lead${i + 1}@example.com`,
      source,
      campaign: `${source}-campaign-${(i % 4) + 1}`,
      currentStatus: finalStatus,
      dropReason,
      assignedAgent: agent._id,
      assignedAgentName: agent.name,
      history,
      createdAt,
    });
  }
  await Lead.insertMany(leads);

  console.log("Done. Demo login -> email: admin@demo.com | password: admin123");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
