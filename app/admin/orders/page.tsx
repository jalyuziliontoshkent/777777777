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

const initialDraft = {
  dealerId: "",
  notes: "",
};

export default function AdminOrdersPage() {
  const currency = useAppStore((state) => state.currency);
  const exchangeRate = useAppStore((state) => state.exchangeRate);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealers, setDealers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [unit, setUnit] = useState<"m" | "cm">("m");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showComposer, setShowComposer] = useState(true);
  const [materialSearch, setMaterialSearch] = useState("");

  function loadPage() {
    Promise.all([
      apiRequest<Order[]>("/orders"),
      apiRequest<User[]>("/dealers"),
      apiRequest<Category[]>("/categories"),
      apiRequest<Material[]>("/materials"),
    ]).then(([orderData, dealerData, categoryData, materialData]) => {
      setOrders(orderData);
      setDealers(dealerData);
      setCategories(categoryData);
      setMaterials(materialData);
    });
  }

  useEffect(() => {
    loadPage();
  }, []);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return orders;
    return orders.filter((order) => order.status === activeFilter);
  }, [orders, activeFilter]);

  const filteredMaterials = useMemo(() => {
    let result = materials;
    
    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((item) => item.category_id === selectedCategory);
    }
    
    // Search filter
    if (materialSearch.trim()) {
      const search = materialSearch.toLowerCase();
      result = result.filter((item) => 
        item.name.toLowerCase().includes(search) || 
        (item.category_name?.toLowerCase() || item.category?.toLowerCase() || "").includes(search)
      );
    }
    
    return result;
  }, [materials, selectedCategory, materialSearch]);

  const selectedDealer = useMemo(
    () => dealers.find((dealer) => dealer.id === draft.dealerId) || null,
    [dealers, draft.dealerId],
  );

  const totals = useMemo(() => {
    const pending = orders.filter((order) => order.status === "kutilmoqda").length;
    const creatingNow = orders.filter((order) =>
      ["tasdiqlangan", "tayyorlanmoqda"].includes(order.status),
    ).length;
    const revenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    return { pending, creatingNow, revenue };
  }, [orders]);

  const draftTotal = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const result = calculateItemPrice(
          Number(item.width),
          Number(item.height),
          Number(item.price_per_sqm),
          item.quantity,
        );
        return sum + result.price;
      }, 0),
    [draftItems],
  );

  async function updateStatus(orderId: string, status: string, reason = "") {
    await apiRequest(`/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, rejection_reason: reason }),
    });
    setSelectedOrder(null);
    setRejectionReason("");
    loadPage();
  }

  async function exportOrders() {
    const blob = await apiRequest<Blob>("/reports/export-orders");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "buyurtmalar.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetMaterialForm() {
    setWidth("");
    setHeight("");
    setQuantity("1");
  }

  function addDraftItem() {
    if (!activeMaterial) return;
    const widthInM = unit === "cm" ? Number(width || 0) / 100 : Number(width || 0);
    const heightInM = unit === "cm" ? Number(height || 0) / 100 : Number(height || 0);
    const qty = Math.max(1, Number(quantity || 1));
    if (widthInM <= 0 || heightInM <= 0) {
      setError("O'lchamlarni to'g'ri kiriting.");
      return;
    }

    setDraftItems((state) => [
      ...state,
      {
        material_id: activeMaterial.id,
        material_name: activeMaterial.name,
        width: String(widthInM),
        height: String(heightInM),
        quantity: qty,
        price_per_sqm: Number(activeMaterial.price_per_sqm),
      },
    ]);
    setError("");
    setFeedback("");
    resetMaterialForm();
  }

  async function createOrder() {
    if (!draft.dealerId) {
      setError("Avval diler tanlang.");
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
          dealer_id: draft.dealerId,
          items: draftItems.map((item) => ({
            material_id: item.material_id,
            material_name: item.material_name,
            width: Number(item.width),
            height: Number(item.height),
            quantity: Number(item.quantity || 1),
            price_per_sqm: Number(item.price_per_sqm),
          })),
          notes: draft.notes,
        }),
      });
      setDraft(initialDraft);
      setDraftItems([]);
      setActiveMaterial(null);
      resetMaterialForm();
      setFeedback("Buyurtma muvaffaqiyatli yaratildi.");
      loadPage();
    } catch (submitError: any) {
      setError(submitError.message || "Buyurtmani yaratib bo'lmadi.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell
      role="admin"
      title="Buyurtmalar boshqaruvi"
      subtitle="Admin buyurtma yaratadi, dilerga biriktiradi va barcha bosqichlarni bir sahifada nazorat qiladi."
      actions={
        <>
          <button
            className={showComposer ? "button-secondary" : "button"}
            type="button"
            onClick={() => setShowComposer((state) => !state)}
          >
            {showComposer ? "Composer yopish" : "Yangi buyurtma"}
          </button>
          <button className="button-secondary" type="button" onClick={exportOrders}>
            Excel eksport
          </button>
        </>
      }
    >
      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <div className="hero-card">
          <div className="mini-kpi">Jami buyurtmalar</div>
          <div className="metric-number">{orders.length}</div>
          <div className="muted">Barcha dilerlar bo'yicha umumiy oqim</div>
        </div>
        <div className="card">
          <div className="mini-kpi">Kutayotganlar</div>
          <div className="metric-number">{totals.pending}</div>
          <div className="muted">Tasdiq yoki qayta aloqa kerak</div>
        </div>
        <div className="card">
          <div className="mini-kpi">Ishlab chiqarishda</div>
          <div className="metric-number">{totals.creatingNow}</div>
          <div className="muted">Tayyorlanayotgan buyurtmalar</div>
        </div>
        <div className="card">
          <div className="mini-kpi">Umumiy summa</div>
          <div className="metric-number" style={{ fontSize: 32 }}>
            {formatMoney(totals.revenue, currency, exchangeRate)}
          </div>
          <div className="muted">Barcha buyurtmalar kesimida</div>
        </div>
      </div>

      {showComposer ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="split-row" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="section-title" style={{ marginBottom: 8 }}>
                Admindan yangi buyurtma
              </h3>
              <div className="muted">
                Diler tanlang, material biriktiring va buyurtmani to'g'ridan to'g'ri tizimga kiriting.
              </div>
            </div>
            {selectedDealer ? (
              <div className="pill">
                {selectedDealer.name} - {formatMoney(selectedDealer.debt || 0, currency, exchangeRate)} qarz
              </div>
            ) : null}
          </div>

          <div className="two-col">
            <div className="grid">
              <div className="card" style={{ padding: 16 }}>
                <h4 className="section-title" style={{ marginBottom: 12 }}>
                  1. Diler tanlang
                </h4>
                <div className="list-stack">
                  {dealers.map((dealer) => (
                    <button
                      key={dealer.id}
                      type="button"
                      className={draft.dealerId === dealer.id ? "dealer-card selected-card" : "dealer-card"}
                      style={{ textAlign: "left" }}
                      onClick={() => setDraft((state) => ({ ...state, dealerId: dealer.id }))}
                    >
                      <div className="split-row">
                        <div>
                          <strong>{dealer.name}</strong>
                          <div className="muted">{dealer.email}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="mini-kpi">Qarz</div>
                          <strong>{formatMoney(dealer.debt || 0, currency, exchangeRate)}</strong>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <h4 className="section-title" style={{ marginBottom: 12 }}>
                  2. Material tanlang
                </h4>
                <div className="toolbar">
                  <button
                    type="button"
                    className={selectedCategory === "all" ? "button" : "button-ghost"}
                    onClick={() => setSelectedCategory("all")}
                  >
                    Barchasi
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={selectedCategory === category.id ? "button" : "button-ghost"}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  className="field"
                  placeholder="Material qidirish..."
                  value={materialSearch}
                  onChange={(event) => setMaterialSearch(event.target.value)}
                  style={{ marginBottom: 12 }}
                />

                <div className="list-stack">
                  {filteredMaterials.map((material) => (
                    <button
                      key={material.id}
                      type="button"
                      className={activeMaterial?.id === material.id ? "material-card selected-card" : "material-card"}
                      style={{ textAlign: "left" }}
                      onClick={() => setActiveMaterial(material)}
                    >
                      <div className="split-row">
                        <div>
                          <strong>{material.name}</strong>
                          <div className="muted">{material.category_name || material.category}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong>{formatMoney(material.price_per_sqm, currency, exchangeRate)}</strong>
                          <div className="mini-kpi">{material.stock_quantity} qoldiq</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid">
              <div className="hero-card">
                <h4 className="section-title" style={{ marginBottom: 12 }}>
                  3. O'lcham va qo'shish
                </h4>
                {activeMaterial ? (
                  <div className="grid">
                    <div className="split-row" style={{ alignItems: "flex-start" }}>
                      <div>
                        <div className="pill">{activeMaterial.category_name || activeMaterial.category}</div>
                        <h3 style={{ margin: "12px 0 6px" }}>{activeMaterial.name}</h3>
                        <div className="muted">
                          {formatMoney(activeMaterial.price_per_sqm, currency, exchangeRate)} / kv.m
                        </div>
                      </div>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className={unit === "m" ? "button" : "button-ghost"}
                          onClick={() => setUnit("m")}
                        >
                          Metr
                        </button>
                        <button
                          type="button"
                          className={unit === "cm" ? "button" : "button-ghost"}
                          onClick={() => setUnit("cm")}
                        >
                          Santimetr
                        </button>
                      </div>
                    </div>

                    {activeMaterial.image_url ? (
                      <div
                        className="material-preview"
                        style={{ backgroundImage: `linear-gradient(rgba(18, 15, 13, 0.18), rgba(18, 15, 13, 0.18)), url(${activeMaterial.image_url})` }}
                      />
                    ) : null}

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
                    <button className="button" type="button" onClick={addDraftItem}>
                      Savatga qo'shish
                    </button>
                  </div>
                ) : (
                  <div className="empty-state">Chap tomondan material tanlang.</div>
                )}
              </div>

              <div className="card">
                <h4 className="section-title">4. Buyurtma tarkibi</h4>
                {feedback ? <div className="success-text">{feedback}</div> : null}
                {error ? <div className="error-text">{error}</div> : null}
                <div className="list-stack">
                  {draftItems.length ? (
                    draftItems.map((item, index) => {
                      const result = calculateItemPrice(
                        Number(item.width),
                        Number(item.height),
                        Number(item.price_per_sqm),
                        item.quantity,
                      );
                      return (
                        <div key={`${item.material_id}-${index}`} className="order-item">
                          <div className="split-row">
                            <div>
                              <strong>{item.material_name}</strong>
                              <div className="muted">
                                {item.width} x {item.height} m - {item.quantity} dona - {result.billableArea} kv.m
                              </div>
                            </div>
                            <div className="inline-actions">
                              <strong>{formatMoney(result.price, currency, exchangeRate)}</strong>
                              <button
                                className="button-danger"
                                type="button"
                                onClick={() =>
                                  setDraftItems((state) =>
                                    state.filter((_, itemIndex) => itemIndex !== index),
                                  )
                                }
                              >
                                Olib tashlash
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">Hali hech qanday material qo'shilmagan.</div>
                  )}
                </div>
                <textarea
                  className="textarea"
                  style={{ marginTop: 16 }}
                  placeholder="Buyurtma izohi"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((state) => ({ ...state, notes: event.target.value }))
                  }
                />
                <div className="split-row" style={{ marginTop: 16 }}>
                  <div>
                    <div className="mini-kpi">Yakuniy summa</div>
                    <strong style={{ fontSize: 24 }}>
                      {formatMoney(draftTotal, currency, exchangeRate)}
                    </strong>
                  </div>
                  <button className="button" type="button" onClick={createOrder} disabled={creating}>
                    {creating ? "Saqlanmoqda..." : "Buyurtmani yaratish"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        {["all", ...allOrderStatuses].map((status) => (
          <button
            key={status}
            type="button"
            className={status === activeFilter ? "button" : "button-ghost"}
            onClick={() => setActiveFilter(status)}
          >
            {status === "all" ? "Barchasi" : statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="list-stack">
        {filteredOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            className="order-item selected-order-button"
            style={{ textAlign: "left" }}
            onClick={() => setSelectedOrder(order)}
          >
            <div className="split-row">
              <div>
                <div className="pill mono">#{order.order_code}</div>
                <h3 style={{ margin: "10px 0 6px" }}>{order.dealer_name}</h3>
                <div className="muted">{formatDateTime(order.created_at)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={`status-pill ${statusClasses[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
                <div className="metric-number" style={{ fontSize: 28 }}>
                  {formatMoney(order.total_price, currency, exchangeRate)}
                </div>
              </div>
            </div>
            <div className="order-items" style={{ marginTop: 14 }}>
              {order.items.slice(0, 4).map((item, index) => (
                <span key={`${order.id}-${index}`} className="chip">
                  {item.material_name} - {item.width}x{item.height} m
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selectedOrder ? (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="split-row">
            <div>
              <span className="pill mono">#{selectedOrder.order_code}</span>
              <h3 className="section-title" style={{ marginTop: 12 }}>
                {selectedOrder.dealer_name}
              </h3>
              <p className="muted">{formatDateTime(selectedOrder.created_at)}</p>
            </div>
            <button className="button-ghost" type="button" onClick={() => setSelectedOrder(null)}>
              Yopish
            </button>
          </div>

          {selectedOrder.notes ? (
            <div className="success-text" style={{ marginBottom: 16 }}>
              Izoh: {selectedOrder.notes}
            </div>
          ) : null}

          <div className="list-stack">
            {selectedOrder.items.map((item, index) => (
              <div key={`${selectedOrder.id}-${index}`} className="material-card">
                <div className="split-row">
                  <div>
                    <strong>{item.material_name}</strong>
                    <div className="muted">
                      {item.width} x {item.height} m - {item.quantity} dona - {item.sqm} kv.m
                    </div>
                    {item.assigned_worker_name ? (
                      <div className="mini-kpi" style={{ marginTop: 6 }}>
                        Biriktirilgan ishchi: {item.assigned_worker_name}
                      </div>
                    ) : null}
                  </div>
                  <strong>{formatMoney(item.price || 0, currency, exchangeRate)}</strong>
                </div>
              </div>
            ))}
          </div>

          {selectedOrder.status === "kutilmoqda" ? (
            <div className="grid" style={{ marginTop: 16 }}>
              <div className="inline-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => updateStatus(selectedOrder.id, "tasdiqlangan")}
                >
                  Tasdiqlash
                </button>
                <button
                  className="button-danger"
                  type="button"
                  onClick={() =>
                    rejectionReason &&
                    updateStatus(selectedOrder.id, "rad_etilgan", rejectionReason)
                  }
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
          ) : null}

          {selectedOrder.status === "tasdiqlangan" ? (
            <button
              className="button"
              type="button"
              style={{ marginTop: 16 }}
              onClick={() => updateStatus(selectedOrder.id, "tayyorlanmoqda")}
            >
              Tayyorlashga o'tkazish
            </button>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
