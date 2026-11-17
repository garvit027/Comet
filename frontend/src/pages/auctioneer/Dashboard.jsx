import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR } from "../../api/client";

export default function AuctioneerDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/auctioneer").then(r => setData(r.data)).catch(()=>{}); }, []);
  const stats = data?.stats || {};
  const cards = [
    ["Total RFQs", stats.total_rfqs ?? 0],
    ["Active Auctions", stats.active_auctions ?? 0],
    ["Completed Auctions", stats.completed_auctions ?? 0],
    ["Participating Suppliers", stats.participating_suppliers ?? 0],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Auctioneer Dashboard</h1>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(([label, val]) => (
          <div key={label} className="bg-white rounded-2xl border border-border shadow-card p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{val}</div>
          </div>
        ))}
      </div>
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="font-semibold mb-4">Active & Recent Auctions</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500"><tr className="border-b border-border"><th className="text-left py-2">RFQ</th><th className="text-left">Title</th><th className="text-left">Current L1</th><th className="text-left">Savings %</th><th className="text-left">Status</th><th></th></tr></thead>
              <tbody>
                {(data?.auctions || []).slice(0,8).map(a => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-3 font-medium">{a.reference_id}</td>
                    <td>{a.title}</td>
                    <td className="tabular-nums">{formatINR(a.current_l1)}</td>
                    <td className="text-emerald-700 font-medium">{a.savings_percent != null ? `${a.savings_percent}%` : "—"}</td>
                    <td><span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">{a.auction_status || a.status}</span></td>
                    <td><Link to={`/auctioneer/auctions/${a.id}`} className="text-primary font-medium">Monitor →</Link></td>
                  </tr>
                ))}
                {(!data?.auctions || data.auctions.length===0) && <tr><td colSpan="6" className="py-6 text-center text-slate-500">No auctions yet. Create and publish an RFQ to begin.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="font-semibold mb-4">Recent Auction Activity</h2>
          <div className="space-y-3 max-h-[420px] overflow-auto">
            {(data?.recent_activity || []).map((l,i)=>(
              <div key={i} className="text-sm border-l-2 border-indigo-200 pl-3">
                <div className="text-slate-800">{l.message}</div>
                <div className="text-xs text-slate-500 mt-0.5">{new Date(l.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(!data?.recent_activity || data.recent_activity.length===0) && <div className="text-sm text-slate-500">No recent activity.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
