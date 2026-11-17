import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState("");
  useEffect(()=>{ api.get("/bidder/profile").then(r=>{ setProfile(r.data); setForm(r.data); }).catch(()=>{}); }, []);
  const save = async (e) => {
    e.preventDefault();
    await api.put("/bidder/profile", { company_name: form.company_name, contact_person: form.contact_person, phone_number: form.phone_number, business_category: form.business_category, gstin: form.gstin, fleet_details: form.fleet_details, certifications: form.certifications });
    setMsg("Profile updated.");
  };
  if (!profile) return <div className="text-slate-500">Loading profile...</div>;
  return (
    <div className="space-y-5 max-w-5xl">
      <h1 className="text-2xl font-bold">Company Profile</h1>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[["Awarded Contracts", profile.awarded_contracts],["Completed Contracts", profile.completed_contracts],["Successful Deliveries", profile.successful_deliveries],["Average Rating", profile.average_rating ? `★ ${profile.average_rating}`:"—"]].map(([l,v])=>(
          <div key={l} className="bg-white rounded-2xl border border-border shadow-card p-4"><div className="text-sm text-slate-500">{l}</div><div className="text-xl font-bold mt-1 tabular-nums">{v ?? 0}</div></div>
        ))}
      </div>
      <form onSubmit={save} className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-4">
        {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded p-2">{msg}</div>}
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ["company_name","Company Name"],["contact_person","Contact Person"],["phone_number","Phone Number"],["business_category","Business/Service Category"],["gstin","GSTIN / Registration Number"]
          ].map(([k,label])=>(
            <label key={k} className="block"><div className="text-sm text-slate-700 mb-1">{label}</div><input className="w-full border border-border rounded-lg px-3 py-2.5" value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})} /></label>
          ))}
        </div>
        <label className="block"><div className="text-sm text-slate-700 mb-1">Fleet/Service Details</div><textarea className="w-full border border-border rounded-lg px-3 py-2.5" rows={3} value={form.fleet_details||""} onChange={e=>setForm({...form,fleet_details:e.target.value})} /></label>
        <label className="block"><div className="text-sm text-slate-700 mb-1">Certifications</div><textarea className="w-full border border-border rounded-lg px-3 py-2.5" rows={2} value={form.certifications||""} onChange={e=>setForm({...form,certifications:e.target.value})} /></label>
        <button className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium">Save Profile</button>
      </form>
    </div>
  );
}
