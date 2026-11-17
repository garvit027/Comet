import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatINR } from "../../api/client";
import useAuctionSocket from "../../hooks/useAuctionSocket";

function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(()=>setNow(Date.now()), 1000); return ()=>clearInterval(t); }, []);
  if (!to) return <span>--:--</span>;
  const diff = Math.max(0, new Date(to).getTime() - now);
  const m = Math.floor(diff/60000), s = Math.floor((diff%60000)/1000);
  return <span className="tabular-nums">{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

export default function AuctioneerLive() {
  const { id } = useParams();
  const [state, setState] = useState(null);
  const [activity, setActivity] = useState([]);
  const [allBids, setAllBids] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [tab, setTab] = useState("details");
  const [msg, setMsg] = useState("");
  const [supplierDrawer, setSupplierDrawer] = useState(null);

  const load = async () => {
    const [s,a,ab,ex] = await Promise.all([
      api.get(`/auctions/${id}/state`),
      api.get(`/auctions/${id}/activity`),
      api.get(`/auctions/${id}/all-bids`).catch(()=>({data:[]})),
      api.get(`/auctions/${id}/extensions`).catch(()=>({data:[]})),
    ]);
    setState(s.data); setActivity(a.data || []); setAllBids(ab.data || []); setExtensions(ex.data || []);
  };
  useEffect(()=>{ load(); }, [id]);
  useAuctionSocket(id, () => { load(); });

  const cfg = state?.config; const rfq = state?.rfq;
  const doExtend = async () => { await api.post(`/auctions/${id}/extend-manual`); setMsg("Auction extended manually."); load(); };
  const doClose = async () => { if (!confirm("Force close this auction?")) return; await api.post(`/auctions/${id}/force-close`); setMsg("Auction force-closed."); load(); };
  const doCancel = async () => { if (!confirm("Cancel this auction?")) return; await api.post(`/auctions/${id}/cancel`); setMsg("Auction cancelled."); load(); };

  const openSupplier = async (entry) => {
    if (!entry.supplier_id) return;
    const [profile, bids] = await Promise.all([
      api.get(`/suppliers/${entry.supplier_id}`).catch(() => ({ data: null })),
      api.get(`/auctions/${id}/all-bids`).catch(() => ({ data: [] })),
    ]);
    const latest = (bids.data || []).find(b => b.supplier_id === entry.supplier_id);
    setSupplierDrawer({ entry, profile: profile.data, latest });
  };

  if (!state) return <div className="text-slate-500">Loading auction...</div>;
  const isActive = cfg?.status === "ACTIVE";
  const statusLabel = cfg?.status === "ACTIVE" ? "Active" : cfg?.status === "SCHEDULED" ? "Scheduled" : "Closed";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/auctioneer/rfqs" className="text-slate-500 hover:text-slate-800">←</Link>
        <h1 className="text-2xl font-bold">Live Auction – Monitor & Manage</h1>
        <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${isActive?"bg-[#DCFCE7] text-[#15803D]":"bg-slate-100 text-slate-700"}`}><span className={`h-2 w-2 rounded-full ${isActive?"bg-[#16A34A] animate-pulse":"bg-slate-400"}`} />{statusLabel}</span>
      </div>

      <div className="grid xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 bg-white rounded-2xl border border-border shadow-card p-5 flex flex-wrap justify-between gap-4">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-primary flex items-center justify-center text-xl">🚚</div>
            <div>
              <div className="text-xs text-slate-500">{rfq.reference_id}</div>
              <div className="text-xl font-bold">{rfq.title}</div>
              <div className="text-slate-600 text-sm">"{rfq.description || `${rfq.quantity || ""} ${rfq.pickup_location||""} to ${rfq.delivery_location||""}`}"</div>
            </div>
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            <div><span className="text-slate-500">Auction Window:</span> {new Date(cfg.auction_start_time).toLocaleString()} – {new Date(cfg.initial_closing_time).toLocaleTimeString()}</div>
            <div><span className="text-slate-500">Participating Suppliers:</span> {state.participating_suppliers}</div>
            <div><span className="text-slate-500">Forced Close:</span> {new Date(cfg.forced_closing_time).toLocaleTimeString()}</div>
          </div>
        </div>
        <div className="bg-[#FEF2F2] rounded-2xl border border-[#FCA5A5] p-5 text-center">
          <div className="text-[#DC2626] font-medium">Time Remaining</div>
          <div className="text-4xl font-bold text-[#DC2626] my-1">⏱ <Countdown to={cfg.current_closing_time} /></div>
          <div className="text-sm text-[#DC2626]">Closes at {new Date(cfg.current_closing_time).toLocaleTimeString()}</div>
          <div className="text-xs text-red-500 mt-2">+{cfg.extension_duration_minutes} min extension if {cfg.extension_trigger_type.replaceAll("_"," ").toLowerCase()}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI bg="bg-[#ECFDF5]" label="Current Lowest Bid (L1)" value={formatINR(state.current_l1)} valueClass="text-[#15803D]" icon="🏆" />
        <KPI bg="bg-[#EEF2FF]" label="Initial Best Quote" value={formatINR(state.initial_best_quote)} icon="🛡️" />
        <KPI bg="bg-[#ECFDF5]" label="Savings" value={state.savings_amount ? `${formatINR(state.savings_amount)} (${state.savings_percent ?? 0}%)` : "—"} valueClass="text-[#15803D]" icon="↓" />
        <KPI bg="bg-[#EFF6FF]" label="Total Bids" value={state.total_bids ?? 0} icon="≣" />
      </div>

      <div className="grid xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="font-semibold mb-3">Supplier Leaderboard</h3>
          <table className="w-full text-sm">
            <thead className="text-slate-500"><tr className="border-b border-border"><th className="text-left py-2">Rank</th><th className="text-left">Supplier</th><th className="text-left">Total Bid (₹)</th><th className="text-left">Last Bid Time</th></tr></thead>
            <tbody>
              {(state.leaderboard||[]).map(e => (
                <tr key={e.rank} className="border-b border-border/60">
                  <td className="py-2"><RankBadge rank={e.rank} /></td>
                  <td className="font-medium">{e.supplier_name}</td>
                  <td className={`tabular-nums ${e.rank===1?"text-[#15803D] font-semibold":""}`}>{formatINR(e.total_bid_amount)}</td>
                  <td className="text-slate-600">{new Date(e.last_bid_time).toLocaleTimeString()}</td>
                </tr>
              ))}
              {(!state.leaderboard||state.leaderboard.length===0) && <tr><td colSpan="4" className="py-6 text-center text-slate-500">No bids yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="xl:col-span-4 bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="font-semibold mb-3">Bid Trend</h3>
          <div className="h-64 flex items-end gap-2">
            {allBids.slice().reverse().slice(-12).map((b,i,arr)=> {
              const vals = arr.map(x=>Number(x.total_bid_amount));
              const max = Math.max(...vals,1), min = Math.min(...vals,0), range = Math.max(max-min,1);
              const h = 20 + ((Number(b.total_bid_amount)-min)/range)*160;
              return <div key={b.id} className="flex-1 flex flex-col items-center gap-1"><div className="w-full rounded-t bg-[#5B46F6]" style={{height:`${200-h+20}px`, opacity:0.15}} /><div className="w-full rounded-t bg-[#5B46F6]" style={{height:`${h}px`}} title={`${formatINR(b.total_bid_amount)} @ ${new Date(b.created_at).toLocaleTimeString()}`} /></div>;
            })}
            {allBids.length===0 && <div className="text-sm text-slate-500 m-auto">Bid trend appears after bids are placed.</div>}
          </div>
          <div className="text-xs text-slate-500 mt-2">Recent bid amounts (latest on right). Full charting can be extended with Recharts.</div>
        </div>
        <div className="xl:col-span-3 bg-white rounded-2xl border border-border shadow-card p-5">
          <h3 className="font-semibold mb-3">Auction Activity</h3>
          <div className="space-y-3 max-h-72 overflow-auto">
            {activity.slice(0,12).map(a => (
              <div key={a.id} className="text-sm border-l-2 border-indigo-200 pl-3">
                <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleTimeString()}</div>
                <div>{a.message}</div>
              </div>
            ))}
            {activity.length===0 && <div className="text-sm text-slate-500">No activity yet.</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <div className="flex gap-6 border-b border-border mb-4 text-sm">
          {[["details","Auction Details"],["config","Configuration"],["bids",`All Bids (${state.total_bids||0})`],["ext",`Extension History (${state.extensions_count||0})`]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} className={`pb-3 ${tab===k?"text-primary border-b-2 border-primary font-medium":"text-slate-500"}`}>{l}</button>
          ))}
        </div>
        {msg && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded p-2">{msg}</div>}
        {tab==="details" && (
          <div className="grid md:grid-cols-3 gap-4">
            <InfoCard title="Auction Details" rows={[["Quantity", rfq.quantity],["Route", `${rfq.pickup_location||"—"} → ${rfq.delivery_location||"—"}`],["Transit Time", rfq.transit_window || "—"],["Quote Validity", "As per bids"]]} />
            <InfoCard title="Auction Configuration" rows={[["Trigger Window (X)", `${cfg.trigger_window_minutes} minutes`],["Extension Duration (Y)", `${cfg.extension_duration_minutes} minutes`],["Extension Trigger", cfg.extension_trigger_type.replaceAll("_"," ").toLowerCase()],["Forced Close Time", new Date(cfg.forced_closing_time).toLocaleString()]]} />
            <div className="border border-border rounded-xl p-4 space-y-2">
              <h4 className="font-semibold mb-2">Auction Actions</h4>
              <button onClick={doExtend} disabled={!isActive} className="w-full py-2 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-medium disabled:opacity-50">Extend Manually (+{cfg.extension_duration_minutes} min)</button>
              <button onClick={doClose} disabled={cfg.status==="CLOSED"} className="w-full py-2 rounded-lg bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] font-medium disabled:opacity-50">Force Close Auction</button>
              <button onClick={doCancel} disabled={cfg.status==="CLOSED"} className="w-full py-2 rounded-lg bg-[#F8FAFC] text-[#334155] border border-border font-medium disabled:opacity-50">✕ Cancel Auction</button>
            </div>
          </div>
        )}
        {tab==="config" && <InfoCard title="Configuration & Rules" rows={[["Start", new Date(cfg.auction_start_time).toLocaleString()],["Initial Close", new Date(cfg.initial_closing_time).toLocaleString()],["Current Close", new Date(cfg.current_closing_time).toLocaleString()],["Forced Close", new Date(cfg.forced_closing_time).toLocaleString()],["Trigger Type", cfg.extension_trigger_type],["Window X", `${cfg.trigger_window_minutes} min`],["Extension Y", `${cfg.extension_duration_minutes} min`],["Eligible", "All verified suppliers (MVP)"]]} />}
        {tab==="bids" && (
          <div className="overflow-auto"><table className="w-full text-sm"><thead className="text-slate-500"><tr className="border-b"><th className="text-left py-2">Time</th><th className="text-left">Supplier</th><th className="text-left">Rev</th><th className="text-left">Freight</th><th className="text-left">Origin</th><th className="text-left">Destination</th><th className="text-left">Total</th><th className="text-left">Rank</th></tr></thead><tbody>
            {allBids.map(b => (<tr key={b.id} className="border-b border-border/60"><td className="py-2">{new Date(b.created_at).toLocaleString()}</td><td>{b.supplier_name}</td><td>#{b.revision_number}</td><td className="tabular-nums">{formatINR(b.freight_charges)}</td><td className="tabular-nums">{formatINR(b.origin_charges)}</td><td className="tabular-nums">{formatINR(b.destination_charges)}</td><td className="tabular-nums font-medium">{formatINR(b.total_bid_amount)}</td><td>{b.rank_at_time || "—"}</td></tr>))}
            {allBids.length===0 && <tr><td colSpan="8" className="py-6 text-center text-slate-500">No bids submitted.</td></tr>}
          </tbody></table></div>
        )}
        {tab==="ext" && (
          <div className="space-y-2">{extensions.map(e => (<div key={e.id} className="border border-border rounded-lg p-3 text-sm"><div className="font-medium">{e.reason}</div><div className="text-slate-600">{new Date(e.old_closing_time).toLocaleString()} → {new Date(e.new_closing_time).toLocaleString()} ({e.triggered_by})</div></div>))}{extensions.length===0 && <div className="text-sm text-slate-500">No extensions recorded.</div>}</div>
        )}
      </div>
      {cfg.status==="CLOSED" && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between"><div><div className="font-semibold text-indigo-900">Auction closed. Proceed to evaluation & award.</div><div className="text-sm text-indigo-700">Bidding is frozen and final rankings are available.</div></div><Link to={`/auctioneer/evaluation/${id}`} className="px-4 py-2 rounded-lg bg-primary text-white font-medium">Go to Evaluation</Link></div>}
    </div>
  );
}
function KPI({ bg,label,value,valueClass="text-slate-900",icon }){return <div className={`${bg} rounded-2xl p-4`}><div className="text-sm text-slate-600 flex items-center gap-2"><span>{icon}</span>{label}</div><div className={`text-xl font-bold mt-1 tabular-nums ${valueClass}`}>{value}</div></div>;}
function RankBadge({ rank }){ const cls = rank===1?"bg-[#FEF3C7] text-[#B45309]":rank===2?"bg-[#EDE9FE] text-[#4F46E5]":rank===3?"bg-[#FFEDD5] text-[#C2410C]":"bg-[#F1F5F9] text-[#475569]"; return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{rank===1?"L1":rank===2?"L2":rank===3?"L3":`#${rank}`}</span>;}
function InfoCard({ title, rows }){ return <div className="border border-border rounded-xl p-4"><h4 className="font-semibold mb-3">{title}</h4><div className="space-y-2 text-sm">{rows.map(([k,v])=> <div key={k} className="flex justify-between gap-4"><span className="text-slate-500">{k}</span><span className="font-medium text-right">{v ?? "—"}</span></div>)}</div></div>;}
