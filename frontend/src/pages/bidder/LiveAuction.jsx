import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatINR } from "../../api/client";
import useAuctionSocket from "../../hooks/useAuctionSocket";

function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t); },[]);
  if (!to) return <span>--:--</span>;
  const diff = Math.max(0, new Date(to).getTime()-now);
  const m = Math.floor(diff/60000), s = Math.floor((diff%60000)/1000);
  return <span className="tabular-nums">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

export default function BidderLive() {
  const { id } = useParams();
  const [state, setState] = useState(null);
  const [myBids, setMyBids] = useState([]);
  const [form, setForm] = useState({ freight_charges: "", origin_charges: "", destination_charges: "", transit_time: "", quote_validity_days: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [s, h] = await Promise.all([api.get(`/auctions/${id}/state`), api.get(`/auctions/${id}/my-bids`)]);
    setState(s.data); setMyBids(h.data||[]);
  };
  useEffect(()=>{ load().catch(()=>{}); }, [id]);
  useAuctionSocket(id, () => { load().catch(()=>{}); });

  const cfg = state?.config; const rfq = state?.rfq;
  const currentL1 = state?.current_l1 ? Number(state.current_l1) : null;
  const myCurrent = state?.my_bid ? Number(state.my_bid.total_bid_amount) : null;
  const total = useMemo(()=> {
    const f = Number(form.freight_charges||0), o = Number(form.origin_charges||0), d = Number(form.destination_charges||0);
    return f + o + d;
  }, [form]);

  const validation = useMemo(()=> {
    if (!total || total <= 0) return { type: "error", text: "Enter charge breakup to calculate total bid." };
    if (myCurrent != null && total >= myCurrent) return { type: "error", text: "New bid must be strictly lower than your current bid." };
    if (currentL1 != null && total < currentL1) return { type: "ok", text: `↓ Lower than your last bid (${myCurrent!=null?formatINR(myCurrent):"—"}) & current L1 (${formatINR(currentL1)})` };
    if (currentL1 != null && total >= currentL1 && (myCurrent == null || total < myCurrent)) return { type: "warn", text: `↓ Valid lower revision — ranks below L1 (₹ ${(total - currentL1).toLocaleString("en-IN")} above L1)` };
    if (myCurrent == null && currentL1 == null) return { type: "ok", text: "This will be your initial quotation." };
    if (myCurrent == null && total < (currentL1 ?? Infinity)) return { type: "ok", text: `↓ Lower than current L1 (${formatINR(currentL1)})` };
    return { type: "ok", text: "Valid bid amount." };
  }, [total, myCurrent, currentL1]);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setMsg("");
    if (cfg?.status !== "ACTIVE") { setErr("Auction is not active."); return; }
    if (validation.type === "error") { setErr(validation.text); return; }
    setSubmitting(true);
    try {
      await api.post(`/auctions/${id}/bids`, {
        freight_charges: Number(form.freight_charges),
        origin_charges: Number(form.origin_charges || 0),
        destination_charges: Number(form.destination_charges || 0),
        total_bid_amount: total,
        transit_time: form.transit_time || null,
        quote_validity_days: form.quote_validity_days ? Number(form.quote_validity_days) : null,
      });
      setMsg("Bid submitted successfully.");
      setForm({ freight_charges: "", origin_charges: "", destination_charges: "", transit_time: form.transit_time, quote_validity_days: form.quote_validity_days });
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Failed to submit bid");
    } finally { setSubmitting(false); }
  };

  if (!state) return <div className="text-slate-500">Loading auction...</div>;
  const isClosed = cfg?.status === "CLOSED" || cfg?.status === "CANCELLED";
  const isActive = cfg?.status === "ACTIVE";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/bidder/available-auctions" className="text-slate-500 hover:text-slate-800">←</Link>
          <h1 className="text-2xl font-bold">Live Auction</h1>
          <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${isActive?"bg-[#DCFCE7] text-[#15803D]":"bg-slate-100 text-slate-700"}`}><span className={`h-2 w-2 rounded-full ${isActive?"bg-[#16A34A] animate-pulse":"bg-slate-400"}`} />{isActive?"Live – Reverse Auction":cfg?.status}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">{rfq.reference_id}</span>
          <span className="px-3 py-1 rounded-full bg-white border border-border">🚚 {rfq.category || "Freight Transportation"}</span>
        </div>
      </div>

      <div className="grid xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 bg-white rounded-2xl border border-border shadow-card p-5">
          <h2 className="text-xl font-bold">{rfq.title}</h2>
          <p className="text-slate-600 mt-1">"{rfq.description || `${rfq.quantity||""} ${rfq.pickup_location||""} to ${rfq.delivery_location||""}`}"</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div><span className="text-slate-500">Auction Window:</span> {new Date(cfg.auction_start_time).toLocaleString()} – {new Date(cfg.initial_closing_time).toLocaleTimeString()}</div>
            <div><span className="text-slate-500">Participating Suppliers:</span> {state.participating_suppliers}</div>
            <div className="px-3 py-2 rounded-lg bg-[#FEF9C3]"><span className="text-amber-800">🏆 Your Current Rank</span> <span className="font-bold text-amber-900">#{state.my_rank ?? "—"}</span></div>
            <div className="px-3 py-2 rounded-lg bg-[#DCFCE7]"><span className="text-emerald-800">↓ Current Lowest Bid (L1)</span> <span className="font-bold text-emerald-900 tabular-nums">{formatINR(state.current_l1)}</span></div>
          </div>
        </div>
        <div className="bg-[#FEF2F2] rounded-2xl border border-[#FCA5A5] p-5 text-center">
          <div className="text-[#DC2626] font-medium">Time Remaining</div>
          <div className="text-4xl font-bold text-[#DC2626] my-1">⏱ <Countdown to={cfg.current_closing_time} /></div>
          <div className="text-sm text-[#DC2626]">Closes at {new Date(cfg.current_closing_time).toLocaleTimeString()}</div>
          <div className="text-xs text-red-500 mt-2">+{cfg.extension_duration_minutes} min extension if a new lower bid is placed</div>
        </div>
      </div>

      <div className="grid xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="font-semibold mb-3">Bid Leaderboard</h3>
          <table className="w-full text-sm">
            <thead className="text-slate-500"><tr className="border-b border-border"><th className="text-left py-2">Rank</th><th className="text-left">Supplier</th><th className="text-left">Total Bid (₹)</th><th className="text-left">Bid Time</th></tr></thead>
            <tbody>
              {(state.leaderboard||[]).map(e => (
                <tr key={e.rank} className={`border-b border-border/60 ${e.is_self?"bg-[#EDE9FE]":""}`}>
                  <td className="py-2"><RankBadge rank={e.rank} /></td>
                  <td className={`font-medium ${e.is_self?"text-[#4F46E5]":""}`}>{e.supplier_name}</td>
                  <td className={`tabular-nums ${e.rank===1?"text-[#15803D] font-semibold":e.is_self?"text-[#4F46E5] font-semibold":""}`}>{formatINR(e.total_bid_amount)}</td>
                  <td className="text-slate-600">{new Date(e.last_bid_time).toLocaleTimeString()}</td>
                </tr>
              ))}
              {(!state.leaderboard||state.leaderboard.length===0) && <tr><td colSpan="4" className="py-6 text-center text-slate-500">No bids yet. Be the first to submit.</td></tr>}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-3">Competitor identities are anonymized for bidder privacy.</p>
        </div>

        <div className="xl:col-span-5 bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="font-semibold mb-3">Place a New Bid</h3>
          {isClosed ? (
            <div className="bg-slate-100 border border-border rounded-xl p-4 text-center text-slate-700 font-medium">Auction Closed</div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="bg-slate-50 border border-border rounded-xl p-3">
                <div className="text-xs text-slate-500">Auto-Calculated Total Bid Amount (₹)</div>
                <div className="text-2xl font-bold tabular-nums">{formatINR(total || 0)}</div>
                <div className={`text-xs mt-1 ${validation.type==="ok"?"text-emerald-700":validation.type==="warn"?"text-amber-700":"text-red-600"}`}>{validation.text}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Freight (₹)"><input type="number" min="0" step="0.01" className="inp" value={form.freight_charges} onChange={e=>setForm({...form,freight_charges:e.target.value})} required /></Field>
                <Field label="Origin (₹)"><input type="number" min="0" step="0.01" className="inp" value={form.origin_charges} onChange={e=>setForm({...form,origin_charges:e.target.value})} /></Field>
                <Field label="Destination (₹)"><input type="number" min="0" step="0.01" className="inp" value={form.destination_charges} onChange={e=>setForm({...form,destination_charges:e.target.value})} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Transit Time"><input className="inp" value={form.transit_time} onChange={e=>setForm({...form,transit_time:e.target.value})} placeholder="e.g. 3 - 4 Days" /></Field>
                <Field label="Quote Validity (Days)"><input type="number" min="1" className="inp" value={form.quote_validity_days} onChange={e=>setForm({...form,quote_validity_days:e.target.value})} placeholder="7" /></Field>
              </div>
              {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{String(err)}</div>}
              {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded p-2">{msg}</div>}
              <button disabled={submitting || validation.type==="error" || !isActive} className="w-full py-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-50">
                {submitting ? "Submitting..." : "🔨 Submit Bid"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <InfoCard title="Auction Details" rows={[["Quantity", rfq.quantity],["Route", `${rfq.pickup_location||"—"} → ${rfq.delivery_location||"—"}`],["Transit Time", rfq.transit_window || "—"],["Quote Validity", "Per your bid"]]} />
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h4 className="font-semibold mb-3">Auction Rules</h4>
          <ul className="space-y-2 text-sm text-slate-700">
            {["Reverse English Auction (lowest bid wins)", `Extension: +${cfg.extension_duration_minutes} minutes`, `Triggers: ${cfg.extension_trigger_type.replaceAll("_"," / ").toLowerCase()}`, `Forced close at ${new Date(cfg.forced_closing_time).toLocaleTimeString()}`].map(t=>(
              <li key={t} className="flex gap-2"><span className="text-emerald-600">✓</span><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <h4 className="font-semibold mb-3">My Bid History</h4>
          <table className="w-full text-sm"><thead className="text-slate-500"><tr className="border-b"><th className="text-left py-1">#</th><th className="text-left">Bid Amount (₹)</th><th className="text-left">Time</th></tr></thead><tbody>
            {myBids.map(b => (<tr key={b.id} className="border-b border-border/60"><td className="py-1">#{b.revision_number}</td><td className="tabular-nums">{formatINR(b.total_bid_amount)}</td><td>{new Date(b.created_at).toLocaleTimeString()}</td></tr>))}
            {myBids.length===0 && <tr><td colSpan="3" className="py-4 text-center text-slate-500">No bids yet.</td></tr>}
          </tbody></table>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid #E2E8F0;border-radius:0.5rem;padding:0.5rem 0.625rem;background:#fff}.inp:focus{outline:none;border-color:#4F46E5;box-shadow:0 0 0 3px rgba(79,70,229,.15)}`}</style>
    </div>
  );
}
function RankBadge({ rank }){ const cls = rank===1?"bg-[#FEF3C7] text-[#B45309]":rank===2?"bg-[#EDE9FE] text-[#4F46E5]":rank===3?"bg-[#FFEDD5] text-[#C2410C]":"bg-[#F1F5F9] text-[#475569]"; return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>#{rank}</span>;}
function InfoCard({ title, rows }){ return <div className="bg-white rounded-2xl border border-border shadow-card p-5"><h4 className="font-semibold mb-3">{title}</h4><div className="space-y-2 text-sm">{rows.map(([k,v])=> <div key={k} className="flex justify-between gap-4"><span className="text-slate-500">{k}</span><span className="font-medium text-right">{v ?? "—"}</span></div>)}</div></div>;}
function Field({ label, children }) { return <label className="block"><div className="text-xs text-slate-600 mb-1">{label}</div>{children}</label>; }
