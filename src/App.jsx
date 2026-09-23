import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { CheckInProvider } from "./lib/CheckInContext";
import LoginScreen from "./components/LoginScreen";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import PlaceholderPage from "./pages/PlaceholderPage";

const PLACEHOLDER_ROUTES = [
  { path: "pipeline", title: "Pipeline", description: "RFQ → quote → PO → delivery → invoice, tracked stage by stage." },
  { path: "intake", title: "Intake", description: "Capture new RFQs and client requests as they arrive." },
  { path: "sourcing", title: "Sourcing", description: "Match RFQ lines to part signatures and collect supplier quotes." },
  { path: "quote-builder", title: "Quote Builder", description: "Assemble client-facing quotations from sourced pricing." },
  { path: "ledger", title: "Ledger", description: "Purchase orders, deliveries, and invoices in one financial view." },
  { path: "crosshairs", title: "Crosshairs", description: "The accounts and opportunities currently in your sights." },
  { path: "okrs", title: "OKRs", description: "Quarterly objectives and key results." },
  { path: "content", title: "Content", description: "Plan and track content production." },
  { path: "seo", title: "SEO", description: "Search visibility and optimization tracking." },
  { path: "contacts", title: "Contacts", description: "Every client and contact in one directory." },
  { path: "learning-hub", title: "Learning Hub", description: "Reference material and training resources." },
  { path: "settings", title: "Settings", description: "Account, notification, and workspace preferences." },
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
