import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatINR } from "../../api/client";

export default function Evaluation() {
  const { auctionId } = useParams();
  const [rfqs, setRfqs] = useState([]);
  const [selected, setSelected] = useState(auctionId || "");
  const [data, setData] = useState(null);
  const [pick, setPick] = useState("");
  const [justification, setJustification] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { api.get("/rfqs").then(r => setRfqs((r.data||[]).filter(x=>x.status==="CLOSED"))); }, []);
  useEffect(() => { if (auctionId) setSelected(auctionId); }, [auctionId]);
  useEffect(() => {
    if (!selected) { setData(null); return; }
    api.get(`/auctions/${selected}/evaluation`).then(r=>setData(r.data)).catch(e=>{setData(null); setErr(e?.response?.data?.detail||"Unable to load evaluation");});
  }, [selected]);

  const suppliers = data?.suppliers || [];
  const picked = suppliers.find(s=>s.supplier_id===pick);
  const needsJustification = picked && picked.rank !== 1;

  const award = async () => {
    setErr(""); setMsg("");
    try {
      await api.post(`/auctions/${selected}/award`, { supplier_id: pick, justification: justification || null });
      setMsg("Contract awarded and PO issued successfully.");
    } catch (e) { setErr(e?.response?.data?.detail || "Failed to award contract"); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Supplier Evaluation & Contract Award</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">Closed Auction:</label>
        <select className="border border-border rounded-lg px-3 py-2 min-w-[320px]" value={selected} onChange={e=>{setSelected(e.target.value); setPick(""); setJustification("");}}>
          <option value="">Select a closed auction</option>
          {rfqs.map(r => <option key={r.id} value={r.id}>{r.reference_id} — {r.title}</option>)}
        </select>
      </div>
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-3">{err}</div>}
      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded p-3">{msg}</div>}
      {data && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="font-semibold mb-4">Qualification & Bid Comparison Matrix — {data.reference_id}</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500"><tr className="border-b"><th></th><th className="text-left py-2">Rank</th><th className="text-left">Supplier</th><th className="text-left">Total Bid</th><th className="text-left">Breakup (F/O/D)</th><th className="text-left">Transit</th><th className="text-left">Validity</th><th className="text-left">Track Record</th><th className="text-left">Rating</th></tr></thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.supplier_id} className="border-b border-border/60">
                    <td className="py-3"><input type="radio" name="award" checked={pick===s.supplier_id} onChange={()=>setPick(s.supplier_id)} /></td>
                    <td><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 font-semibold">#{s.rank} {s.rank===1?"(L1)":""}</span></td>
                    <td className="font-medium">{s.supplier_name}</td>
                    <td className="tabular-nums font-semibold">{formatINR(s.total_bid_amount)}</td>
                    <td className="text-xs text-slate-600">{formatINR(s.freight_charges)} / {formatINR(s.origin_charges)} / {formatINR(s.destination_charges)}</td>
                    <td>{s.transit_time || "—"}</td>
                    <td>{s.quote_validity_days ? `${s.quote_validity_days} days` : "—"}</td>
                    <td className="text-xs">{s.completed_contracts} completed / {s.awarded_contracts} awarded</td>
                    <td>{s.average_rating ? `★ ${s.average_rating}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {needsJustification && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-800 mb-1">Non-L1 Award Justification (required)</label>
              <textarea className="w-full border border-border rounded-lg p-3" rows={3} value={justification} onChange={e=>setJustification(e.target.value)} placeholder="Explain why a non-L1 supplier is selected (e.g. better transit time, reliability, performance)..." />
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button onClick={award} disabled={!pick || (needsJustification && !justification.trim())} className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50">Confirm Award & Create PO</button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Selecting non-L1 requires justification. L1 is not auto-awarded.</p>
        </div>
      )}
      {!data && selected=== "" && <div className="text-slate-500">Select a closed auction to evaluate and award.</div>}
    </div>
  );
}
