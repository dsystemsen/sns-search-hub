import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { login } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { AuroraBackground } from "@/components/ui/aurora-background";

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      await refresh();
      navigate("/app/dashboard");
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex w-full max-w-sm justify-center px-4"
      >
      <form onSubmit={onSubmit} className="auth-form">
        <h1>ログイン</h1>
        {error && <p className="error">{error}</p>}
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "ログイン中..." : "ログイン"}
        </button>
        <p>
          アカウントがない場合は <Link to="/signup">新規登録</Link>
        </p>
      </form>
      </motion.div>
    </AuroraBackground>
  );
}
