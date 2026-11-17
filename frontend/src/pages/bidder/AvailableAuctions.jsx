import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR } from "../../api/client";

export default function AvailableAuctions() {
  const [rfqs, setRfqs] = useState([]);
  const [tab, setTab] = useState("LIVE");
  useEffect(()=>{ api.get("/rfqs").then(r=>setRfqs(r.data||[])).catch(()=>{}); }, []);

  const filtered = rfqs.filter(r => {
    const st = r.auction_config?.status;
    if (tab==="LIVE") return st==="ACTIVE";
    if (tab==="UPCOMING") return st==="SCHEDULED" || r.status==="PUBLISHED";
    if (tab==="COMPLETED") return st==="CLOSED";
    return true;
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Available Auctions</h1>
      <div className="flex gap-2">{[["LIVE","Live Now"],["UPCOMING","Upcoming"],["COMPLETED","Completed"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} className={`px-3 py-1.5 rounded-full text-sm border ${tab===k?"bg-primary text-white border-primary":"bg-white border-border"}`}>{l}</button>
      ))}</div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div><div className="text-xs text-slate-500">{r.reference_id}</div><div className="font-semibold text-lg">{r.title}</div></div>
              <span className="px-2 py-1 rounded-full text-xs bg-slate-100">{r.auction_config?.status || r.status}</span>
            </div>
            <div className="text-sm text-slate-600 mb-3">{r.pickup_location} → {r.delivery_location}</div>
            <div className="text-xs text-slate-500 space-y-1 mb-4">
              <div>Quantity: {r.quantity || "—"}</div>
              <div>Window: {r.auction_config?.auction_start_time ? new Date(r.auction_config.auction_start_time).toLocaleString() : "—"}</div>
            </div>
            <div className="mt-auto">
              <Link to={`/bidder/auctions/${r.id}`} className="inline-block px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
                {r.auction_config?.status==="ACTIVE" ? "Join Live Auction" : r.auction_config?.status==="SCHEDULED" ? "View / Submit Initial Quote" : "View Auction"}
              </Link>
            </div>
          </div>
        ))}
        {filtered.length===0 && <div className="text-slate-500">No auctions in this category.</div>}
      </div>
    </div>
  );
}
