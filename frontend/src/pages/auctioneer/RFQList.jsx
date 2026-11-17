import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";

export default function RFQList({ liveOnly }) {
  const [rfqs, setRfqs] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const navigate = useNavigate();
  const load = () => api.get("/rfqs").then(r=>setRfqs(r.data)).catch(()=>{});
  useEffect(() => { load(); }, []);
  const filtered = rfqs.filter(r => {
    if (liveOnly) return r.status === "ACTIVE" || r.status === "PUBLISHED";
    if (filter === "ALL") return true;
    return r.status === filter;
  });
  const publish = async (id) => { await api.post(`/rfqs/${id}/publish`); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{liveOnly ? "Live Auctions" : "RFQs"}</h1>
        {!liveOnly && <Link to="/auctioneer/rfqs/create" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">Create RFQ</Link>}
      </div>
      {!liveOnly && (
        <div className="flex flex-wrap gap-2">
          {["ALL","DRAFT","PUBLISHED","ACTIVE","CLOSED"].map(f => (
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-full text-sm border ${filter===f?"bg-primary text-white border-primary":"bg-white border-border text-slate-700"}`}>{f==="DRAFT"?"Draft (Unpublished)":f}</button>
          ))}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left p-4">Reference</th><th className="text-left">Title</th><th className="text-left">Status</th><th className="text-left">Window</th><th className="text-left">Actions</th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="p-4 font-medium">{r.reference_id}</td>
                <td>{r.title}<div className="text-xs text-slate-500">{r.pickup_location} {r.pickup_location && r.delivery_location ? "→" : ""} {r.delivery_location}</div></td>
                <td><span className="px-2 py-1 rounded-full text-xs bg-slate-100">{r.status}</span></td>
                <td className="text-xs text-slate-600">{r.auction_config?.auction_start_time ? new Date(r.auction_config.auction_start_time).toLocaleString() : "—"}</td>
                <td className="space-x-2">
                  {r.status === "DRAFT" && !liveOnly && <>
                    <button onClick={()=>navigate(`/auctioneer/rfqs/${r.id}/edit`)} className="text-primary font-medium">Edit</button>
                    <button onClick={()=>publish(r.id)} className="text-emerald-700 font-medium">Publish RFQ</button>
                  </>}
                  {(r.status === "PUBLISHED" || r.status === "ACTIVE" || r.status === "CLOSED") && <Link to={`/auctioneer/auctions/${r.id}`} className="text-primary font-medium">Monitor Auction</Link>}
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">No RFQs found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
