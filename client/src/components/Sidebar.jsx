import { NavLink, useNavigate } from "react-router-dom";

export default function Sidebar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("ltd_user") || "null");

  function logout() {
    localStorage.removeItem("ltd_token");
    localStorage.removeItem("ltd_user");
    navigate("/login");
  }

  return (
    <div className="sidebar">
      <h1>
        Lead<span>Track</span>
      </h1>
      <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
        📊 Dashboard
      </NavLink>
      <NavLink to="/leads" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
        📋 Leads
      </NavLink>
      <NavLink to="/matched" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
        🔗 Source Match
      </NavLink>
      <NavLink to="/trials" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
        🧪 Trial Leads
      </NavLink>

      <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #1D2939" }}>
        {user && (
          <div style={{ fontSize: 12, color: "#94A3B8", padding: "0 12px 10px" }}>
            {user.name} · {user.role}
          </div>
        )}
        <button
          onClick={logout}
          className="nav-link"
          style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
        >
          ↩ Logout
        </button>
      </div>
    </div>
  );
}
