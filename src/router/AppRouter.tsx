import { Navigate, Route, Routes } from "react-router";
import HeroPage from "../pages/HeroPage";
import HomePage from "../pages/HomePage";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/helden/:heroId" element={<HeroPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
