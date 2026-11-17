import { useEffect, useState } from "react";
import { api, formatINR } from "../../api/client";

export default function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [rating, setRating] = useState({}); // poId -> {rating,text,open}
  const load = () => api.get("/purchase-orders").then(r=>setPos(r.data)).catch(()=>{});
  useEffect(()=>{ load(); }, []);

  const setStatus = async (id, status) => { await api.post(`/purchase-orders/${id}/status`, null, { params: { status } }); load(); };
  const submitReview = async (po) => {
    const entry = rating[po.id] || {};
    await api.post(`/purchase-orders/${po.id}/review`, { rating: Number(entry.rating || 5), review_text: entry.text || "" });
    setRating(r=>({...r,[po.id]:{...r[po.id], open:false}})); load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Purchase Orders & Contract Awards</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left p-4">PO</th><th className="text-left">RFQ</th><th className="text-left">Supplier</th><th className="text-left">Awarded</th><th className="text-left">Status</th><th className="text-left">Actions</th></tr></thead>
          <tbody>
            {pos.map(po => (
              <tr key={po.id} className="border-t border-border/70 align-top">
                <td className="p-4 font-medium">{po.po_number}<div className="text-xs text-slate-500">{new Date(po.issued_at).toLocaleString()}</div></td>
                <td>{po.rfq_reference}<div className="text-xs text-slate-500">{po.rfq_title}</div></td>
                <td>{po.supplier_name}</td>
                <td className="tabular-nums">{formatINR(po.awarded_bid_amount)}</td>
                <td><span className="px-2 py-1 rounded-full text-xs bg-slate-100">{po.status}</span></td>
                <td className="space-y-2 py-3 pr-3">
                  <div className="flex gap-2 flex-wrap">
                    {po.status==="ISSUED" && <button onClick={()=>setStatus(po.id,"IN_TRANSIT")} className="text-primary text-xs font-medium">Mark In Transit</button>}
                    {po.status!=="COMPLETED" && <button onClick={()=>setStatus(po.id,"COMPLETED")} className="text-emerald-700 text-xs font-medium">Mark Completed</button>}
                    {po.status==="COMPLETED" && !po.has_review && <button onClick={()=>setRating(r=>({...r,[po.id]:{...(r[po.id]||{}), open:true, rating:5, text:""}}))} className="text-amber-700 text-xs font-medium">Rate & Review Supplier</button>}
                    {po.has_review && <span className="text-xs text-slate-500">Review submitted</span>}
                  </div>
                  {rating[po.id]?.open && (
                    <div className="border border-border rounded-lg p-3 bg-slate-50 space-y-2">
                      <div className="flex items-center gap-2 text-sm"><span>Rating</span>
                        <select value={rating[po.id].rating} onChange={e=>setRating(r=>({...r,[po.id]:{...r[po.id], rating:e.target.value}}))} className="border rounded px-2 py-1">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} ★</option>)}</select>
                      </div>
                      <textarea className="w-full border rounded p-2 text-sm" rows={2} placeholder="Written review (optional)" value={rating[po.id].text} onChange={e=>setRating(r=>({...r,[po.id]:{...r[po.id], text:e.target.value}}))} />
                      <div className="flex gap-2"><button onClick={()=>submitReview(po)} className="px-3 py-1.5 rounded bg-primary text-white text-xs">Submit Review</button><button onClick={()=>setRating(r=>({...r,[po.id]:{...r[po.id], open:false}}))} className="px-3 py-1.5 rounded border text-xs">Cancel</button></div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {pos.length===0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No purchase orders yet. Award a closed auction to create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
