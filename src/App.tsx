import {
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, assetUrl, type DeliveryLocation, type Product } from "./lib/api";

const emptyForm = {
  name: "",
  category: "Cookies",
  price: "",
  originalPrice: "",
  tag: "",
  description: "",
  urlSlug: "",
  metaTitle: "",
  metaDescription: "",
  imageAlt: "",
  isActive: true,
};

type ProductForm = typeof emptyForm;
type SeoField = "urlSlug" | "metaTitle" | "metaDescription" | "imageAlt";
type SeoEditState = Record<SeoField, boolean>;

function createSeoEditState(value = false): SeoEditState {
  return {
    urlSlug: value,
    metaTitle: value,
    metaDescription: value,
    imageAlt: value,
  };
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateSeoFields(nameValue: string, categoryValue: string): Pick<ProductForm, SeoField> {
  const name = nameValue.trim();
  const category = categoryValue.trim();
  const lowerName = name.toLowerCase();
  const lowerCategory = category.toLowerCase();

  if (!name) {
    return {
      urlSlug: "",
      metaTitle: "",
      metaDescription: "",
      imageAlt: "",
    };
  }

  return {
    urlSlug: normalizeSlug(`${category} ${name}`),
    metaTitle: `${name} - ${category} | Zekra Sweets`,
    metaDescription: `Order ${name} from Zekra Sweets. Fresh handmade ${lowerCategory} baked with care in Ajman, UAE.`,
    imageAlt: lowerName.includes(lowerCategory)
      ? `${name} from Zekra Sweets`
      : `${name} ${lowerCategory} from Zekra Sweets`,
  };
}

function applyGeneratedSeo(nextForm: ProductForm, editedSeoFields: SeoEditState): ProductForm {
  const generated = generateSeoFields(nextForm.name, nextForm.category);

  return {
    ...nextForm,
    urlSlug: editedSeoFields.urlSlug ? nextForm.urlSlug : generated.urlSlug,
    metaTitle: editedSeoFields.metaTitle ? nextForm.metaTitle : generated.metaTitle,
    metaDescription: editedSeoFields.metaDescription ? nextForm.metaDescription : generated.metaDescription,
    imageAlt: editedSeoFields.imageAlt ? nextForm.imageAlt : generated.imageAlt,
  };
}

const emptyLocationForm = {
  name: "",
  charge: "",
  isActive: true,
};

type LocationForm = typeof emptyLocationForm;

export default function App() {
  const [token, setToken] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editedSeoFields, setEditedSeoFields] = useState<SeoEditState>(() => createSeoEditState());
  const [locationForm, setLocationForm] = useState<LocationForm>(emptyLocationForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationBusyId, setLocationBusyId] = useState<string | null>(null);

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
    loadDeliveryLocations(token);
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

  async function loadDeliveryLocations(authToken = token) {
    setLocationsLoading(true);
    try {
      setDeliveryLocations(
        await apiFetch<DeliveryLocation[]>("/api/admin/delivery-locations", {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load delivery locations");
    } finally {
      setLocationsLoading(false);
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
      resetProductForm();
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
    const generated = generateSeoFields(product.name, product.category);
    const nextForm = {
      name: product.name,
      category: product.category,
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      tag: product.tag || "",
      description: product.description || "",
      urlSlug: product.urlSlug || "",
      metaTitle: product.metaTitle || "",
      metaDescription: product.metaDescription || "",
      imageAlt: product.imageAlt || "",
      isActive: product.isActive !== false,
    };
    const nextEditedSeoFields = {
      urlSlug: Boolean(product.urlSlug && product.urlSlug !== generated.urlSlug),
      metaTitle: Boolean(product.metaTitle && product.metaTitle !== generated.metaTitle),
      metaDescription: Boolean(product.metaDescription && product.metaDescription !== generated.metaDescription),
      imageAlt: Boolean(product.imageAlt && product.imageAlt !== generated.imageAlt),
    };

    setEditingId(product.id);
    setEditedSeoFields(nextEditedSeoFields);
    setForm(applyGeneratedSeo(nextForm, nextEditedSeoFields));
    setImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    setEditingId(null);
    setForm(emptyForm);
    setEditedSeoFields(createSeoEditState());
    setImage(null);
  }

  function updateProductIdentity(updates: Partial<Pick<ProductForm, "name" | "category">>) {
    setForm((currentForm) => applyGeneratedSeo({ ...currentForm, ...updates }, editedSeoFields));
  }

  function updateSeoField(field: SeoField, value: string) {
    setEditedSeoFields((currentFields) => ({ ...currentFields, [field]: true }));
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function regenerateSeoFields() {
    setForm((currentForm) => ({ ...currentForm, ...generateSeoFields(currentForm.name, currentForm.category) }));
    setEditedSeoFields(createSeoEditState());
  }

  async function saveDeliveryLocation(event: FormEvent) {
    event.preventDefault();
    setLocationBusy(true);
    setMessage("");

    const charge = Number(locationForm.charge);
    if (!locationForm.name.trim() || !Number.isFinite(charge) || charge < 0) {
      setMessage("Add a location name and a valid AED charge.");
      setLocationBusy(false);
      return;
    }

    try {
      await apiFetch<DeliveryLocation>(
        editingLocationId
          ? `/api/admin/delivery-locations/${editingLocationId}`
          : "/api/admin/delivery-locations",
        {
          method: editingLocationId ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: locationForm.name.trim(),
            charge,
            isActive: locationForm.isActive,
          }),
        },
      );
      setLocationForm(emptyLocationForm);
      setEditingLocationId(null);
      setMessage(editingLocationId ? "Delivery location updated." : "Delivery location added.");
      await loadDeliveryLocations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save delivery location");
    } finally {
      setLocationBusy(false);
    }
  }

  function startEditLocation(location: DeliveryLocation) {
    setEditingLocationId(location.id);
    setLocationForm({
      name: location.name,
      charge: String(location.charge),
      isActive: location.isActive !== false,
    });
  }

  function resetLocationForm() {
    setEditingLocationId(null);
    setLocationForm(emptyLocationForm);
  }

  async function toggleDeliveryLocation(location: DeliveryLocation) {
    setLocationBusyId(location.id);
    setMessage("");
    try {
      await apiFetch<DeliveryLocation>(`/api/admin/delivery-locations/${location.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: location.name,
          charge: Number(location.charge),
          isActive: !(location.isActive !== false),
        }),
      });
      await loadDeliveryLocations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update delivery location");
    } finally {
      setLocationBusyId(null);
    }
  }

  async function deleteDeliveryLocation(id: string) {
    if (!confirm("Delete this delivery location?")) return;
    setLocationBusyId(id);
    setMessage("");
    try {
      await apiFetch(`/api/admin/delivery-locations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (editingLocationId === id) resetLocationForm();
      setMessage("Delivery location deleted.");
      await loadDeliveryLocations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete delivery location");
    } finally {
      setLocationBusyId(null);
    }
  }

  function logout() {
    localStorage.removeItem("adminToken");
    setToken("");
    setProducts([]);
    setDeliveryLocations([]);
    resetLocationForm();
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
            <h1 className="mt-2 font-display text-4xl">Store admin</h1>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>

        {message && <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-3 text-sm">{message}</div>}

        <section className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]">
          <form onSubmit={saveDeliveryLocation} className="h-fit rounded-3xl border border-border bg-card p-5 shadow-glass">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">Delivery locations</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Customer checkout rates
                </p>
              </div>
              {editingLocationId && (
                <button type="button" onClick={resetLocationForm} className="text-sm text-primary">
                  New
                </button>
              )}
            </div>

            <label className="mt-5 block text-sm font-medium">Location name</label>
            <input
              required
              value={locationForm.name}
              onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
              placeholder="Dubai"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />

            <label className="mt-4 block text-sm font-medium">Charge AED</label>
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={locationForm.charge}
              onChange={(e) => setLocationForm({ ...locationForm, charge: e.target.value })}
              placeholder="25.00"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />

            <label className="mt-4 flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={locationForm.isActive}
                onChange={(e) => setLocationForm({ ...locationForm, isActive: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Show at checkout
            </label>

            <button disabled={locationBusy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
              {editingLocationId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {locationBusy ? "Saving..." : editingLocationId ? "Save location" : "Add location"}
            </button>
          </form>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-glass">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-2xl">Locations</h2>
                  <p className="text-sm text-muted-foreground">{deliveryLocations.length} configured</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadDeliveryLocations()}
                disabled={locationsLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                {locationsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>

            {locationsLoading && deliveryLocations.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Loading delivery locations...
              </div>
            ) : deliveryLocations.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No delivery locations yet.
              </div>
            ) : (
              <div className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {deliveryLocations.map((location) => {
                  const active = location.isActive !== false;
                  const rowBusy = locationBusyId === location.id;

                  return (
                    <article key={location.id} className="grid gap-3 bg-background/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-xl leading-tight">{location.name}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${active ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>
                            {active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {active ? "Live" : "Hidden"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">AED {Number(location.charge).toFixed(2)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDeliveryLocation(location)}
                          disabled={rowBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                        >
                          {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {active ? "Hide" : "Show"}
                        </button>
                        <button onClick={() => startEditLocation(location)} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
                          <Edit3 className="h-4 w-4" /> Edit
                        </button>
                        <button onClick={() => deleteDeliveryLocation(location.id)} disabled={rowBusy} className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <form onSubmit={saveProduct} className="h-fit rounded-3xl border border-border bg-card p-5 shadow-glass">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{editingId ? "Edit product" : "Add product"}</h2>
              {editingId && (
                <button type="button" onClick={resetProductForm} className="text-sm text-primary">
                  New product
                </button>
              )}
            </div>

            <label className="mt-5 block text-sm font-medium">Product name</label>
            <input required value={form.name} onChange={(e) => updateProductIdentity({ name: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Category</label>
                <select value={form.category} onChange={(e) => updateProductIdentity({ category: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary">
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

            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl">SEO and image text</h3>
                <button type="button" onClick={regenerateSeoFields} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary">
                  <RefreshCw className="h-3.5 w-3.5" /> Auto-fill SEO
                </button>
              </div>

              <label className="mt-4 block text-sm font-medium">URL slug</label>
              <input value={form.urlSlug} onChange={(e) => updateSeoField("urlSlug", e.target.value)} placeholder="cookies-premium-almond-cookies" className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary" />

              <label className="mt-4 block text-sm font-medium">Meta title</label>
              <input value={form.metaTitle} onChange={(e) => updateSeoField("metaTitle", e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary" />

              <label className="mt-4 block text-sm font-medium">Meta description</label>
              <textarea value={form.metaDescription} onChange={(e) => updateSeoField("metaDescription", e.target.value)} rows={2} className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary" />

              <label className="mt-4 block text-sm font-medium">Image alt text</label>
              <input value={form.imageAlt} onChange={(e) => updateSeoField("imageAlt", e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary" />
            </div>

            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-secondary/50 px-4 py-5 text-sm font-medium text-primary">
              <ImagePlus className="h-5 w-5" />
              {image ? image.name : "Upload product image"}
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="hidden" />
            </label>

            {editingProduct?.imageUrl && !image && (
              <img src={assetUrl(editingProduct.imageUrl)} alt={editingProduct.imageAlt || editingProduct.name} className="mt-4 aspect-video w-full rounded-2xl object-cover" />
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
                <img src={assetUrl(product.imageUrl)} alt={product.imageAlt || product.name} className="aspect-square w-full rounded-2xl object-cover sm:w-[140px]" />
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
                  {product.urlSlug && (
                    <p title={`/${product.urlSlug}`} className="mt-1 max-w-full truncate font-mono text-xs text-muted-foreground">
                      /{product.urlSlug}
                    </p>
                  )}
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
