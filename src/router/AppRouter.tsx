import { Navigate, Route, Routes } from "react-router";
import { useApp } from "../context/app-context";
import HeroPage from "../pages/HeroPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import DicePage from "../pages/DicePage";
import MasterDashboardPage from "../pages/MasterDashboardPage";
import MasterHeroPage from "../pages/MasterHeroPage";
import MasterMapPage from "../pages/MasterMapPage";
import MapDisplayPage from "../pages/MapDisplayPage";
import ServerStatusPage from "../pages/ServerStatusPage";
import HandoutsPage from "../pages/HandoutsPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  return user ? children : <Navigate to="/login" replace />;
}

function MasterProtected({ children }: { children: React.ReactNode }) {
  const { user, viewRole } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "master" && viewRole === "master" ? children : <Navigate to="/" replace />;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><HomePage /></Protected>} />
      <Route path="/helden/:heroId" element={<Protected><HeroPage /></Protected>} />
      <Route path="/wuerfel" element={<Protected><DicePage /></Protected>} />
      <Route path="/handouts" element={<Protected><HandoutsPage /></Protected>} />
      <Route path="/meister" element={<MasterProtected><MasterDashboardPage /></MasterProtected>} />
      <Route path="/meister/helden/:heroId" element={<MasterProtected><MasterHeroPage /></MasterProtected>} />
      <Route path="/meister/karte" element={<MasterProtected><MasterMapPage /></MasterProtected>} />
      <Route path="/meister/server" element={<MasterProtected><ServerStatusPage /></MasterProtected>} />
      <Route path="/meister/handouts" element={<MasterProtected><HandoutsPage masterMode /></MasterProtected>} />
      <Route path="/karte/anzeige" element={<Protected><MapDisplayPage /></Protected>} />
      <Route path="/held" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
