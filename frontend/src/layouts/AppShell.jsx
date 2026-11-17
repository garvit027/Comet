import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

function Logo({ light = true }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-5 h-5 border-2 border-white/80 rounded-full rotate-[-25deg]" />
        <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-1.5 right-1.5" />
      </div>
      <span className={`text-xl font-bold tracking-tight ${light ? "text-white" : "text-midnight"}`}>Comet</span>
    </div>
  );
}

export function PublicNav() {
  return (
    <header className="bg-midnight border-b border-white/10 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <a href="#how" className="hover:text-white">How It Works</a>
          <a href="#auctioneer" className="hover:text-white">Auctioneer Suite</a>
          <a href="#bidder" className="hover:text-white">Bidder Portal</a>
          <a href="#rules" className="hover:text-white">Auction Rules</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm text-white/90 hover:text-white">Sign In</Link>
          <Link to="/register" className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white font-medium">Get Started</Link>
        </div>
      </div>
    </header>
  );
}

export function PortalShell({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAuctioneer = role === "AUCTIONEER";
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const url = isAuctioneer ? "/dashboard/auctioneer" : "/bidder/notifications";
    api.get(url).then((r) => {
      setNotifications(isAuctioneer ? (r.data?.recent_activity || []).map(x => ({ ...x, id: `${x.rfq_id}-${x.created_at}` })) : (r.data || []));
    }).catch(() => {});
  }, [isAuctioneer]);

  const links = isAuctioneer ? [
    { to: "/auctioneer/dashboard", label: "Dashboard" },
    { to: "/auctioneer/rfqs", label: "RFQs" },
    { to: "/auctioneer/rfqs/create", label: "Create RFQ" },
    { to: "/auctioneer/live-auctions", label: "Live Auctions" },
    { to: "/auctioneer/evaluation", label: "Evaluation & Award" },
    { to: "/auctioneer/purchase-orders", label: "Purchase Orders" },
    { to: "/auctioneer/suppliers", label: "Suppliers" },
  ] : [
    { to: "/bidder/dashboard", label: "Dashboard" },
    { to: "/bidder/available-auctions", label: "Available Auctions" },
    { to: "/bidder/my-auctions", label: "My Auctions" },
    { to: "/bidder/bid-history", label: "Bid History" },
    { to: "/bidder/profile", label: "Profile" },
  ];

  const initials = (user?.full_name || user?.company_name || "U").split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
  const subtitle = isAuctioneer ? "Auctioneer" : (user?.company_name || "Bidder");

  return (
    <div className="min-h-screen bg-canvas flex">
      <aside className="w-[240px] bg-midnight text-white flex flex-col fixed inset-y-0 left-0 border-r border-white/10">
        <div className="h-16 flex items-center px-5 border-b border-white/10"><Logo /></div>
        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} className={({isActive}) => `block px-3 py-2.5 rounded-lg text-sm ${isActive ? "bg-gradient-to-r from-primary to-primary-light text-white font-medium" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={() => { logout(); navigate("/login"); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white mb-2">Logout</button>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-primary/30 border border-white/10 flex items-center justify-center text-xs font-semibold">{initials}</div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{isAuctioneer ? (user?.full_name || "Procurement Manager") : (user?.company_name || user?.full_name)}</div>
              <div className="text-xs text-slate-400 truncate">{isAuctioneer ? "Auctioneer" : "Bidder"}</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex-1 ml-[240px] min-w-0">
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold text-white ${isAuctioneer ? "bg-[#1E1B4B]" : "bg-primary"}`}>
            {isAuctioneer ? "Auctioneer Portal" : "Bidder Portal"}
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-500" />Connected</span>
            <div className="relative">
              <button onClick={() => { setNotificationsOpen(v => !v); setProfileOpen(false); }} className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center relative">
                🔔
                {notifications.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white border border-border rounded-xl shadow-lg z-50 p-2">
                  <div className="px-2 py-2 font-semibold text-sm border-b border-border">Notifications</div>
                  <div className="max-h-72 overflow-auto py-1">
                    {notifications.slice(0, 10).map((n, i) => (
                      <button key={n.id || i} onClick={() => { setNotificationsOpen(false); if (n.rfq_id) navigate(isAuctioneer ? `/auctioneer/auctions/${n.rfq_id}` : `/bidder/auctions/${n.rfq_id}`); }} className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 text-sm">
                        <div className="text-slate-800">{n.message}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                      </button>
                    ))}
                    {notifications.length === 0 && <div className="px-2 py-4 text-sm text-slate-500">No notifications yet.</div>}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setProfileOpen(v => !v); setNotificationsOpen(false); }} className="flex items-center gap-2 text-slate-700">
                <span className="h-8 w-8 rounded-full bg-indigo-100 text-primary flex items-center justify-center text-xs font-semibold">{subtitle.slice(0,2).toUpperCase()}</span>
                <span className="hidden sm:inline">{user?.full_name || user?.company_name}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-11 w-56 bg-white border border-border rounded-xl shadow-lg z-50 p-2 text-sm">
                  <div className="px-2 py-2 border-b border-border">
                    <div className="font-medium">{user?.full_name || user?.company_name}</div>
                    <div className="text-xs text-slate-500">{user?.email}</div>
                  </div>
                  <button onClick={() => { setProfileOpen(false); navigate(isAuctioneer ? "/auctioneer/dashboard" : "/bidder/profile"); }} className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 mt-1">
                    {isAuctioneer ? "Dashboard" : "Company Profile"}
                  </button>
                  <button onClick={() => { logout(); navigate("/login"); }} className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 text-red-600">Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
}

export { Logo };
