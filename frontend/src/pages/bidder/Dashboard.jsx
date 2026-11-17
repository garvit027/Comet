import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR } from "../../api/client";

export default function BidderDashboard() {
  const [data, setData] = useState(null);
  useEffect(()=>{ api.get("/dashboard/bidder").then(r=>setData(r.data)).catch(()=>{}); }, []);
  const perf = data?.performance || {};
  const counts = data?.available_counts || {};
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bidder Dashboard</h1>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[["Awarded Contracts", perf.awarded_contracts ?? 0],["Completed Contracts", perf.completed_contracts ?? 0],["Successful Deliveries", perf.successful_deliveries ?? 0],["Your Rating (★)", perf.average_rating ? `★ ${perf.average_rating}` : "—"]].map(([l,v])=>(
          <div key={l} className="bg-white rounded-2xl border border-border shadow-card p-5"><div className="text-sm text-slate-500">{l}</div><div className="text-2xl font-bold mt-1 tabular-nums">{v}</div></div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[["Available Published RFQs", counts.available_published ?? 0, "/bidder/available-auctions"],["Active Auctions", counts.active ?? 0, "/bidder/available-auctions"],["Upcoming Auctions", counts.upcoming ?? 0, "/bidder/available-auctions"],["Completed Auctions", counts.completed ?? 0, "/bidder/available-auctions"]].map(([l,v,to])=>(
          <Link key={l} to={to} className="bg-white rounded-2xl border border-border shadow-card p-5 hover:border-primary/40"><div className="text-sm text-slate-500">{l}</div><div className="text-2xl font-bold mt-1 tabular-nums">{v}</div></Link>
        ))}
      </div>
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="font-semibold mb-4">My Active Rankings & Recent Bids</h2>
          <table className="w-full text-sm">
            <thead className="text-slate-500"><tr className="border-b border-border"><th className="text-left py-2">RFQ</th><th className="text-left">Your Bid</th><th className="text-left">Your Rank</th><th className="text-left">Current L1</th><th></th></tr></thead>
            <tbody>
              {(data?.my_auctions||[]).map(a => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="py-3 font-medium">{a.reference_id}<div className="text-xs text-slate-500">{a.title}</div></td>
                  <td className="tabular-nums">{formatINR(a.my_bid)}</td>
                  <td>{a.my_rank ? `#${a.my_rank}` : "—"}</td>
                  <td className="tabular-nums">{formatINR(a.current_l1)}</td>
                  <td><Link to={`/bidder/auctions/${a.id}`} className="text-primary font-medium">Enter Auction</Link></td>
                </tr>
              ))}
              {(!data?.my_auctions || data.my_auctions.length===0) && <tr><td colSpan="5" className="py-6 text-center text-slate-500">No auctions joined yet. Browse available auctions to start bidding.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="font-semibold mb-4">Notifications</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">Track outbid alerts, auction extensions, and award decisions in live auction rooms. (MVP: notifications shown contextually in auction views.)</div>
            <div className="p-3 bg-slate-50 border border-border rounded-lg">Tip: Open “Available Auctions” to discover all eligible published RFQs.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
