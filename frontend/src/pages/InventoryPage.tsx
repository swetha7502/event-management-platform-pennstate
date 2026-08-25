import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Check, Pencil } from "lucide-react";
import { getInventory, updateInventoryCount } from "../lib/dataClient";
import type { InventoryItem, OutletContextType } from "../types";

export default function InventoryPage() {
  const { showToast } = useOutletContext<OutletContextType>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<number | string>(0);

  useEffect(() => {
    getInventory()
      .then(setItems)
      .catch(() => showToast("Couldn't load inventory"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-1">Inventory</h2>
      <p className="text-sm text-slate-500 mb-6">Current stock across all storage</p>

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
            {items.map((it) => (
              <tr key={it.item_id}>
                <td className="px-5 py-3 font-medium text-slate-800">{it.name}</td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {it.category}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {editingId === it.item_id ? (
                    <input
                      type="number"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm"
                    />
                  ) : (
                    <span
                      className={`font-medium ${
                        it.count <= 5 ? "text-amber-600" : "text-slate-700"
                      }`}
                    >
                      {it.count}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {editingId === it.item_id ? (
                    <button
                      onClick={async () => {
                        const newCount = Number(draft);
                        setItems((its) =>
                          its.map((x) => (x.item_id === it.item_id ? { ...x, count: newCount } : x))
                        );
                        setEditingId(null);
                        try {
                          await updateInventoryCount(it.item_id, newCount);
                          showToast("Inventory updated");
                        } catch {
                          showToast("Failed to save — try again");
                        }
                      }}
                      className="text-blue-700"
                    >
                      <Check size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(it.item_id);
                        setDraft(it.count);
                      }}
                      className="text-slate-400 hover:text-blue-700"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
