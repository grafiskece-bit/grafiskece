import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AppLayout from "@/components/app/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientProfile from "@/pages/ClientProfile";
import Orders from "@/pages/Orders";
import FollowUps from "@/pages/FollowUps";
import Recommendations from "@/pages/Recommendations";
import CalendarPage from "@/pages/Calendar";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-neutral-500">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout><Outlet /></AppLayout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/klien" element={<Clients />} />
            <Route path="/klien/:id" element={<ClientProfile />} />
            <Route path="/tindak-lanjut" element={<FollowUps />} />
            <Route path="/rekomendasi" element={<Recommendations />} />
            <Route path="/pesanan" element={<Orders />} />
            <Route path="/kalender" element={<CalendarPage />} />
            <Route path="/analitik" element={<Analytics />} />
            <Route path="/pengaturan" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
