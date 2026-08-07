import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadJourney from "./pages/LeadJourney";
import MatchedDashboard from "./pages/MatchedDashboard";
import MatchedLeadDetail from "./pages/MatchedLeadDetail";
import TrialLeads from "./pages/TrialLeads";
import TrialLeadDetail from "./pages/TrialLeadDetail";

function isAuthed() {
  return !!localStorage.getItem("ltd_token");
}

function ProtectedLayout({ children }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/leads" element={<ProtectedLayout><Leads /></ProtectedLayout>} />
        <Route path="/leads/:id" element={<ProtectedLayout><LeadJourney /></ProtectedLayout>} />
        <Route path="/matched" element={<ProtectedLayout><MatchedDashboard /></ProtectedLayout>} />
        <Route path="/matched/:phone" element={<ProtectedLayout><MatchedLeadDetail /></ProtectedLayout>} />
        <Route path="/trials" element={<ProtectedLayout><TrialLeads /></ProtectedLayout>} />
        <Route path="/trials/:phone" element={<ProtectedLayout><TrialLeadDetail /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
