import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../layouts/AppShell";

export default function AuthPage({ mode: initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") === "AUCTIONEER" ? "AUCTIONEER" : "BIDDER");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", company_name: "", contact_person: "", phone_number: "", business_category: "Freight Transportation", gstin: "", organization_name: "", department: "", approval_code: "", confirm: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(form.email, form.password);
        if (user.approval_status !== "APPROVED") { setPending(true); return; }
        navigate(user.role === "AUCTIONEER" ? "/auctioneer/dashboard" : "/bidder/dashboard");
      } else {
        if (form.password !== form.confirm) throw new Error("Passwords do not match");
        const payload = { email: form.email, password: form.password, role, full_name: form.full_name || form.contact_person || "User" };
        if (role === "BIDDER") {
          Object.assign(payload, { company_name: form.company_name, contact_person: form.contact_person, phone_number: form.phone_number, business_category: form.business_category, gstin: form.gstin });
        } else {
          Object.assign(payload, { organization_name: form.organization_name, department: form.department, approval_code: form.approval_code || undefined });
        }
        const user = await register(payload);
        if (user.approval_status === "PENDING") { setPending(true); }
        else { await login(form.email, form.password); navigate(role === "AUCTIONEER" ? "/auctioneer/dashboard" : "/bidder/dashboard"); }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  if (pending) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-md text-center">
          <div className="mb-4 flex justify-center"><Logo light={false} /></div>
          <h2 className="text-xl font-semibold mb-2">Pending Admin Approval</h2>
          <p className="text-slate-600 mb-6">Your Auctioneer account was created and is awaiting admin approval. Once approved, you can sign in with your credentials.</p>
          <Link to="/login" className="inline-block px-4 py-2 rounded-lg bg-primary text-white">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-canvas">
      <div className="hidden lg:flex w-[45%] bg-midnight text-white p-10 flex-col justify-between">
        <Link to="/"><Logo /></Link>
        <div>
          <h2 className="text-3xl font-bold mb-6">Comet Procurement Auctions</h2>
          <ul className="space-y-4 text-slate-200">
            {["Real-Time WebSocket Bidding", "Strict Bidder Privacy Protection", "Transaction-Safe L1 Rankings"].map(t => (
              <li key={t} className="flex items-start gap-3"><span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">✓</span><span>{t}</span></li>
            ))}
          </ul>
          <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-2">Live Auction Preview</div>
            <div className="flex items-center justify-between text-sm"><span>RFQ #RFQ-1045</span><span className="text-rose-300 font-semibold tabular-nums">08:24</span></div>
            <div className="text-emerald-300 font-semibold mt-1">L1 ₹ 4,80,000 · ↓12.7%</div>
          </div>
        </div>
        <div className="text-xs text-slate-400">© 2026 Comet</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-border shadow-card p-8">
          <div className="flex gap-6 border-b border-border mb-6">
            <button onClick={()=>setMode("login")} className={`pb-3 text-sm font-medium ${mode==="login"?"text-primary border-b-2 border-primary":"text-slate-500"}`}>Sign In</button>
            <button onClick={()=>setMode("register")} className={`pb-3 text-sm font-medium ${mode==="register"?"text-primary border-b-2 border-primary":"text-slate-500"}`}>Create Account</button>
          </div>
          {mode === "register" && (
            <div className="flex gap-2 mb-5">
              {["BIDDER","AUCTIONEER"].map(r => (
                <button key={r} type="button" onClick={()=>setRole(r)} className={`px-4 py-2 rounded-full text-sm border ${role===r?"bg-primary text-white border-primary":"bg-white text-slate-700 border-border"}`}>
                  {r === "BIDDER" ? "Bidder (Supplier)" : "Auctioneer (Buyer)"}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && role === "BIDDER" && (<>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Company Name" name="company_name" value={form.company_name} onChange={onChange} required />
                <Input label="Contact Person Name" name="contact_person" value={form.contact_person} onChange={onChange} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Work Email" name="email" type="email" value={form.email} onChange={onChange} required />
                <Input label="Phone Number" name="phone_number" value={form.phone_number} onChange={onChange} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Business/Service Category" name="business_category" value={form.business_category} onChange={onChange} />
                <Input label="GSTIN / Registration Number" name="gstin" value={form.gstin} onChange={onChange} />
              </div>
            </>)}
            {mode === "register" && role === "AUCTIONEER" && (<>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Full Name" name="full_name" value={form.full_name} onChange={onChange} required />
                <Input label="Organization Name" name="organization_name" value={form.organization_name} onChange={onChange} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Work Email" name="email" type="email" value={form.email} onChange={onChange} required />
                <Input label="Department" name="department" value={form.department} onChange={onChange} />
              </div>
              <Input label="Admin Approval Code / Invitation Token" name="approval_code" value={form.approval_code} onChange={onChange} placeholder="Enter code for instant approval (optional)" />
            </>)}
            {mode === "login" && (
              <Input label="Work Email" name="email" type="email" value={form.email} onChange={onChange} required />
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Password" name="password" type="password" value={form.password} onChange={onChange} required />
              {mode === "register" && <Input label="Confirm Password" name="confirm" type="password" value={form.confirm} onChange={onChange} required />}
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{String(error)}</div>}
            <button disabled={loading} className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium disabled:opacity-60">
              {loading ? "Please wait..." : (mode === "login" ? "Sign In" : "Create Account")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-700">{label}</span>
      <input {...props} className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
    </label>
  );
}
