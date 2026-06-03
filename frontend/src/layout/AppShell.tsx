import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

const navItems = [
  { to: "/app/dashboard", label: "ダッシュボード" },
  { to: "/app/channels", label: "チャンネル" },
  { to: "/app/competitors", label: "競合分析" },
  { to: "/app/calendar", label: "リリースカレンダー" },
  { to: "/app/comments", label: "コメント管理" },
  { to: "/app/keywords", label: "キーワード分析" },
  { to: "/app/imports", label: "CSVインポート" },
  { to: "/app/billing", label: "プラン・請求" },
  { to: "/app/team", label: "チーム" },
  { to: "/app/settings", label: "設定" },
];

export function AppShell() {
  const { user, tenant, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="brand">YT Analytics</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="メニュー"
          >
            ☰
          </button>
          <div className="tenant-name">{tenant?.name ?? "..."}</div>
          <div className="user-info">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="テーマを切替"
              title={theme === "dark" ? "ライトモードへ" : "ダークモードへ"}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <span>{user?.email}</span>
            <button onClick={signOut} className="link-button">
              ログアウト
            </button>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
