"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api-client";
import { formatMoney } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import Link from "next/link";

export default function AdminDashboardPage() {
  const currency = useAppStore((s) => s.currency);
  const exchangeRate = useAppStore((s) => s.exchangeRate);
  const toggleCurrency = useAppStore((s) => s.toggleCurrency);
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [profile, setProfile] = useState({ email: "", current_password: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest("/statistics"),
      apiRequest("/reports"),
      apiRequest("/alerts/low-stock"),
      apiRequest("/auth/me"),
    ])
      .then(([s, r, ls, me]: any) => {
        setStats(s); setReports(r); setLowStock(ls);
        setProfile((p) => ({ ...p, email: me.user.email }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setMessage(""); setError("");
    try {
      const res: any = await apiRequest("/auth/profile", { method: "PUT", body: JSON.stringify(profile) });
      setMessage(res.message || "Profil yangilandi");
      setProfile((p) => ({ ...p, current_password: "", password: "" }));
    } catch (e: any) { setError(e.message); }
  }

  const money = (v: number) => formatMoney(v, currency, exchangeRate);

  const statCards = [
    { label: "Jami buyurtma", value: stats?.total_orders || 0, icon: "📋", color: "var(--accent)", pct: null },
    { label: "Dilerlar", value: stats?.total_dealers || 0, icon: "🤝", color: "var(--blue)", pct: null },
    { label: "Ishchilar", value: stats?.total_workers || 0, icon: "👷", color: "var(--success)", pct: null },
    { label: "Materiallar", value: stats?.total_materials || 0, icon: "📦", color: "var(--warning)", pct: null },
  ];

  const orderFlow = [
    { label: "Kutilmoqda", value: stats?.pending_orders || 0, cls: "status-warning", pct: stats ? Math.round(((stats.pending_orders||0) / Math.max(stats.total_orders,1)) * 100) : 0 },
    { label: "Tasdiqlangan", value: stats?.approved_orders || 0, cls: "status-accent", pct: stats ? Math.round(((stats.approved_orders||0) / Math.max(stats.total_orders,1)) * 100) : 0 },
    { label: "Tayyorlanmoqda", value: stats?.preparing_orders || 0, cls: "status-blue", pct: stats ? Math.round(((stats.preparing_orders||0) / Math.max(stats.total_orders,1)) * 100) : 0 },
    { label: "Yetkazildi", value: stats?.delivered_orders || 0, cls: "status-success", pct: stats ? Math.round(((stats.delivered_orders||0) / Math.max(stats.total_orders,1)) * 100) : 0 },
  ];

  return (
    <AppShell
      role="admin"
      title="Dashboard"
      subtitle="Biznesingizning to'liq ko'rinishi."
      actions={
        <button className="button-secondary" type="button" onClick={toggleCurrency}>
          💱 {currency === "USD" ? "USD → UZS" : "UZS → USD"}
        </button>
      }
    >
      {loading ? (
        <div className="page-loader" style={{ minHeight: "50vh" }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            {statCards.map((s) => (
              <div key={s.label} className="card stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
                <div className="split-row">
                  <div className="mini-kpi">{s.label}</div>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                </div>
                <div className="metric-number" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="two-col" style={{ marginBottom: 16 }}>
            {/* Revenue card */}
            <div className="hero-card">
              <div className="split-row" style={{ marginBottom: 12 }}>
                <span className="pill" style={{ fontSize: 13, padding: "6px 12px" }}>💰 Daromadlar</span>
                <Link href="/admin/orders" className="button-secondary button" style={{ padding: "8px 16px", fontSize: 13 }}>
                  Buyurtmalar →
                </Link>
              </div>
              <div className="metric-number">{money(reports?.total_revenue || 0)}</div>
              <p className="muted" style={{ marginBottom: 16 }}>Haftalik: {money(reports?.weekly_revenue || 0)}</p>
              <div className="divider" />
              <div className="list-stack" style={{ marginTop: 12 }}>
                {orderFlow.map((row) => (
                  <div key={row.label}>
                    <div className="split-row" style={{ marginBottom: 4 }}>
                      <span className={`status-pill ${row.cls}`}>{row.label}</span>
                      <span className="muted"><strong style={{ color: "var(--text)" }}>{row.value}</strong> ta</span>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${row.pct}%`, opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile */}
            <div className="card">
              <h3 className="section-title">⚙️ Profil sozlamalari</h3>
              <div className="grid">
                {message && <div className="success-text">✓ {message}</div>}
                {error && <div className="error-text">✗ {error}</div>}
                <input className="field" placeholder="Email" value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
                <input className="field" placeholder="Yangi parol" type="password" value={profile.password}
                  onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))} />
                <input className="field" placeholder="Joriy parol" type="password" value={profile.current_password}
                  onChange={(e) => setProfile((p) => ({ ...p, current_password: e.target.value }))} />
                <button className="button" type="button" onClick={saveProfile}>Saqlash</button>
              </div>
            </div>
          </div>

          <div className="two-col" style={{ marginBottom: 16 }}>
            {/* Daily report */}
            <div className="card">
              <h3 className="section-title">📅 Oxirgi 7 kun</h3>
              <div className="data-table">
                <div className="data-row data-row-head">
                  <span>#</span><span>Kun</span><span>Daromad</span>
                </div>
                {(reports?.daily || []).map((day: any, i: number) => (
                  <div key={day.day} className="data-row">
                    <span className="tooltip-chip">{day.orders}</span>
                    <span className="mono" style={{ fontSize: 13 }}>{day.day}</span>
                    <strong style={{ fontSize: 14 }}>{money(day.revenue || 0)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Low stock */}
            <div className="card">
              <h3 className="section-title">⚠️ Kam qolgan materiallar</h3>
              <div className="list-stack">
                {lowStock.length ? lowStock.map((item) => (
                  <div key={item.id} className="split-row">
                    <div>
                      <strong style={{ fontSize: 15 }}>{item.name}</strong>
                      <div className="muted">{item.category_name || item.category}</div>
                    </div>
                    <span className="status-pill status-danger" style={{ fontSize: 13, padding: "6px 12px" }}>⚡ {item.stock_quantity} kv.m</span>
                  </div>
                )) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">✅</span>
                    Barcha materiallar yetarli.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="two-col">
            {/* Top materials */}
            <div className="card">
              <h3 className="section-title">🏆 Top materiallar</h3>
              <div className="list-stack">
                {(reports?.top_materials || []).map((item: any, i: number) => (
                  <div key={item.name} className="split-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="tooltip-chip">{i + 1}</span>
                      <div>
                        <strong style={{ fontSize: 15 }}>{item.name}</strong>
                        <div className="muted">{item.count} ta · {Number(item.total_sqm || 0).toFixed(1)} kv.m</div>
                      </div>
                    </div>
                    <strong style={{ fontSize: 15 }}>{money(item.total_price || 0)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Top dealers */}
            <div className="card">
              <h3 className="section-title">🤝 Top dilerlar</h3>
              <div className="list-stack">
                {(reports?.top_dealers || []).map((item: any, i: number) => (
                  <div key={item.name} className="split-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="tooltip-chip">{i + 1}</span>
                      <div>
                        <strong style={{ fontSize: 15 }}>{item.name}</strong>
                        <div className="muted">{item.orders} ta buyurtma</div>
                      </div>
                    </div>
                    <strong style={{ fontSize: 15 }}>{money(item.revenue || 0)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
