import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR } from "../../api/client";

export default function MyAuctions() {
  const [rows, setRows] = useState([]);
  useEffect(()=>{ api.get("/bidder/my-auctions").then(r=>setRows(r.data||[])).catch(()=>{}); }, []);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">My Auctions</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left p-4">RFQ</th><th className="text-left">Status</th><th className="text-left">My Bid</th><th className="text-left">My Rank</th><th className="text-left">Current L1</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="p-4 font-medium">{r.reference_id}<div className="text-xs text-slate-500">{r.title}</div></td>
                <td>{r.auction_status || r.status}</td>
                <td className="tabular-nums">{formatINR(r.my_bid)}</td>
                <td>{r.my_rank ? `#${r.my_rank}` : "—"}</td>
                <td className="tabular-nums">{formatINR(r.current_l1)}</td>
                <td><Link to={`/bidder/auctions/${r.id}`} className="text-primary font-medium">Open</Link></td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">You have not bid in any auctions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
