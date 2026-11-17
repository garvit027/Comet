import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../layouts/AppShell";

export default function AuthPage({ mode: initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") === "AUCTIONEER" ? "AUCTIONEER" : "BIDDER");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", company_name: "", contact_person: "", phone_number: "", business_category: "Freight Transportation", organization_name: "", department: "", confirm: "" });
  const [error, setError] = useState("");
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
        navigate(user.role === "AUCTIONEER" ? "/auctioneer/dashboard" : "/bidder/dashboard");
      } else {
        if (form.password !== form.confirm) throw new Error("Passwords do not match");
        const payload = { email: form.email, password: form.password, role, full_name: form.full_name || form.contact_person || "User" };
        if (role === "BIDDER") {
          Object.assign(payload, { company_name: form.company_name, contact_person: form.contact_person, phone_number: form.phone_number, business_category: form.business_category });
        } else {
          Object.assign(payload, { organization_name: form.organization_name, department: form.department });
        }
        await register(payload);
        await login(form.email, form.password);
        navigate(role === "AUCTIONEER" ? "/auctioneer/dashboard" : "/bidder/dashboard");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => `${d.loc?.slice(-1)[0] || 'Field'}: ${d.msg}`).join(", ")
        : (typeof detail === "string" ? detail : (err.message || "Something went wrong"));
      setError(msg);
    } finally { setLoading(false); }
  };


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
              <Input label="Business/Service Category" name="business_category" value={form.business_category} onChange={onChange} />
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
