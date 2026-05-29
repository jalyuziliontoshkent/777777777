"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api-client";
import { allOrderStatuses, statusClasses, statusLabels } from "@/lib/constants";
import { calculateItemPrice, formatDateTime, formatMoney } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type { Category, Material, Order, User } from "@/types/app";

type DraftItem = {
  material_id: string;
  material_name: string;
  width: string;
  height: string;
  quantity: number;
  price_per_sqm: number;
};

const STEP_LABELS = ["Diler", "Material", "O'lcham", "Tasdiqlash"];

export default function AdminOrdersPage() {
  const currency = useAppStore((s) => s.currency);
  const exchangeRate = useAppStore((s) => s.exchangeRate);

  const [orders, setOrders] = useState<Order[]>([]);
  const [dealers, setDealers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [dealerId, setDealerId] = useState("");
  const [notes, setNotes] = useState("");
  const [unit, setUnit] = useState<"m" | "cm">("m");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [materialSearch, setMaterialSearch] = useState("");
  const [dealerSearch, setDealerSearch] = useState("");

  function loadPage() {
    Promise.all([
      apiRequest<Order[]>("/orders"),
      apiRequest<User[]>("/dealers"),
      apiRequest<Category[]>("/categories"),
      apiRequest<Material[]>("/materials"),
    ]).then(([o, d, c, m]) => {
      setOrders(o); setDealers(d); setCategories(c); setMaterials(m);
    });
  }

  useEffect(() => { loadPage(); }, []);

  const filteredOrders = useMemo(() =>
    activeFilter === "all" ? orders : orders.filter((o) => o.status === activeFilter),
    [orders, activeFilter]
  );

  const filteredMaterials = useMemo(() => {
    let r = materials;
    if (selectedCategory !== "all") r = r.filter((m) => m.category_id === selectedCategory);
    if (materialSearch.trim()) {
      const s = materialSearch.toLowerCase();
      r = r.filter((m) => m.name.toLowerCase().includes(s) || (m.category_name || m.category || "").toLowerCase().includes(s));
    }
    return r;
  }, [materials, selectedCategory, materialSearch]);

  const filteredDealers = useMemo(() => {
    if (!dealerSearch.trim()) return dealers;
    const s = dealerSearch.toLowerCase();
    return dealers.filter((d) => d.name.toLowerCase().includes(s) || (d.email || "").toLowerCase().includes(s));
  }, [dealers, dealerSearch]);

  const selectedDealer = useMemo(() => dealers.find((d) => d.id === dealerId) || null, [dealers, dealerId]);

  const totals = useMemo(() => {
    const pending = orders.filter((o) => o.status === "kutilmoqda").length;
    const inProd = orders.filter((o) => ["tasdiqlangan", "tayyorlanmoqda"].includes(o.status)).length;
    const revenue = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    return { pending, inProd, revenue };
  }, [orders]);

  const draftTotal = useMemo(() =>
    draftItems.reduce((s, item) => s + calculateItemPrice(+item.width, +item.height, +item.price_per_sqm, item.quantity).price, 0),
    [draftItems]
  );

  async function updateStatus(orderId: string, status: string, reason = "") {
    await apiRequest(`/orders/${orderId}/status`, {
      method: "PUT", body: JSON.stringify({ status, rejection_reason: reason }),
    });
    setSelectedOrder(null); setRejectionReason(""); loadPage();
  }

  async function exportOrders() {
    const blob = await apiRequest<Blob>("/reports/export-orders");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "buyurtmalar.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  function addItem() {
    if (!activeMaterial) return;
    const wM = unit === "cm" ? +width / 100 : +width;
    const hM = unit === "cm" ? +height / 100 : +height;
    const qty = Math.max(1, +quantity || 1);
    if (wM <= 0 || hM <= 0) { setError("O'lchamlarni to'g'ri kiriting."); return; }
    setDraftItems((prev) => [...prev, {
      material_id: activeMaterial.id, material_name: activeMaterial.name,
      width: String(wM), height: String(hM), quantity: qty,
      price_per_sqm: +activeMaterial.price_per_sqm,
    }]);
    setError(""); setWidth(""); setHeight(""); setQuantity("1");
  }

  async function createOrder() {
    if (!dealerId) { setError("Diler tanlanmagan."); return; }
    if (!draftItems.length) { setError("Kamida bitta material qo'shing."); return; }
    setCreating(true); setError(""); setFeedback("");
    try {
      await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          dealer_id: dealerId,
          items: draftItems.map((i) => ({ material_id: i.material_id, material_name: i.material_name, width: +i.width, height: +i.height, quantity: +i.quantity, price_per_sqm: +i.price_per_sqm })),
          notes,
        }),
      });
      setDealerId(""); setDraftItems([]); setActiveMaterial(null);
      setWidth(""); setHeight(""); setQuantity("1"); setNotes("");
      setFeedback("✅ Buyurtma muvaffaqiyatli yaratildi!");
      setShowWizard(false); setStep(0); loadPage();
    } catch (e: any) { setError(e.message || "Xatolik yuz berdi."); }
    finally { setCreating(false); }
  }

  const money = (v: number) => formatMoney(v, currency, exchangeRate);

  function openWizard() { setShowWizard(true); setStep(0); setFeedback(""); setError(""); }
  function closeWizard() { setShowWizard(false); }

  return (
    <AppShell
      role="admin"
      title="Buyurtmalar"
      subtitle="Buyurtmalarni boshqaring va yangi buyurtma yarating."
      actions={
        <>
          <button className={showWizard ? "button-secondary" : "button"} type="button" onClick={showWizard ? closeWizard : openWizard}>
            {showWizard ? "✕ Yopish" : "＋ Yangi buyurtma"}
          </button>
          <button className="button-secondary" type="button" onClick={exportOrders}>
            📊 Excel
          </button>
        </>
      }
    >
      {/* Summary strip */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="hero-card">
          <div className="mini-kpi">Jami buyurtmalar</div>
          <div className="metric-number">{orders.length}</div>
        </div>
        <div className="card">
          <div className="mini-kpi">⏳ Kutilmoqda</div>
          <div className="metric-number" style={{ color: "var(--warning)" }}>{totals.pending}</div>
        </div>
        <div className="card">
          <div className="mini-kpi">⚙️ Ishlab chiqarishda</div>
          <div className="metric-number" style={{ color: "var(--blue)" }}>{totals.inProd}</div>
        </div>
        <div className="card">
          <div className="mini-kpi">💰 Umumiy summa</div>
          <div className="metric-number" style={{ fontSize: 22 }}>{money(totals.revenue)}</div>
        </div>
      </div>

      {feedback && <div className="success-text animate-fade-in" style={{ marginBottom: 12 }}>{feedback}</div>}

      {/* ── STEP WIZARD ── */}
      {showWizard && (
        <div className="card animate-fade-up" style={{ marginBottom: 16 }}>
          <div className="split-row" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Yangi buyurtma yaratish</h3>
            {selectedDealer && (
              <span className="pill">🤝 {selectedDealer.name}</span>
            )}
          </div>

          {/* Step tabs */}
          <div className="wizard-steps">
            {STEP_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                className={`wizard-step ${step === i ? "active" : ""} ${
                  (i === 0 && dealerId) || (i === 1 && activeMaterial) || (i === 2 && draftItems.length > 0) ? "done" : ""
                }`}
                onClick={() => setStep(i)}
              >
                <span className="wizard-step-num">{
                  (i === 0 && dealerId) || (i === 1 && activeMaterial) || (i === 2 && draftItems.length > 0) ? "✓" : i + 1
                }</span>
                <span className="step-label">{label}</span>
              </button>
            ))}
          </div>

          {error && <div className="error-text" style={{ marginBottom: 12 }}>✗ {error}</div>}

          {/* STEP 0: Diler */}
          {step === 0 && (
            <div className="animate-fade-up">
              <input className="field" style={{ marginBottom: 10 }} placeholder="🔍 Diler qidirish..."
                value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} />
              <div className="list-stack" style={{ maxHeight: 320, overflowY: "auto" }}>
                {filteredDealers.map((d) => (
                  <button key={d.id} type="button"
                    className={`dealer-card ${dealerId === d.id ? "selected-card" : ""}`}
                    style={{ textAlign: "left", width: "100%" }}
                    onClick={() => { setDealerId(d.id); setStep(1); }}
                  >
                    <div className="split-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {d.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13 }}>{d.name}</strong>
                          <div className="muted">{d.email}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="mini-kpi">Qarz</div>
                        <strong style={{ fontSize: 13, color: d.debt > 0 ? "var(--danger)" : "var(--success)" }}>
                          {money(d.debt || 0)}
                        </strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {dealerId && (
                <button className="button" style={{ marginTop: 12, width: "100%" }} type="button" onClick={() => setStep(1)}>
                  Keyingi → Material tanlash
                </button>
              )}
            </div>
          )}

          {/* STEP 1: Material */}
          {step === 1 && (
            <div className="animate-fade-up">
              <div className="toolbar">
                <button type="button" className={selectedCategory === "all" ? "button" : "button-ghost"}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() => setSelectedCategory("all")}>Barchasi</button>
                {categories.map((c) => (
                  <button key={c.id} type="button"
                    className={selectedCategory === c.id ? "button" : "button-ghost"}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => setSelectedCategory(c.id)}>{c.name}</button>
                ))}
              </div>
              <input className="field" style={{ marginBottom: 10 }} placeholder="🔍 Material qidirish..."
                value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} />
              <div className="list-stack" style={{ maxHeight: 320, overflowY: "auto" }}>
                {filteredMaterials.map((m) => (
                  <button key={m.id} type="button"
                    className={`material-card ${activeMaterial?.id === m.id ? "selected-card" : ""}`}
                    style={{ textAlign: "left", width: "100%" }}
                    onClick={() => { setActiveMaterial(m); setStep(2); }}
                  >
                    <div className="split-row">
                      <div>
                        <strong style={{ fontSize: 13 }}>{m.name}</strong>
                        <div className="muted">{m.category_name || m.category}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: "var(--accent)" }}>{money(m.price_per_sqm)}</strong>
                        <div className="muted">{m.stock_quantity} kv.m qoldiq</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="split-row" style={{ marginTop: 12 }}>
                <button className="button-ghost button" type="button" onClick={() => setStep(0)}>← Orqaga</button>
                {activeMaterial && (
                  <button className="button" type="button" onClick={() => setStep(2)}>Keyingi → O'lcham</button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: O'lcham */}
          {step === 2 && (
            <div className="animate-fade-up">
              <div className="two-col" style={{ gap: 12 }}>
                <div>
                  {activeMaterial && (
                    <div className="hero-card" style={{ marginBottom: 12 }}>
                      <span className="pill">{activeMaterial.category_name || activeMaterial.category}</span>
                      <h4 style={{ margin: "8px 0 4px" }}>{activeMaterial.name}</h4>
                      <div className="muted">{money(activeMaterial.price_per_sqm)} / kv.m</div>
                      {activeMaterial.image_url && (
                        <div className="material-preview" style={{ marginTop: 10, backgroundImage: `url(${activeMaterial.image_url})` }} />
                      )}
                    </div>
                  )}
                  <div className="split-row" style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>O'lchov birligi:</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className={unit === "m" ? "button" : "button-ghost"} style={{ padding: "6px 14px" }} onClick={() => setUnit("m")}>m</button>
                      <button type="button" className={unit === "cm" ? "button" : "button-ghost"} style={{ padding: "6px 14px" }} onClick={() => setUnit("cm")}>cm</button>
                    </div>
                  </div>
                  <div className="three-col" style={{ gap: 8, marginBottom: 10 }}>
                    <input className="field" placeholder={`En (${unit})`} value={width} onChange={(e) => setWidth(e.target.value)} />
                    <input className="field" placeholder={`Bo'yi (${unit})`} value={height} onChange={(e) => setHeight(e.target.value)} />
                    <input className="field" placeholder="Soni" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  {width && height && activeMaterial && (
                    <div className="info-text" style={{ marginBottom: 10 }}>
                      💡 Narx: ~{money(calculateItemPrice(
                        unit === "cm" ? +width/100 : +width,
                        unit === "cm" ? +height/100 : +height,
                        +activeMaterial.price_per_sqm, +quantity || 1
                      ).price)}
                    </div>
                  )}
                  <button className="button" style={{ width: "100%" }} type="button" onClick={addItem}>
                    ＋ Savatga qo'shish
                  </button>
                </div>

                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🛒 Savat ({draftItems.length})</h4>
                  <div className="list-stack" style={{ maxHeight: 260, overflowY: "auto" }}>
                    {draftItems.length ? draftItems.map((item, idx) => {
                      const r = calculateItemPrice(+item.width, +item.height, +item.price_per_sqm, item.quantity);
                      return (
                        <div key={idx} className="order-item">
                          <div className="split-row">
                            <div>
                              <strong style={{ fontSize: 12 }}>{item.material_name}</strong>
                              <div className="muted">{item.width}×{item.height}m · {item.quantity} dona · {r.billableArea}m²</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <strong style={{ fontSize: 13 }}>{money(r.price)}</strong>
                              <button className="button-danger" style={{ padding: "4px 8px", fontSize: 11 }} type="button"
                                onClick={() => setDraftItems((p) => p.filter((_, i) => i !== idx))}>✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="empty-state"><span className="empty-state-icon">🛒</span>Bo'sh</div>
                    )}
                  </div>
                  {draftItems.length > 0 && (
                    <div className="split-row" style={{ marginTop: 10, padding: "10px", background: "var(--accent-bg)", borderRadius: "var(--radius)" }}>
                      <span style={{ fontWeight: 600 }}>Jami:</span>
                      <strong style={{ color: "var(--accent)", fontSize: 16 }}>{money(draftTotal)}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="split-row" style={{ marginTop: 12 }}>
                <button className="button-ghost button" type="button" onClick={() => setStep(1)}>← Orqaga</button>
                {draftItems.length > 0 && (
                  <button className="button" type="button" onClick={() => setStep(3)}>Keyingi → Tasdiqlash</button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 3 && (
            <div className="animate-fade-up">
              <div className="two-col" style={{ marginBottom: 14 }}>
                <div className="hero-card">
                  <div className="mini-kpi">Diler</div>
                  <strong style={{ fontSize: 15 }}>{selectedDealer?.name}</strong>
                  <div className="muted">{selectedDealer?.email}</div>
                </div>
                <div className="card" style={{ background: "var(--accent-bg)", border: "1px solid rgba(200,95,45,0.2)" }}>
                  <div className="mini-kpi">Yakuniy summa</div>
                  <div className="metric-number" style={{ color: "var(--accent)" }}>{money(draftTotal)}</div>
                  <div className="muted">{draftItems.length} ta pozitsiya</div>
                </div>
              </div>

              <div className="list-stack" style={{ marginBottom: 14 }}>
                {draftItems.map((item, idx) => {
                  const r = calculateItemPrice(+item.width, +item.height, +item.price_per_sqm, item.quantity);
                  return (
                    <div key={idx} className="order-item">
                      <div className="split-row">
                        <div>
                          <strong style={{ fontSize: 13 }}>{item.material_name}</strong>
                          <div className="muted">{item.width}×{item.height}m · {item.quantity} dona · {r.billableArea}m²</div>
                        </div>
                        <strong>{money(r.price)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              <textarea className="textarea" placeholder="Buyurtma izohi (ixtiyoriy)"
                value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 12 }} />

              <div className="split-row">
                <button className="button-ghost button" type="button" onClick={() => setStep(2)}>← Orqaga</button>
                <button className="button" type="button" onClick={createOrder} disabled={creating} style={{ flex: 1 }}>
                  {creating ? "⏳ Saqlanmoqda..." : "✅ Buyurtmani yaratish"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="toolbar">
        {["all", ...allOrderStatuses].map((status) => (
          <button key={status} type="button"
            className={status === activeFilter ? "button" : "button-ghost"}
            style={{ fontSize: 12, padding: "7px 12px" }}
            onClick={() => setActiveFilter(status)}>
            {status === "all" ? "Barchasi" : statusLabels[status]}
          </button>
        ))}
      </div>

      {/* ── Orders list ── */}
      <div className="list-stack">
        {filteredOrders.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">📋</span>
            Buyurtmalar topilmadi.
          </div>
        )}
        {filteredOrders.map((order) => (
          <button key={order.id} type="button"
            className="order-item selected-order-button"
            style={{ textAlign: "left", width: "100%" }}
            onClick={() => setSelectedOrder(order)}
          >
            <div className="split-row">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="pill mono">#{order.order_code}</span>
                  <span className={`status-pill ${statusClasses[order.status]}`}>{statusLabels[order.status]}</span>
                </div>
                <strong style={{ fontSize: 14 }}>{order.dealer_name}</strong>
                <div className="muted">{formatDateTime(order.created_at)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: 18, color: "var(--accent)" }}>{money(order.total_price)}</strong>
                <div className="muted">{order.items.length} ta pozitsiya</div>
              </div>
            </div>
            {order.items.length > 0 && (
              <div className="order-items" style={{ marginTop: 8 }}>
                {order.items.slice(0, 3).map((item, i) => (
                  <span key={i} className="chip">{item.material_name} {item.width}×{item.height}m</span>
                ))}
                {order.items.length > 3 && <span className="chip">+{order.items.length - 3} ta</span>}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── Order detail panel ── */}
      {selectedOrder && (
        <div className="card animate-fade-up" style={{ marginTop: 16 }}>
          <div className="split-row" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pill mono">#{selectedOrder.order_code}</span>
              <span className={`status-pill ${statusClasses[selectedOrder.status]}`}>{statusLabels[selectedOrder.status]}</span>
            </div>
            <button className="button-ghost button" type="button" onClick={() => setSelectedOrder(null)}>✕ Yopish</button>
          </div>

          <div className="two-col" style={{ marginBottom: 14 }}>
            <div>
              <div className="mini-kpi">Diler</div>
              <strong>{selectedOrder.dealer_name}</strong>
              <div className="muted">{formatDateTime(selectedOrder.created_at)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mini-kpi">Jami summa</div>
              <strong style={{ fontSize: 20, color: "var(--accent)" }}>{money(selectedOrder.total_price)}</strong>
            </div>
          </div>

          {selectedOrder.notes && (
            <div className="info-text" style={{ marginBottom: 12 }}>📝 {selectedOrder.notes}</div>
          )}

          <div className="list-stack" style={{ marginBottom: 14 }}>
            {selectedOrder.items.map((item, i) => (
              <div key={i} className="material-card">
                <div className="split-row">
                  <div>
                    <strong style={{ fontSize: 13 }}>{item.material_name}</strong>
                    <div className="muted">{item.width}×{item.height}m · {item.quantity} dona · {item.sqm}m²</div>
                    {item.assigned_worker_name && (
                      <span className="status-pill status-blue" style={{ marginTop: 6 }}>👷 {item.assigned_worker_name}</span>
                    )}
                  </div>
                  <strong>{money(item.price || 0)}</strong>
                </div>
              </div>
            ))}
          </div>

          {selectedOrder.status === "kutilmoqda" && (
            <div className="grid" style={{ gap: 10 }}>
              <div className="inline-actions">
                <button className="button" type="button" onClick={() => updateStatus(selectedOrder.id, "tasdiqlangan")}>
                  ✅ Tasdiqlash
                </button>
                <button className="button-danger" type="button"
                  onClick={() => rejectionReason && updateStatus(selectedOrder.id, "rad_etilgan", rejectionReason)}>
                  ✕ Rad etish
                </button>
              </div>
              <textarea className="textarea" placeholder="Rad etish sababi..." value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)} />
            </div>
          )}

          {selectedOrder.status === "tasdiqlangan" && (
            <button className="button" type="button" onClick={() => updateStatus(selectedOrder.id, "tayyorlanmoqda")}>
              ⚙️ Tayyorlashga o'tkazish
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
