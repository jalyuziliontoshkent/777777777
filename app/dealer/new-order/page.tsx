"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api-client";
import { calculateItemPrice, formatMoney } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

type DraftItem = {
  material_id: string;
  material_name: string;
  width: string;
  height: string;
  quantity: number;
  price_per_sqm: number;
};

export default function DealerNewOrderPage() {
  const currency = useAppStore((state) => state.currency);
  const exchangeRate = useAppStore((state) => state.exchangeRate);
  const [categories, setCategories] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeMaterial, setActiveMaterial] = useState<any>(null);
  const [unit, setUnit] = useState<"m" | "cm">("m");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");

  useEffect(() => {
    Promise.all([apiRequest("/categories"), apiRequest("/materials")]).then(([cats, mats]) => {
      setCategories(cats);
      setMaterials(mats);
    });
  }, []);

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

  function resetDimensions() {
    setWidth("");
    setHeight("");
  }

  function addItem() {
    if (!activeMaterial) return;
    const widthInM = unit === "cm" ? Number(width || 0) / 100 : Number(width || 0);
    const heightInM = unit === "cm" ? Number(height || 0) / 100 : Number(height || 0);
    if (widthInM <= 0 || heightInM <= 0) return;
    setItems((state) => [
      ...state,
      {
        material_id: activeMaterial.id,
        material_name: activeMaterial.name,
        width: String(widthInM),
        height: String(heightInM),
        quantity: 1,
        price_per_sqm: Number(activeMaterial.price_per_sqm),
      },
    ]);
    resetDimensions();
  }

  async function submitOrder() {
    await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((item) => ({
          material_id: item.material_id,
          material_name: item.material_name,
          width: Number(item.width),
          height: Number(item.height),
          quantity: item.quantity,
          price_per_sqm: item.price_per_sqm,
        })),
        notes,
      }),
    });
    setItems([]);
    setNotes("");
    setMessage("Buyurtma muvaffaqiyatli yuborildi.");
  }

  const total = items.reduce((sum, item) => {
    const result = calculateItemPrice(Number(item.width), Number(item.height), Number(item.price_per_sqm), item.quantity);
    return sum + result.price;
  }, 0);

  return (
    <AppShell role="dealer" title="Yangi buyurtma" subtitle="Kategoriya tanlang, mahsulotlarni yig'ing va buyurtmani yuboring.">
      <div className="two-col">
        <div className="card">
          <h3 className="section-title">Kategoriyalar</h3>
          <div className="toolbar">
            <button type="button" className={selectedCategory === "all" ? "button" : "button-ghost"} onClick={() => setSelectedCategory("all")}>
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

          <div className="list-stack" style={{ maxHeight: 350, overflowY: "auto", paddingRight: 4 }}>
            {filteredMaterials.map((material) => (
              <button
                key={material.id}
                type="button"
                className="material-card"
                style={{ textAlign: "left" }}
                onClick={() => setActiveMaterial(material)}
              >
                <div className="split-row">
                  <div>
                    <strong>{material.name}</strong>
                    <div className="muted">{material.category_name || material.category}</div>
                  </div>
                  <strong>{formatMoney(material.price_per_sqm, currency, exchangeRate)}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Tanlangan mahsulot</h3>
          {activeMaterial ? (
            <div className="grid">
              <div className="success-text">
                {activeMaterial.name} · {formatMoney(activeMaterial.price_per_sqm, currency, exchangeRate)} / kv.m
              </div>
              <div className="inline-actions">
                <button type="button" className={unit === "m" ? "button" : "button-ghost"} onClick={() => setUnit("m")}>
                  Metr
                </button>
                <button type="button" className={unit === "cm" ? "button" : "button-ghost"} onClick={() => setUnit("cm")}>
                  Santimetr
                </button>
              </div>
              <div className="two-col">
                <input className="field" placeholder={`En (${unit})`} value={width} onChange={(e) => setWidth(e.target.value)} />
                <input className="field" placeholder={`Bo'yi (${unit})`} value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
              <button className="button" type="button" onClick={addItem}>
                Savatga qo'shish
              </button>
            </div>
          ) : (
            <div className="empty-state">Chap tomondan mahsulot tanlang.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">Buyurtma savati</h3>
        {message ? <div className="success-text">{message}</div> : null}
        <div className="list-stack">
          {items.map((item, index) => {
            const result = calculateItemPrice(Number(item.width), Number(item.height), Number(item.price_per_sqm), item.quantity);
            return (
              <div key={`${item.material_id}-${index}`} className="order-item">
                <div className="split-row">
                  <div>
                    <strong>{item.material_name}</strong>
                    <div className="muted">{item.width} x {item.height} m · {result.billableArea} kv.m</div>
                  </div>
                  <div className="inline-actions">
                    <strong>{formatMoney(result.price, currency, exchangeRate)}</strong>
                    <button className="button-danger" type="button" onClick={() => setItems((state) => state.filter((_, itemIndex) => itemIndex !== index))}>
                      Olib tashlash
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <textarea className="textarea" style={{ marginTop: 16 }} placeholder="Izoh" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="split-row" style={{ marginTop: 16 }}>
          <strong>Jami: {formatMoney(total, currency, exchangeRate)}</strong>
          <button className="button" type="button" onClick={submitOrder} disabled={!items.length}>
            Buyurtmani yuborish
          </button>
        </div>
      </div>
    </AppShell>
  );
}
