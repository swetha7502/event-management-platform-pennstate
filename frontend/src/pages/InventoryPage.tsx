import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getInventory, updateInventoryItem, createInventoryItem, deleteInventoryItem } from "../lib/dataClient";
import type { InventoryItem, OutletContextType } from "../types";

const BLANK_NEW_ITEM = { name: "", category: "", count: "" };
const ALL_CATEGORIES = "All categories";

interface EditDraft {
  name: string;
  category: string;
  count: string;
}

export default function InventoryPage() {
  const { session } = useAuth();
  const { showToast } = useOutletContext<OutletContextType>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ name: "", category: "", count: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState(BLANK_NEW_ITEM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);

  useEffect(() => {
    getInventory()
      .then(setItems)
      .catch(() => showToast("Couldn't load inventory"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () => [ALL_CATEGORIES, ...Array.from(new Set(items.map((i) => i.category))).sort()],
    [items]
  );
  const visibleItems = useMemo(
    () => (categoryFilter === ALL_CATEGORIES ? items : items.filter((i) => i.category === categoryFilter)),
    [items, categoryFilter]
  );

  if (!session) return null;
  const canManage = session.role === "Coordinator";

  const startEdit = (it: InventoryItem) => {
    setEditingId(it.item_id);
    setDraft({ name: it.name, category: it.category, count: String(it.count) });
  };

  const saveEdit = async (itemId: string) => {
    const name = draft.name.trim();
    const category = draft.category.trim();
    const count = Number(draft.count);
    if (!name || !category) {
      showToast("Name and category are required");
      return;
    }
    if (Number.isNaN(count) || count < 0) {
      showToast("Enter a valid count");
      return;
    }
    setSavingId(itemId);
    try {
      await updateInventoryItem(itemId, { name, category, count });
      setItems((its) => its.map((x) => (x.item_id === itemId ? { ...x, name, category, count } : x)));
      showToast("Item updated");
      setEditingId(null);
    } catch {
      showToast("Failed to save — try again");
    }
    setSavingId(null);
  };

  const addItem = async () => {
    if (!newItem.name.trim() || !newItem.category.trim()) {
      showToast("Name and category are required");
      return;
    }
    try {
      const created = await createInventoryItem({
        name: newItem.name.trim(),
        category: newItem.category.trim(),
        count: Number(newItem.count) || 0,
      });
      setItems((its) => [...its, created]);
      showToast("Item added");
    } catch {
      showToast("Failed to add item");
    }
    setNewItem(BLANK_NEW_ITEM);
    setShowAdd(false);
  };

  const removeItem = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      await deleteInventoryItem(itemId);
      setItems((its) => its.filter((x) => x.item_id !== itemId));
      showToast("Item removed");
    } catch {
      showToast("Failed to remove item");
    }
    setDeletingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-slate-800">Inventory</h2>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus size={16} /> Add item
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          {visibleItems.length} of {items.length} items across storage
        </p>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Item</th>
              <th className="text-left px-5 py-3 font-medium">Category</th>
              <th className="text-left px-5 py-3 font-medium">Count</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleItems.map((it) => {
              const isEditing = editingId === it.item_id;
              const isSaving = savingId === it.item_id;
              return (
                <tr key={it.item_id}>
                  {isEditing ? (
                    <>
                      <td className="px-5 py-2.5">
                        <input
                          autoFocus
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          value={draft.category}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                          className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min={0}
                          value={draft.count}
                          onChange={(e) => setDraft({ ...draft, count: e.target.value })}
                          className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => saveEdit(it.item_id)}
                          disabled={isSaving}
                          className="text-blue-700 disabled:opacity-50 p-1"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isSaving}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 font-medium text-slate-800">{it.name}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                          {it.category}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-medium ${it.count <= 5 ? "text-amber-600" : "text-slate-700"}`}>
                          {it.count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(it)} className="text-slate-400 hover:text-blue-700 p-1">
                          <Pencil size={14} />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => removeItem(it.item_id)}
                            disabled={deletingId === it.item_id}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-50 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 text-sm py-8">
                  No inventory items{categoryFilter !== ALL_CATEGORIES ? " in this category" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Add inventory item</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Name</label>
            <input
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="e.g. Folding tables"
            />
            <label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
            <input
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="e.g. Furniture"
              list="inventory-categories"
            />
            <datalist id="inventory-categories">
              {categories
                .filter((c) => c !== ALL_CATEGORIES)
                .map((c) => (
                  <option key={c} value={c} />
                ))}
            </datalist>
            <label className="text-xs font-medium text-slate-500 block mb-1">Starting count</label>
            <input
              type="number"
              value={newItem.count}
              onChange={(e) => setNewItem({ ...newItem, count: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-5"
              placeholder="0"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewItem(BLANK_NEW_ITEM);
                }}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addItem}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 rounded-lg"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
