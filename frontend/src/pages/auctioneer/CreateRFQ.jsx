import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";

const empty = {
  title: "", category: "", description: "", quantity: "", specifications: "", pickup_location: "", delivery_location: "", transit_window: "",
  eligible_all_suppliers: true,
  auction_start_time: "", initial_closing_time: "", forced_closing_time: "",
  trigger_window_minutes: 10, extension_duration_minutes: 5, extension_trigger_type: "ANY_BID",
};

function toLocalInput(iso) { if (!iso) return ""; const d = new Date(iso); const pad=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

export default function CreateRFQ() {
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/rfqs`).then(r => {
      const rfq = (r.data || []).find(x => x.id === id);
      if (rfq) {
        setForm({
          title: rfq.title || "", category: rfq.category || "", description: rfq.description || "", quantity: rfq.quantity || "",
          specifications: rfq.specifications || "", pickup_location: rfq.pickup_location || "", delivery_location: rfq.delivery_location || "",
          transit_window: rfq.transit_window || "", eligible_all_suppliers: rfq.eligible_all_suppliers ?? true,
          auction_start_time: toLocalInput(rfq.auction_config?.auction_start_time), initial_closing_time: toLocalInput(rfq.auction_config?.initial_closing_time),
          forced_closing_time: toLocalInput(rfq.auction_config?.forced_closing_time), trigger_window_minutes: rfq.auction_config?.trigger_window_minutes || 10,
          extension_duration_minutes: rfq.auction_config?.extension_duration_minutes || 5, extension_trigger_type: rfq.auction_config?.extension_trigger_type || "ANY_BID",
        });
      }
    });
  }, [id]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const buildPayload = () => ({
    title: form.title, category: form.category, description: form.description, quantity: form.quantity, specifications: form.specifications,
    pickup_location: form.pickup_location, delivery_location: form.delivery_location, transit_window: form.transit_window,
    eligible_all_suppliers: form.eligible_all_suppliers,
    auction_config: {
      auction_start_time: new Date(form.auction_start_time).toISOString(),
      initial_closing_time: new Date(form.initial_closing_time).toISOString(),
      forced_closing_time: new Date(form.forced_closing_time).toISOString(),
      trigger_window_minutes: Number(form.trigger_window_minutes),
      extension_duration_minutes: Number(form.extension_duration_minutes),
      extension_trigger_type: form.extension_trigger_type,
    }
  });

  const validate = () => {
    if (new Date(form.forced_closing_time) <= new Date(form.initial_closing_time)) return "Forced Closing Time must be later than Initial Closing Time";
    if (new Date(form.initial_closing_time) <= new Date(form.auction_start_time)) return "Initial Closing Time must be after Auction Start Time";
    return "";
  };

  const save = async (e, publish = false) => {
    e.preventDefault();
    const v = validate(); if (v) { setError(v); return; }
    setSaving(true); setError("");
    try {
      let rfqId = id;
      if (isEdit) await api.put(`/rfqs/${id}`, buildPayload());
      else { const res = await api.post("/rfqs", buildPayload()); rfqId = res.data.id; }
      if (publish && rfqId) {
        await api.post(`/rfqs/${rfqId}/publish`);
        navigate(`/auctioneer/auctions/${rfqId}`);
      } else {
        navigate("/auctioneer/rfqs");
      }
    } catch (err) { setError(err?.response?.data?.detail || "Failed to save RFQ"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{isEdit ? "Edit RFQ (Draft)" : "Create RFQ"}</h1>
      <form onSubmit={save} className="space-y-5">
        <Card title="Requirement & Logistics Specifications">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="RFQ Title"><input className="inp" value={form.title} onChange={e=>set("title",e.target.value)} required /></Field>
            <Field label="Category"><input className="inp" value={form.category} onChange={e=>set("category",e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Product/Service Description"><textarea className="inp" rows={3} value={form.description} onChange={e=>set("description",e.target.value)} /></Field></div>
            <Field label="Quantity & Technical Specs"><input className="inp" value={form.quantity} onChange={e=>set("quantity",e.target.value)} placeholder="e.g. 20 Containers (20 ft)" /></Field>
            <Field label="Specifications"><input className="inp" value={form.specifications} onChange={e=>set("specifications",e.target.value)} /></Field>
            <Field label="Pickup Location"><input className="inp" value={form.pickup_location} onChange={e=>set("pickup_location",e.target.value)} /></Field>
            <Field label="Delivery Location"><input className="inp" value={form.delivery_location} onChange={e=>set("delivery_location",e.target.value)} /></Field>
            <Field label="Expected Transit Window"><input className="inp" value={form.transit_window} onChange={e=>set("transit_window",e.target.value)} placeholder="e.g. 3 - 4 Days" /></Field>
          </div>
        </Card>
        <Card title="Reverse English Auction Configuration">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Auction Start Time"><input type="datetime-local" className="inp" value={form.auction_start_time} onChange={e=>set("auction_start_time",e.target.value)} required /></Field>
            <Field label="Initial Closing Time"><input type="datetime-local" className="inp" value={form.initial_closing_time} onChange={e=>set("initial_closing_time",e.target.value)} required /></Field>
            <Field label="Forced Closing Time"><input type="datetime-local" className="inp" value={form.forced_closing_time} onChange={e=>set("forced_closing_time",e.target.value)} required /></Field>
            <Field label="Trigger Window X (minutes)"><input type="number" min="1" className="inp" value={form.trigger_window_minutes} onChange={e=>set("trigger_window_minutes",e.target.value)} required /></Field>
            <Field label="Extension Duration Y (minutes)"><input type="number" min="1" className="inp" value={form.extension_duration_minutes} onChange={e=>set("extension_duration_minutes",e.target.value)} required /></Field>
            <Field label="Extension Trigger Condition">
              <select className="inp" value={form.extension_trigger_type} onChange={e=>set("extension_trigger_type",e.target.value)}>
                <option value="ANY_BID">Any valid bid received during last X minutes</option>
                <option value="RANK_CHANGE">Any supplier ranking change during last X minutes</option>
                <option value="L1_CHANGE">Change in lowest bidder (L1) during last X minutes</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-slate-500 mt-3">Validation: Forced closing time must be later than initial closing time. Extensions never exceed forced close.</p>
        </Card>
        <Card title="Supplier Eligibility">
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.eligible_all_suppliers} onChange={()=>set("eligible_all_suppliers", true)} /> All Verified Suppliers in Category</label>
          <label className="flex items-center gap-2 text-sm mt-2 text-slate-500"><input type="radio" checked={!form.eligible_all_suppliers} onChange={()=>set("eligible_all_suppliers", false)} /> Select Specific Eligible Suppliers (MVP: treated as all eligible)</label>
        </Card>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{String(error)}</div>}
        <div className="flex gap-3">
          <button disabled={saving} onClick={(e)=>save(e,false)} className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-60">Save {isEdit?"Changes":"as Draft"}</button>
          <button type="button" disabled={saving} onClick={(e)=>save(e,true)} className="px-5 py-2.5 rounded-lg border border-primary text-primary bg-white font-medium disabled:opacity-60">Publish RFQ</button>
          <button type="button" onClick={()=>navigate("/auctioneer/rfqs")} className="px-5 py-2.5 rounded-lg border border-border bg-white">Cancel</button>
        </div>
      </form>
      <style>{`.inp{width:100%;border:1px solid #E2E8F0;border-radius:0.5rem;padding:0.625rem 0.75rem;background:#fff}.inp:focus{outline:none;border-color:#4F46E5;box-shadow:0 0 0 3px rgba(79,70,229,.15)}`}</style>
    </div>
  );
}
function Card({ title, children }) { return <div className="bg-white rounded-2xl border border-border shadow-card p-5"><h2 className="font-semibold mb-4">{title}</h2>{children}</div>; }
function Field({ label, children }) { return <label className="block"><div className="text-sm text-slate-700 mb-1">{label}</div>{children}</label>; }
