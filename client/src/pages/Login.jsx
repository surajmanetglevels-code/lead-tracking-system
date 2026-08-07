import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/api";

export default function Login() {
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      localStorage.setItem("ltd_token", data.token);
      localStorage.setItem("ltd_user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Lead Tracking</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />
        {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <div className="hint">Demo: admin@demo.com / admin123 (after running the seed script)</div>
      </form>
    </div>
  );
}
