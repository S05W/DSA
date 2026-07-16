import { Route, Routes } from "react-router";
import "./App.css";

import HomePage from "./pages/HomePage";
import HeroPage from "./pages/HeroPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/helden/:heroId" element={<HeroPage />} />
    </Routes>
  );
}

export default App;