import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(()=>{ api.get("/suppliers").then(r=>setSuppliers(r.data)).catch(()=>{}); }, []);
  const open = async (id) => { const r = await api.get(`/suppliers/${id}`); setSelected(r.data); };
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Suppliers Directory</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left p-4">Company</th><th className="text-left">Category</th><th className="text-left">Completed</th><th className="text-left">Deliveries</th><th className="text-left">Rating</th><th className="text-left">Profile</th></tr></thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} className="border-t border-border/70">
                <td className="p-4 font-medium">{s.company_name}<div className="text-xs text-slate-500">{s.contact_person}</div></td>
                <td>{s.business_category || "—"}</td>
                <td className="tabular-nums">{s.completed_contracts}</td>
                <td className="tabular-nums">{s.successful_deliveries}</td>
                <td>{s.average_rating ? `★ ${s.average_rating}` : "—"}</td>
                <td><button onClick={()=>open(s.id)} className="text-primary font-medium">View Full Profile</button></td>
              </tr>
            ))}
            {suppliers.length===0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No suppliers registered yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-40" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-lg bg-white h-full p-6 overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">{selected.company_name}</h2><button onClick={()=>setSelected(null)}>✕</button></div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <Info k="Contact" v={selected.contact_person} /><Info k="Phone" v={selected.phone_number} />
              <Info k="Category" v={selected.business_category} /><Info k="GSTIN" v={selected.gstin} />
              <Info k="Awarded" v={selected.awarded_contracts} /><Info k="Completed" v={selected.completed_contracts} />
              <Info k="Deliveries" v={selected.successful_deliveries} /><Info k="Avg Rating" v={selected.average_rating ? `★ ${selected.average_rating}`:"—"} />
            </div>
            <div className="text-sm mb-4"><div className="font-medium mb-1">Fleet/Service Details</div><div className="text-slate-600">{selected.fleet_details || "—"}</div></div>
            <div className="text-sm mb-4"><div className="font-medium mb-1">Certifications</div><div className="text-slate-600">{selected.certifications || "—"}</div></div>
            <div className="font-semibold mb-2">Contract Reviews</div>
            <div className="space-y-2">
              {(selected.reviews||[]).map(r => (<div key={r.id} className="border border-border rounded-lg p-3 text-sm"><div className="font-medium">★ {r.rating}</div><div className="text-slate-700">{r.review_text || "No written review"}</div><div className="text-xs text-slate-500 mt-1">{new Date(r.created_at).toLocaleString()}</div></div>))}
              {(!selected.reviews||selected.reviews.length===0) && <div className="text-sm text-slate-500">No reviews yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Info({k,v}){return <div className="bg-slate-50 rounded-lg p-2"><div className="text-xs text-slate-500">{k}</div><div className="font-medium">{v ?? "—"}</div></div>;}
