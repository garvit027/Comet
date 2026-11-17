import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { PortalShell } from "./layouts/AppShell";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import AuctioneerDashboard from "./pages/auctioneer/Dashboard";
import RFQList from "./pages/auctioneer/RFQList";
import CreateRFQ from "./pages/auctioneer/CreateRFQ";
import AuctioneerLive from "./pages/auctioneer/LiveAuction";
import Evaluation from "./pages/auctioneer/Evaluation";
import PurchaseOrders from "./pages/auctioneer/PurchaseOrders";
import Suppliers from "./pages/auctioneer/Suppliers";
import BidderDashboard from "./pages/bidder/Dashboard";
import AvailableAuctions from "./pages/bidder/AvailableAuctions";
import MyAuctions from "./pages/bidder/MyAuctions";
import BidHistory from "./pages/bidder/BidHistory";
import Profile from "./pages/bidder/Profile";
import BidderLive from "./pages/bidder/LiveAuction";

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.approval_status !== "APPROVED") return <div className="min-h-screen flex items-center justify-center bg-canvas"><div className="bg-white p-8 rounded-2xl border border-border shadow-card text-center max-w-md"><h2 className="text-xl font-semibold mb-2">Pending Admin Approval</h2><p className="text-slate-600">Your Auctioneer account is awaiting approval. Please sign in later with your approved credentials.</p></div></div>;
  if (role && user.role !== role) return <Navigate to={user.role === "AUCTIONEER" ? "/auctioneer/dashboard" : "/bidder/dashboard"} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route path="/auctioneer" element={<Protected role="AUCTIONEER"><PortalShell role="AUCTIONEER" /></Protected>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AuctioneerDashboard />} />
        <Route path="rfqs" element={<RFQList />} />
        <Route path="rfqs/create" element={<CreateRFQ />} />
        <Route path="rfqs/:id/edit" element={<CreateRFQ />} />
        <Route path="live-auctions" element={<RFQList liveOnly />} />
        <Route path="auctions/:id" element={<AuctioneerLive />} />
        <Route path="evaluation" element={<Evaluation />} />
        <Route path="evaluation/:auctionId" element={<Evaluation />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="suppliers" element={<Suppliers />} />
      </Route>

      <Route path="/bidder" element={<Protected role="BIDDER"><PortalShell role="BIDDER" /></Protected>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<BidderDashboard />} />
        <Route path="available-auctions" element={<AvailableAuctions />} />
        <Route path="my-auctions" element={<MyAuctions />} />
        <Route path="bid-history" element={<BidHistory />} />
        <Route path="profile" element={<Profile />} />
        <Route path="auctions/:id" element={<BidderLive />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? (user.role === "AUCTIONEER" ? "/auctioneer/dashboard" : "/bidder/dashboard") : "/"} replace />} />
    </Routes>
  );
}
