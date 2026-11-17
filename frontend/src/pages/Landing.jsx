import { Link } from "react-router-dom";
import { PublicNav } from "../layouts/AppShell";

const FEATURES = [
  {
    icon: "⚡",
    title: "Real-Time WebSocket Bidding",
    desc: "Suppliers compete live with instant rank updates — no polling, no delays.",
  },
  {
    icon: "🛡️",
    title: "Anti-Sniping Protection",
    desc: "Configurable time extensions prevent last-second bid dumping.",
  },
  {
    icon: "🔒",
    title: "Strict Bidder Privacy",
    desc: "Suppliers never see competitor identities or bid amounts — only their own rank.",
  },
  {
    icon: "📋",
    title: "Full Audit Trail",
    desc: "Every bid, extension, and award is logged with timestamps for compliance.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <PublicNav />

      {}
      <section className="bg-midnight text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(79,70,229,0.35),transparent_45%)]" />
        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-indigo-200 mb-5">
              Enterprise Reverse English Auctions
            </span>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              Transparent Price Discovery &amp; Real-Time RFQ Auctions
            </h1>
            <p className="text-slate-300 text-lg mb-8 max-w-xl">
              Publish RFQs, run live reverse auctions with automated L1 ranking and
              anti-sniping extensions, and award contracts with audit-backed supplier evaluation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register?role=AUCTIONEER" className="px-5 py-3 rounded-lg bg-primary hover:bg-primary-hover font-medium">
                Start Procuring (Auctioneer)
              </Link>
              <Link to="/register?role=BIDDER" className="px-5 py-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 font-medium">
                Register as Supplier (Bidder)
              </Link>
            </div>
          </div>

          {}
          <div className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 transition-colors duration-200"
              >
                <span className="text-2xl mt-0.5 shrink-0">{f.icon}</span>
                <div>
                  <div className="font-semibold text-white text-sm mb-0.5">{f.title}</div>
                  <div className="text-slate-400 text-sm leading-snug">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section id="how" className="bg-canvas py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">3-Step Auction Lifecycle</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Publish & Configure RFQ",  desc: "Set route/item specs, trigger window X, extension Y, and forced close time for controlled reverse auctions.",  c: "bg-indigo-50 text-indigo-700"  },
              { title: "Real-Time Reverse Bidding", desc: "Live WebSocket leaderboard, automatic L1/L2/L3 ranking, and anti-sniping time extensions.",                    c: "bg-emerald-50 text-emerald-700" },
              { title: "Evaluate & Award Contract", desc: "Compare price, transit time, and verified track record; issue POs and post-delivery reviews.",                   c: "bg-amber-50 text-amber-700"    },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border shadow-card p-6">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-semibold mb-4 ${s.c}`}>{i + 1}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-600 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section id="rules" className="pb-16 bg-canvas">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <h3 className="font-semibold text-lg mb-3">Auction Rules &amp; Privacy</h3>
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
