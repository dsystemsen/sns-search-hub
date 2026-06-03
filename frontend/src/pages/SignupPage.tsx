import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, signup } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

export function SignupPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({ email, password, company_name: company });
      await login(email, password);
      await refresh();
      navigate("/app/dashboard");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      setError(detail ? JSON.stringify(detail) : "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={onSubmit} className="auth-form">
        <h1>新規登録（14日無料トライアル）</h1>
        {error && <p className="error">{error}</p>}
        <label>
          会社名
          <input value={company} onChange={(e) => setCompany(e.target.value)} required />
        </label>
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          パスワード（8文字以上）
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "送信中..." : "アカウントを作成"}
        </button>
        <p>
          既にアカウントをお持ちの方は <Link to="/login">ログイン</Link>
        </p>
      </form>
    </div>
  );
}
