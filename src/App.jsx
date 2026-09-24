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
import Crosshairs from "./pages/Crosshairs";
import Wins from "./pages/Wins";
import Okrs from "./pages/Okrs";
import Brewing from "./pages/Brewing";
import LearningHub from "./pages/LearningHub";
import Contacts from "./pages/Contacts";
import Seo from "./pages/Seo";
import Content from "./pages/Content";
import Settings from "./pages/Settings";

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
          <Route path="crosshairs" element={<Crosshairs />} />
          <Route path="wins" element={<Wins />} />
          <Route path="okrs" element={<Okrs />} />
          <Route path="brewing" element={<Brewing />} />
          <Route path="learning-hub" element={<LearningHub />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="seo" element={<Seo />} />
          <Route path="content" element={<Content />} />
          <Route path="settings" element={<Settings />} />
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
