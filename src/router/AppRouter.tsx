import { Navigate, Route, Routes } from "react-router";
import { useApp } from "../context/app-context";
import HeroPage from "../pages/HeroPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import DicePage from "../pages/DicePage";
import MasterDashboardPage from "../pages/MasterDashboardPage";
import MasterHeroPage from "../pages/MasterHeroPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  return user ? children : <Navigate to="/login" replace />;
}

function MasterProtected({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "master" ? children : <Navigate to="/" replace />;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><HomePage /></Protected>} />
      <Route path="/helden/:heroId" element={<Protected><HeroPage /></Protected>} />
      <Route path="/wuerfel" element={<Protected><DicePage /></Protected>} />
      <Route path="/meister" element={<MasterProtected><MasterDashboardPage /></MasterProtected>} />
      <Route path="/meister/helden/:heroId" element={<MasterProtected><MasterHeroPage /></MasterProtected>} />
      <Route path="/held" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
