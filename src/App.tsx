import { Edit3, Eye, EyeOff, ImagePlus, LogOut, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, assetUrl, type Product } from "./lib/api";

const emptyForm = {
  name: "",
  category: "Cookies",
  price: "",
  originalPrice: "",
  tag: "",
  description: "",
  isActive: true,
};

type ProductForm = typeof emptyForm;

export default function App() {
  const [token, setToken] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Admin - Zekra Sweets";
  }, []);

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingId),
    [editingId, products],
  );

  useEffect(() => {
    if (!token) return;
    loadProducts(token);
  }, [token]);

  useEffect(() => {
    setToken(localStorage.getItem("adminToken") || "");
  }, []);

  async function loadProducts(authToken = token) {
    try {
      setProducts(
        await apiFetch<Product[]>("/api/admin/products", {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load products");
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await apiFetch<{ token: string }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("adminToken", result.token);
      setToken(result.token);
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, String(value)));
    if (editingProduct?.imageUrl) payload.append("imageUrl", editingProduct.imageUrl);
    if (image) payload.append("image", image);

    try {
      await apiFetch<Product>(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      setForm(emptyForm);
      setEditingId(null);
      setImage(null);
      setMessage("Product saved.");
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    setBusy(true);
    setMessage("");
    try {
      await apiFetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete product");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      tag: product.tag || "",
      description: product.description || "",
      isActive: product.isActive !== false,
    });
    setImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function logout() {
    localStorage.removeItem("adminToken");
    setToken("");
    setProducts([]);
  }

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-elegant">
          <h1 className="font-display text-3xl">Admin login</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage Zekra Sweets products and images.</p>
          <label className="mt-6 block text-sm font-medium">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
          <label className="mt-4 block text-sm font-medium">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
          {message && <div className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</div>}
          <button disabled={busy} className="mt-6 w-full rounded-full bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-caramel">Zekra Sweets</span>
            <h1 className="mt-2 font-display text-4xl">Product admin</h1>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>

        {message && <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-3 text-sm">{message}</div>}

        <section className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <form onSubmit={saveProduct} className="h-fit rounded-3xl border border-border bg-card p-5 shadow-glass">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{editingId ? "Edit product" : "Add product"}</h2>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setImage(null); }} className="text-sm text-primary">
                  New product
                </button>
              )}
            </div>

            <label className="mt-5 block text-sm font-medium">Product name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary">
                  <option>Cookies</option>
                  <option>Sweets</option>
                  <option>Rusk</option>
                  <option>Puff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Tag</label>
                <input value={form.tag} placeholder="Offer, Fresh, New" onChange={(e) => setForm({ ...form, tag: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Price AED</label>
                <input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium">Old price</label>
                <input type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
              </div>
            </div>

            <label className="mt-4 block text-sm font-medium">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />

            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-secondary/50 px-4 py-5 text-sm font-medium text-primary">
              <ImagePlus className="h-5 w-5" />
              {image ? image.name : "Upload product image"}
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="hidden" />
            </label>

            {editingProduct?.imageUrl && !image && (
              <img src={assetUrl(editingProduct.imageUrl)} alt="" className="mt-4 aspect-video w-full rounded-2xl object-cover" />
            )}

            <label className="mt-4 flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-primary" />
              Show this product on the website
            </label>

            <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {busy ? "Saving..." : editingId ? "Save changes" : "Add product"}
            </button>
          </form>

          <div className="grid gap-4">
            {products.map((product) => (
              <article key={product.id} className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-glass sm:grid-cols-[140px_1fr_auto]">
                <img src={assetUrl(product.imageUrl)} alt={product.name} className="aspect-square w-full rounded-2xl object-cover sm:w-[140px]" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-caramel">{product.category}</span>
                    {product.isActive === false ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-3.5 w-3.5" /> Hidden</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-primary"><Eye className="h-3.5 w-3.5" /> Live</span>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-2xl leading-tight">{product.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">AED {product.price.toFixed(2)}{product.originalPrice ? ` / old AED ${product.originalPrice.toFixed(2)}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
                  <button onClick={() => startEdit(product)} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
                    <Edit3 className="h-4 w-4" /> Edit
                  </button>
                  <button onClick={() => deleteProduct(product.id)} className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
