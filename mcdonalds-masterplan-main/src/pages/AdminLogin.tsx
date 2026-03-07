import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        await api.post("/auth/register", { email, password });
        toast.success("Account created! Now sign in to continue.");
        setMode("login");
        setLoading(false);
        return;
      }

      const data = await api.post("/auth/login", { email, password });
      api.setToken(data.access_token);

      toast.success("Welcome back, Admin!");
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message || "Operation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-primary" size={28} />
          </div>
          <h1 className="font-display text-3xl text-gradient-gold">ADMIN LOGIN</h1>
          <p className="text-muted-foreground text-sm mt-2">The Last McDonald's Burger — Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="admin@thelastburger.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> {mode === "signup" ? "Creating..." : "Signing in..."}</> : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <a href="/" className="hover:text-primary transition-colors">← Back to site</a>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
