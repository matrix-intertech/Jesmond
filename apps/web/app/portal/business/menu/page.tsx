"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import PageHeader from "@/components/ui/PageHeader";

interface FoodMenuItem {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
}

interface FoodMenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  items: FoodMenuItem[];
}

interface FoodMenu {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  branchId: string;
  categories: FoodMenuCategory[];
}

export default function MenuManagementPage() {
  const router = useRouter();
  
  const [menus, setMenus] = useState<FoodMenu[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMenu, setSelectedMenu] = useState<FoodMenu | null>(null);

  // Modals state
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  // Forms state
  const [menuForm, setMenuForm] = useState({ id: "", name: "", description: "", branchId: "" });
  const [categoryForm, setCategoryForm] = useState({ id: "", menuId: "", name: "", displayOrder: 0 });
  const [itemForm, setItemForm] = useState({ id: "", categoryId: "", name: "", price: "", displayOrder: 0 });

  const fetchBranches = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (e) {
      console.error('Failed to load branches', e);
    }
  };

  const fetchMenus = async () => {
    setLoading(true);
    setError("");
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/food/menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setMenus(data);
        if (selectedMenu) {
          // If a menu is selected, fetch its full details (with categories and items)
          fetchMenuDetails(selectedMenu.id);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to fetch menus');
        if (res.status === 401 || res.status === 403) {
          clearAuth();
          router.replace('/login');
        }
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuDetails = async (menuId: string) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/food/menu/${menuId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMenu(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchMenus();
  }, []);

  // --- MENU CRUD ---
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;

    const isEdit = !!menuForm.id;
    const url = isEdit 
      ? `/api/v1/food/menu/${menuForm.id}`
      : `/api/v1/food/menu`;

    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: menuForm.name,
          description: menuForm.description,
          branchId: menuForm.branchId || undefined,
        })
      });

      if (res.ok) {
        setIsMenuModalOpen(false);
        fetchMenus();
      } else {
        const errJson = await res.json();
        alert(errJson.message || "Failed to save menu");
      }
    } catch (err: any) {
      alert("Network error");
    }
  };

  const toggleMenuStatus = async (m: FoodMenu) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/food/menu/${m.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isActive: !m.isActive })
      });
      if (res.ok) fetchMenus();
    } catch (e) { console.error(e); }
  };

  // --- CATEGORY CRUD ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;

    const isEdit = !!categoryForm.id;
    const url = isEdit 
      ? `/api/v1/food/menu/categories/${categoryForm.id}`
      : `/api/v1/food/menu/categories`;

    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          menuId: categoryForm.menuId,
          name: categoryForm.name,
          displayOrder: categoryForm.displayOrder
        })
      });

      if (res.ok) {
        setIsCategoryModalOpen(false);
        if (selectedMenu) fetchMenuDetails(selectedMenu.id);
      } else {
        const errJson = await res.json();
        alert(errJson.message || "Failed to save category");
      }
    } catch (err: any) {
      alert("Network error");
    }
  };

  const toggleCategoryStatus = async (c: FoodMenuCategory) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/food/menu/categories/${c.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isActive: !c.isActive })
      });
      if (res.ok && selectedMenu) fetchMenuDetails(selectedMenu.id);
    } catch (e) { console.error(e); }
  };

  // --- ITEM CRUD ---
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;

    const isEdit = !!itemForm.id;
    const url = isEdit 
      ? `/api/v1/food/menu/items/${itemForm.id}`
      : `/api/v1/food/menu/items`;

    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          price: Math.round(parseFloat(itemForm.price) * 100),
          displayOrder: itemForm.displayOrder
        })
      });

      if (res.ok) {
        setIsItemModalOpen(false);
        if (selectedMenu) fetchMenuDetails(selectedMenu.id);
      } else {
        const errJson = await res.json();
        alert(errJson.message || "Failed to save item");
      }
    } catch (err: any) {
      alert("Network error");
    }
  };

  const toggleItemStatus = async (i: FoodMenuItem) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/food/menu/items/${i.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isActive: !i.isActive })
      });
      if (res.ok && selectedMenu) fetchMenuDetails(selectedMenu.id);
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading menu data...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Menu Management" description="Manage your food menus, categories, and items." />
        {!selectedMenu && (
          <button 
            onClick={() => {
              setMenuForm({ id: "", name: "", description: "", branchId: branches[0]?.id || "" });
              setIsMenuModalOpen(true);
            }} 
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-muted"
          >
            Create Menu
          </button>
        )}
      </div>

      {!selectedMenu ? (
        // MENUS LIST
        menus.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <h3 className="text-lg font-medium text-text-primary">No menus yet</h3>
            <p className="mt-1 text-sm text-text-secondary">Create a menu to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menus.map((m) => (
              <div key={m.id} className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary">{m.name}</h3>
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{m.description || "No description"}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { fetchMenuDetails(m.id); }} className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-white hover:bg-secondary/90">
                    Manage Editor
                  </button>
                  <button onClick={() => { setMenuForm({ id: m.id, name: m.name, description: m.description || "", branchId: m.branchId }); setIsMenuModalOpen(true); }} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-hover">
                    Edit
                  </button>
                  <button onClick={() => toggleMenuStatus(m)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-hover">
                    {m.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // MENU EDITOR
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedMenu(null)} className="text-sm font-medium text-text-secondary hover:text-text-primary">
              &larr; Back to Menus
            </button>
            <h2 className="text-xl font-bold text-text-primary">{selectedMenu.name} Editor</h2>
            <button 
              onClick={() => {
                setCategoryForm({ id: "", menuId: selectedMenu.id, name: "", displayOrder: 0 });
                setIsCategoryModalOpen(true);
              }}
              className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
            >
              Add Category
            </button>
          </div>

          {(!selectedMenu.categories || selectedMenu.categories.length === 0) ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center">
              <h3 className="text-lg font-medium text-text-primary">No categories yet</h3>
              <p className="mt-1 text-sm text-text-secondary">Add a category like "Starters" or "Mains" to begin adding items.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedMenu.categories.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-surface shadow-sm">
                  <div className="flex items-center justify-between border-b border-border bg-surface-muted/30 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-text-primary">{c.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setCategoryForm({ id: c.id, menuId: selectedMenu.id, name: c.name, displayOrder: c.displayOrder }); setIsCategoryModalOpen(true); }} className="text-xs font-medium text-text-secondary hover:text-text-primary">Edit</button>
                      <button onClick={() => toggleCategoryStatus(c)} className="text-xs font-medium text-text-secondary hover:text-text-primary">{c.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button 
                        onClick={() => { setItemForm({ id: "", categoryId: c.id, name: "", price: "", displayOrder: 0 }); setIsItemModalOpen(true); }}
                        className="ml-2 rounded bg-secondary px-2 py-1 text-xs font-medium text-white hover:bg-secondary/90"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {(!c.items || c.items.length === 0) ? (
                      <div className="p-4 text-sm text-text-secondary text-center">No items in this category.</div>
                    ) : (
                      c.items.map((i) => (
                        <div key={i.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover/50">
                          <div className="flex items-center gap-3">
                            <span className={i.isActive ? 'text-text-primary' : 'text-text-secondary line-through'}>{i.name}</span>
                            <span className="text-sm font-medium text-text-secondary">${(i.price / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => { setItemForm({ id: i.id, categoryId: c.id, name: i.name, price: (i.price / 100).toString(), displayOrder: i.displayOrder }); setIsItemModalOpen(true); }} className="text-xs font-medium text-text-secondary hover:text-text-primary">Edit</button>
                            <button onClick={() => toggleItemStatus(i)} className="text-xs font-medium text-text-secondary hover:text-text-primary">{i.isActive ? 'Deactivate' : 'Activate'}</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-text-primary">{menuForm.id ? 'Edit Menu' : 'Create Menu'}</h3>
            <form onSubmit={handleSaveMenu} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
                <input required value={menuForm.name} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Description</label>
                <input value={menuForm.description} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              {!menuForm.id && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Branch</label>
                  <select required value={menuForm.branchId} onChange={e => setMenuForm({...menuForm, branchId: e.target.value})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary">
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsMenuModalOpen(false)} className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-text-primary">{categoryForm.id ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
                <input required value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Display Order</label>
                <input type="number" value={categoryForm.displayOrder} onChange={e => setCategoryForm({...categoryForm, displayOrder: parseInt(e.target.value) || 0})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-text-primary">{itemForm.id ? 'Edit Item' : 'Add Item'}</h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
                <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Price ($)</label>
                <input type="number" step="0.01" min="0" required value={itemForm.price} onChange={e => setItemForm({...itemForm, price: e.target.value})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Display Order</label>
                <input type="number" value={itemForm.displayOrder} onChange={e => setItemForm({...itemForm, displayOrder: parseInt(e.target.value) || 0})} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsItemModalOpen(false)} className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover">Cancel</button>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
