import { Link } from "react-router-dom";
import { PublicNav, Logo } from "../layouts/AppShell";

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <PublicNav />
      <section className="bg-midnight text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(79,70,229,0.35),transparent_45%)]" />
        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-indigo-200 mb-5">Enterprise Reverse English Auctions</span>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">Transparent Price Discovery & Real-Time RFQ Auctions</h1>
            <p className="text-slate-300 text-lg mb-8 max-w-xl">Publish RFQs, run live reverse auctions with automated L1 ranking and anti-sniping extensions, and award contracts with audit-backed supplier evaluation.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register?role=AUCTIONEER" className="px-5 py-3 rounded-lg bg-primary hover:bg-primary-hover font-medium">Start Procuring (Auctioneer)</Link>
              <Link to="/register?role=BIDDER" className="px-5 py-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 font-medium">Register as Supplier (Bidder)</Link>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 text-slate-900 shadow-xl border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-500">RFQ #RFQ-1045</div>
                <div className="font-semibold">Domestic Freight – Mumbai to Delhi</div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Live</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center mb-4">
              <div className="text-rose-600 text-sm font-medium">Time Remaining</div>
              <div className="text-3xl font-bold text-rose-600 tabular-nums">08:24</div>
              <div className="text-xs text-rose-500">+5 min extension on new lower bid</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <div className="text-xs text-amber-700">L1 Current Lowest</div>
                <div className="text-lg font-bold text-amber-800 tabular-nums">₹ 4,80,000</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <div className="text-xs text-emerald-700">Savings</div>
                <div className="text-lg font-bold text-emerald-800">↓ 12.7% Saved</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="bg-canvas py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">3-Step Auction Lifecycle</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Publish & Configure RFQ", desc: "Set route/item specs, trigger window X, extension Y, and forced close time for controlled reverse auctions." , c:"bg-indigo-50 text-indigo-700"},
              { title: "Real-Time Reverse Bidding", desc: "Live WebSocket leaderboard, automatic L1/L2/L3 ranking, and anti-sniping time extensions.", c:"bg-emerald-50 text-emerald-700"},
              { title: "Evaluate & Award Contract", desc: "Compare price, transit time, and verified track record; issue POs and post-delivery reviews.", c:"bg-amber-50 text-amber-700"},
            ].map((s,i)=>(
              <div key={i} className="bg-white rounded-2xl border border-border shadow-card p-6">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-semibold mb-4 ${s.c}`}>{i+1}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-600 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="rules" className="pb-16 bg-canvas">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <h3 className="font-semibold text-lg mb-3">Auction Rules & Privacy</h3>
            <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
              <li>Reverse English auction: suppliers compete by lowering total bid amounts.</li>
              <li>Configurable anti-sniping extensions (X/Y) with hard forced close cutoff.</li>
              <li>Transaction-safe ranking with complete bid history and audit logs.</li>
              <li>Strict bidder privacy: competitors never see other supplier identities or profiles.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
