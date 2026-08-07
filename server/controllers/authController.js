const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  const ok = await user.comparePassword(password || "");
  if (!ok) return res.status(401).json({ message: "Invalid email or password" });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

// POST /api/auth/register  (admin only - creates agents/managers)
async function register(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: "A user with this email already exists" });

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: role || "agent",
  });

  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
}

// GET /api/auth/agents  (for assignment dropdown)
async function listAgents(req, res) {
  const agents = await User.find({ role: { $in: ["agent", "manager"] }, isActive: true }).select(
    "name email role"
  );
  res.json(agents);
}

module.exports = { login, register, listAgents };
