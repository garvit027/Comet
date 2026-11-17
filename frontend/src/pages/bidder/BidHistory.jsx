import { useEffect, useState } from "react";
import { api, formatINR } from "../../api/client";

export default function BidHistory() {
  const [rows, setRows] = useState([]);
  useEffect(()=>{ api.get("/bidder/bid-history").then(r=>setRows(r.data||[])).catch(()=>{}); }, []);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Bid History</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left p-4">RFQ</th><th className="text-left">Revision</th><th className="text-left">Total Bid</th><th className="text-left">Breakup (F/O/D)</th><th className="text-left">Time</th><th className="text-left">Outcome</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="p-4 font-medium">{r.rfq_reference}<div className="text-xs text-slate-500">{r.rfq_title}</div></td>
                <td>#{r.revision_number}</td>
                <td className="tabular-nums font-medium">{formatINR(r.total_bid_amount)}</td>
                <td className="text-xs text-slate-600">{formatINR(r.freight_charges)} / {formatINR(r.origin_charges)} / {formatINR(r.destination_charges)}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td><span className={`px-2 py-1 rounded-full text-xs ${r.outcome==="Won"?"bg-emerald-100 text-emerald-700":r.outcome==="Lost"?"bg-rose-100 text-rose-700":"bg-slate-100 text-slate-700"}`}>{r.outcome}</span></td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No bid history yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
