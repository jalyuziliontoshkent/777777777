"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api-client";
import { allOrderStatuses, statusClasses, statusLabels } from "@/lib/constants";
import { calculateItemPrice, formatDateTime, formatMoney, toNumber } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type { Category, Material, Order, User } from "@/types/app";

type DraftItem = {
  material_id: string;
  material_name: string;
  width: number;
  height: number;
  quantity: number;
  price_per_sqm: number;
};

type OrderFilter = "all" | (typeof allOrderStatuses)[number];

const orderFilters: OrderFilter[] = ["all", ...allOrderStatuses];

export default function AdminOrdersPage() {
  const currency = useAppStore((state) => state.currency);
  const exchangeRate = useAppStore((state) => state.exchangeRate);

  const [orders, setOrders] = useState<Order[]>([]);
  const [dealers, setDealers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [dealerId, setDealerId] = useState("");
  const [dealerSearch, setDealerSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [unit, setUnit] = useState<"m" | "cm">("m");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);

  async function loadPage() {
    try {
      const [ordersData, dealersData, categoriesData, materialsData] = await Promise.all([
        apiRequest<Order[]>("/orders"),
        apiRequest<User[]>("/dealers"),
        apiRequest<Category[]>("/categories"),
        apiRequest<Material[]>("/materials"),
      ]);

      setOrders(ordersData);
      setDealers(dealersData);
      setCategories(categoriesData);
      setMaterials(materialsData);
    } catch (loadError: any) {
      setError(loadError?.message || "Ma'lumotlarni yuklab bo'lmadi.");
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return orders;
    return orders.filter((order) => order.status === activeFilter);
  }, [orders, activeFilter]);

  const filteredDealers = useMemo(() => {
    if (!dealerSearch.trim()) return dealers;
    const query = dealerSearch.toLowerCase();
    return dealers.filter((dealer) => {
      return dealer.name.toLowerCase().includes(query) || (dealer.email || "").toLowerCase().includes(query);
    });
  }, [dealers, dealerSearch]);

  const filteredMaterials = useMemo(() => {
    let list = materials;

    if (selectedCategory !== "all") {
      list = list.filter((material) => material.category_id === selectedCategory);
    }

    if (materialSearch.trim()) {
      const query = materialSearch.toLowerCase();
      list = list.filter((material) => {
        return (
          material.name.toLowerCase().includes(query) ||
          (material.category_name || material.category || "").toLowerCase().includes(query)
        );
      });
    }

    return list;
  }, [materials, selectedCategory, materialSearch]);

  const selectedDealer = useMemo(
    () => dealers.find((dealer) => dealer.id === dealerId) || null,
    [dealers, dealerId]
  );

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId) || null,
    [materials, selectedMaterialId]
  );

  const stats = useMemo(() => {
    const pending = orders.filter((order) => order.status === "kutilmoqda").length;
    const active = orders.filter((order) => ["tasdiqlangan", "tayyorlanmoqda"].includes(order.status)).length;
    const delivered = orders.filter((order) => order.status === "yetkazildi").length;
    const revenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

    return { pending, active, delivered, revenue };
  }, [orders]);

  const draftTotal = useMemo(() => {
    return draftItems.reduce((sum, item) => {
      return sum + calculateItemPrice(item.width, item.height, item.price_per_sqm, item.quantity).price;
    }, 0);
  }, [draftItems]);

  const currentItemPrice = useMemo(() => {
    if (!selectedMaterial) return 0;

    const widthValue = unit === "cm" ? toNumber(width) / 100 : toNumber(width);
    const heightValue = unit === "cm" ? toNumber(height) / 100 : toNumber(height);
    const quantityValue = Math.max(1, Math.floor(toNumber(quantity) || 1));

    if (widthValue <= 0 || heightValue <= 0) return 0;

    return calculateItemPrice(widthValue, heightValue, selectedMaterial.price_per_sqm, quantityValue).price;
  }, [height, quantity, selectedMaterial, unit, width]);

  async function updateStatus(orderId: string, status: string, reason = "") {
    try {
      await apiRequest(`/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, rejection_reason: reason }),
      });
      setSelectedOrder(null);
      setRejectionReason("");
      setFeedback("Buyurtma holati yangilandi.");
      await loadPage();
    } catch (updateError: any) {
      setError(updateError?.message || "Buyurtma holatini yangilab bo'lmadi.");
    }
  }

  async function exportOrders() {
    try {
      const blob = await apiRequest<Blob>("/reports/export-orders");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "buyurtmalar.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError: any) {
      setError(exportError?.message || "Eksport qilishda xatolik yuz berdi.");
    }
  }

  function addItem() {
    if (!selectedMaterial) {
      setError("Avval material tanlang.");
      return;
    }

    const widthValue = unit === "cm" ? toNumber(width) / 100 : toNumber(width);
    const heightValue = unit === "cm" ? toNumber(height) / 100 : toNumber(height);
    const quantityValue = Math.max(1, Math.floor(toNumber(quantity) || 1));

    if (widthValue <= 0 || heightValue <= 0) {
      setError("O'lchamlarni to'g'ri kiriting.");
      return;
    }

    setDraftItems((currentItems) => [
      ...currentItems,
      {
        material_id: selectedMaterial.id,
        material_name: selectedMaterial.name,
        width: widthValue,
        height: heightValue,
        quantity: quantityValue,
        price_per_sqm: Number(selectedMaterial.price_per_sqm || 0),
      },
    ]);

    setError("");
    setWidth("");
    setHeight("");
    setQuantity("1");
  }

  async function createOrder() {
    if (!dealerId) {
      setError("Diler tanlanmagan.");
      return;
    }

    if (!draftItems.length) {
      setError("Kamida bitta material qo'shing.");
      return;
    }

    setCreating(true);
    setError("");
    setFeedback("");

    try {
      await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          dealer_id: dealerId,
          items: draftItems.map((item) => ({
            material_id: item.material_id,
            material_name: item.material_name,
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            price_per_sqm: item.price_per_sqm,
          })),
          notes: notes.trim(),
        }),
      });

      setDealerId("");
      setDraftItems([]);
      setSelectedMaterialId("");
      setWidth("");
      setHeight("");
      setQuantity("1");
      setNotes("");
      setFeedback("Buyurtma yaratildi.");
      await loadPage();
    } catch (createError: any) {
      setError(createError?.message || "Buyurtma yaratib bo'lmadi.");
    } finally {
      setCreating(false);
    }
  }

  const money = (value: number) => formatMoney(value, currency, exchangeRate);

  return (
    <AppShell
      role="admin"
      title="Buyurtmalar markazi"
      subtitle="Buyurtma qo'shish, kuzatish va boshqarish uchun sodda ish maydoni."
      actions={
        <>
          <button
            className="button-secondary"
            type="button"
            onClick={() => setComposerOpen((current) => !current)}
          >
            {composerOpen ? "Formani yashirish" : "Yangi buyurtma"}
          </button>
          <button className="button-secondary" type="button" onClick={exportOrders}>
            Excel eksport
          </button>
        </>
      }
    >
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="card stat-card">
          <div className="mini-kpi">Jami buyurtmalar</div>
          <div className="metric-number">{orders.length}</div>
        </div>
        <div className="card stat-card">
          <div className="mini-kpi">Kutilmoqda</div>
          <div className="metric-number" style={{ color: "var(--warning)" }}>
            {stats.pending}
          </div>
        </div>
        <div className="card stat-card">
          <div className="mini-kpi">Ishlab chiqarishda</div>
          <div className="metric-number" style={{ color: "var(--blue)" }}>
            {stats.active}
          </div>
        </div>
        <div className="card stat-card">
          <div className="mini-kpi">Aylanma</div>
          <div className="metric-number" style={{ fontSize: 22 }}>
            {money(stats.revenue)}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="success-text animate-fade-in" style={{ marginBottom: 12 }}>
          {feedback}
        </div>
      )}

      {error && (
        <div className="error-text animate-fade-in" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {composerOpen && (
        <div className="orders-hero" style={{ marginBottom: 16 }}>
          <div className="split-row orders-hero-top">
            <div>
              <span className="pill">Yangi buyurtma</span>
              <h2 className="orders-hero-title">Buyurtma yig'ish bitta ekranda.</h2>
              <p className="orders-hero-copy">
                Diler tanlang, material qo'shing, o'lchamni kiriting va yakunda hammasini
                bir joyda tekshirib yuboring.
              </p>
            </div>
            <div className="inline-actions">
              <span className="tooltip-chip">{draftItems.length} pozitsiya</span>
              <span className="tooltip-chip">{selectedDealer ? selectedDealer.name : "Diler tanlanmagan"}</span>
            </div>
          </div>

          <div className="order-workspace" style={{ marginTop: 16 }}>
            <div className="order-stack">
              <section className="order-section">
                <div className="order-section-title">
                  <div className="split-row">
                    <span className="step-badge">1</span>
                    <div>
                      <h3>Diler tanlash</h3>
                      <p>Buyurtma kimning hisobiga yozilishini belgilang.</p>
                    </div>
                  </div>
                  <input
                    className="field"
                    style={{ maxWidth: 320 }}
                    placeholder="Diler qidirish"
                    value={dealerSearch}
                    onChange={(event) => setDealerSearch(event.target.value)}
                  />
                </div>

                <div className="choice-grid dealers">
                  {filteredDealers.length ? (
                    filteredDealers.map((dealer) => (
                      <button
                        key={dealer.id}
                        type="button"
                        className={`choice-card ${dealerId === dealer.id ? "active" : ""}`}
                        onClick={() => {
                          setDealerId(dealer.id);
                          setFeedback("");
                          setError("");
                        }}
                      >
                        <div className="choice-card-head">
                          <div>
                            <div className="choice-card-title">{dealer.name}</div>
                            <div className="choice-card-meta">{dealer.email}</div>
                          </div>
                          <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {dealer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="divider" />
                        <div className="split-row">
                          <span className="choice-card-meta">Qarz</span>
                          <strong style={{ color: (dealer.debt || 0) > 0 ? "var(--danger)" : "var(--success)" }}>
                            {money(dealer.debt || 0)}
                          </strong>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                      <span className="empty-state-icon">?</span>
                      Diler topilmadi.
                    </div>
                  )}
                </div>
              </section>

              <section className="order-section">
                <div className="order-section-title">
                  <div className="split-row">
                    <span className="step-badge">2</span>
                    <div>
                      <h3>Material qo'shish</h3>
                      <p>Kerakli materialni tanlang, keyin o'lcham va sonni kiriting.</p>
                    </div>
                  </div>
                  <div className="filter-row">
                    <input
                      className="field"
                      style={{ maxWidth: 320 }}
                      placeholder="Material qidirish"
                      value={materialSearch}
                      onChange={(event) => setMaterialSearch(event.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-row">
                  <button
                    type="button"
                    className={`option-chip ${selectedCategory === "all" ? "active" : ""}`}
                    onClick={() => setSelectedCategory("all")}
                  >
                    Barchasi
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`option-chip ${selectedCategory === category.id ? "active" : ""}`}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <div className="choice-grid materials">
                  {filteredMaterials.length ? (
                    filteredMaterials.map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        className={`choice-card ${selectedMaterialId === material.id ? "active" : ""}`}
                        onClick={() => {
                          setSelectedMaterialId(material.id);
                          setError("");
                        }}
                      >
                        <div className="choice-card-head">
                          <div>
                            <div className="choice-card-title">{material.name}</div>
                            <div className="choice-card-meta">{material.category_name || material.category}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="choice-card-price">{money(material.price_per_sqm)}</div>
                            <div className="choice-card-meta">/ kv.m</div>
                          </div>
                        </div>
                        <div className="divider" />
                        <div className="split-row">
                          <span className="choice-card-meta">Qoldiq</span>
                          <strong>{material.stock_quantity} kv.m</strong>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                      <span className="empty-state-icon">?</span>
                      Material topilmadi.
                    </div>
                  )}
                </div>

                <div className="two-col">
                  <div className="summary-card">
                    <div className="mini-kpi">Tanlangan material</div>
                    <strong style={{ fontSize: 16 }}>{selectedMaterial?.name || "Hali tanlanmagan"}</strong>
                    <div className="muted">
                      {selectedMaterial ? selectedMaterial.category_name || selectedMaterial.category : "Materialga bosib tanlang"}
                    </div>
                    {selectedMaterial && (
                      <div className="summary-card summary-card-muted" style={{ marginTop: 12 }}>
                        <div className="split-row">
                          <span className="muted">Narx</span>
                          <strong>{money(selectedMaterial.price_per_sqm)}</strong>
                        </div>
                        <div className="split-row" style={{ marginTop: 8 }}>
                          <span className="muted">Qoldiq</span>
                          <strong>{selectedMaterial.stock_quantity} kv.m</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="summary-card">
                    <div className="split-row" style={{ marginBottom: 10 }}>
                      <div>
                        <div className="mini-kpi">O'lcham</div>
                        <strong>Soni va o'lchami</strong>
                      </div>
                      <div className="filter-row">
                        <button
                          type="button"
                          className={`option-chip ${unit === "m" ? "active" : ""}`}
                          onClick={() => setUnit("m")}
                        >
                          m
                        </button>
                        <button
                          type="button"
                          className={`option-chip ${unit === "cm" ? "active" : ""}`}
                          onClick={() => setUnit("cm")}
                        >
                          cm
                        </button>
                      </div>
                    </div>

                    <div className="three-col">
                      <input
                        className="field"
                        placeholder={`En (${unit})`}
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                      />
                      <input
                        className="field"
                        placeholder={`Bo'yi (${unit})`}
                        value={height}
                        onChange={(event) => setHeight(event.target.value)}
                      />
                      <input
                        className="field"
                        placeholder="Soni"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                    </div>

                    {selectedMaterial && currentItemPrice > 0 && (
                      <div className="info-text" style={{ marginTop: 10 }}>
                        Taxminiy narx: {money(currentItemPrice)}
                      </div>
                    )}

                    <button className="button" type="button" onClick={addItem} style={{ width: "100%", marginTop: 10 }}>
                      Savatga qo'shish
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside className="order-summary">
              <div className="summary-card">
                <div className="split-row">
                  <div>
                    <div className="mini-kpi">Tanlangan diler</div>
                    <strong style={{ fontSize: 16 }}>{selectedDealer?.name || "Tanlanmagan"}</strong>
                    <div className="muted">{selectedDealer?.email || "Diler tanlang"}</div>
                  </div>
                  <span className="tooltip-chip">{selectedDealer ? "Faol" : "Kutishda"}</span>
                </div>
                {selectedDealer && (
                  <div className="summary-card summary-card-muted" style={{ marginTop: 12 }}>
                    <div className="split-row">
                      <span className="muted">Joriy qarz</span>
                      <strong style={{ color: (selectedDealer.debt || 0) > 0 ? "var(--danger)" : "var(--success)" }}>
                        {money(selectedDealer.debt || 0)}
                      </strong>
                    </div>
                    <div className="split-row" style={{ marginTop: 8 }}>
                      <span className="muted">Chegirma limiti</span>
                      <strong>{money(selectedDealer.credit_limit || 0)}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="summary-card">
                <div className="split-row" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="mini-kpi">Savat</div>
                    <strong>{draftItems.length} ta pozitsiya</strong>
                  </div>
                  <span className="tooltip-chip">{money(draftTotal)}</span>
                </div>

                <div className="item-list">
                  {draftItems.length ? (
                    draftItems.map((item, index) => {
                      const result = calculateItemPrice(item.width, item.height, item.price_per_sqm, item.quantity);

                      return (
                        <div key={`${item.material_id}-${index}`} className="item-card">
                          <div className="split-row">
                            <div>
                              <strong style={{ fontSize: 13 }}>{item.material_name}</strong>
                              <div className="muted">
                                {item.width} x {item.height} m · {item.quantity} dona
                              </div>
                            </div>
                            <strong>{money(result.price)}</strong>
                          </div>
                          <div className="split-row" style={{ marginTop: 10 }}>
                            <span className="chip">{result.billableArea} kv.m hisob</span>
                            <button
                              type="button"
                              className="button-danger"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => setDraftItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index))}
                            >
                              O'chirish
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-icon">+</span>
                      Hozircha savat bo'sh.
                    </div>
                  )}
                </div>
              </div>

              <div className="summary-card">
                <div className="mini-kpi">Buyurtma izohi</div>
                <textarea
                  className="textarea"
                  placeholder="Qo'shimcha izoh yozing"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="summary-card">
                <div className="summary-total">
                  <div>
                    <div className="mini-kpi">Yakuniy summa</div>
                    <strong style={{ fontSize: 22 }}>{money(draftTotal)}</strong>
                  </div>
                  <span className="status-pill status-accent">Yangi</span>
                </div>
                <button
                  className="button"
                  type="button"
                  onClick={createOrder}
                  disabled={creating || !dealerId || !draftItems.length}
                  style={{ width: "100%", marginTop: 12 }}
                >
                  {creating ? "Saqlanmoqda..." : "Buyurtmani yaratish"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

      <div className="filter-row" style={{ marginBottom: 14 }}>
        {orderFilters.map((status) => (
          <button
            key={status}
            type="button"
            className={`option-chip ${status === activeFilter ? "active" : ""}`}
            onClick={() => setActiveFilter(status)}
          >
            {status === "all" ? "Barchasi" : statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="list-stack">
        {filteredOrders.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">?</span>
            Buyurtmalar topilmadi.
          </div>
        )}

        {filteredOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            className="order-item selected-order-button"
            style={{ textAlign: "left", width: "100%" }}
            onClick={() => setSelectedOrder(order)}
          >
            <div className="split-row">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
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
                {order.items.slice(0, 3).map((item, itemIndex) => (
                  <span key={`${item.material_id}-${itemIndex}`} className="chip">
                    {item.material_name} {item.width} x {item.height} m
                  </span>
                ))}
                {order.items.length > 3 && <span className="chip">+{order.items.length - 3} ta</span>}
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedOrder && (
        <div className="card animate-fade-up" style={{ marginTop: 16 }}>
          <div className="split-row" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="pill mono">#{selectedOrder.order_code}</span>
              <span className={`status-pill ${statusClasses[selectedOrder.status]}`}>{statusLabels[selectedOrder.status]}</span>
            </div>
            <button className="button-ghost button" type="button" onClick={() => setSelectedOrder(null)}>
              Yopish
            </button>
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
            <div className="info-text" style={{ marginBottom: 12 }}>
              {selectedOrder.notes}
            </div>
          )}

          <div className="list-stack" style={{ marginBottom: 14 }}>
            {selectedOrder.items.map((item, itemIndex) => (
              <div key={`${item.material_id}-${itemIndex}`} className="material-card">
                <div className="split-row">
                  <div>
                    <strong style={{ fontSize: 13 }}>{item.material_name}</strong>
                    <div className="muted">
                      {item.width} x {item.height} m · {item.quantity} dona · {item.sqm} kv.m
                    </div>
                    {item.assigned_worker_name && (
                      <span className="status-pill status-blue" style={{ marginTop: 6 }}>
                        {item.assigned_worker_name}
                      </span>
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
                  Tasdiqlash
                </button>
                <button
                  className="button-danger"
                  type="button"
                  onClick={() => rejectionReason && updateStatus(selectedOrder.id, "rad_etilgan", rejectionReason)}
                >
                  Rad etish
                </button>
              </div>
              <textarea
                className="textarea"
                placeholder="Rad etish sababi"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </div>
          )}

          {selectedOrder.status === "tasdiqlangan" && (
            <button className="button" type="button" onClick={() => updateStatus(selectedOrder.id, "tayyorlanmoqda")}>
              Tayyorlashga o'tkazish
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
