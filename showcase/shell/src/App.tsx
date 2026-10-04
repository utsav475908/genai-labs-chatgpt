import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConfigProvider, useShowcaseConfig } from "./config/ConfigProvider";
import { LabPage } from "./components/LabPage";
import { Sidebar } from "./components/Sidebar";

function FirstLab() {
  const { labs } = useShowcaseConfig();
  if (labs.length === 0) return <main className="content center">No labs enabled in labs.json.</main>;
  return <Navigate to={`/${labs[0].id}`} replace />;
}

export function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <div className="layout">
          <Sidebar />
          <Routes>
            <Route path="/" element={<FirstLab />} />
            <Route path="/:labId" element={<LabPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  );
}
