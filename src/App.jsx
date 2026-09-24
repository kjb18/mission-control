import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { CheckInProvider } from "./lib/CheckInContext";
import LoginScreen from "./components/LoginScreen";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Intake from "./pages/Intake";
import Sourcing from "./pages/Sourcing";
import QuoteBuilder from "./pages/QuoteBuilder";
import Pipeline from "./pages/Pipeline";
import Ledger from "./pages/Ledger";
import Settings from "./pages/Settings";
import PlaceholderPage from "./pages/PlaceholderPage";

const PLACEHOLDER_ROUTES = [
  { path: "crosshairs", title: "Crosshairs", description: "The accounts and opportunities currently in your sights." },
  { path: "okrs", title: "OKRs", description: "Quarterly objectives and key results." },
  { path: "content", title: "Content", description: "Plan and track content production." },
  { path: "seo", title: "SEO", description: "Search visibility and optimization tracking." },
  { path: "contacts", title: "Contacts", description: "Every client and contact in one directory." },
  { path: "learning-hub", title: "Learning Hub", description: "Reference material and training resources." },
];

function AppRoutes() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-950">
        <div className="w-8 h-8 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <CheckInProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="intake" element={<Intake />} />
          <Route path="sourcing" element={<Sourcing />} />
          <Route path="quote-builder" element={<QuoteBuilder />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="settings" element={<Settings />} />
          {PLACEHOLDER_ROUTES.map(({ path, title, description }) => (
            <Route
              key={path}
              path={path}
              element={<PlaceholderPage title={title} description={description} />}
            />
          ))}
        </Route>
      </Routes>
    </CheckInProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
