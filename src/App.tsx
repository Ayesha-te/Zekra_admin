import {
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Filter,
  ImagePlus,
  Loader2,
  LogOut,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  assetUrl,
  fetchAdminOrders,
  updateAdminOrderStatus,
  type AdminOrder,
  type DeliveryLocation,
  type OrderStatus,
  type Product,
  type ProductSizeOption,
} from "./lib/api";
import {
  downloadOrderPdf,
  downloadOrdersCsv,
  formatDateTime,
  formatMoney,
  fulfillmentLabel,
  fulfillmentMode,
  orderDeliveryFee,
  orderItemCount,
  orderSearchText,
  orderStatusLabels,
  orderStatuses,
  orderSubtotal,
  orderTotal,
  paymentMethodLabel,
  paymentStatusLabel,
} from "./lib/orders";

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
type ProductSizeForm = {
  id?: string;
  label: string;
  price: string;
  originalPrice: string;
};
type AdminTab = "orders" | "products" | "locations";
type OrderFilter = OrderStatus | "all";

const emptyLocationForm = {
  name: "",
  charge: "",
  isActive: true,
};

type LocationForm = typeof emptyLocationForm;

function generatedImageAlt(nameValue: string, categoryValue: string) {
  const displayName = nameValue.trim().replace(/\s*\|\s*/g, " - ");
  const category = categoryValue.trim();
  const lowerName = displayName.toLowerCase();
  const lowerCategory = category.toLowerCase();
  if (!displayName) return category || "Zekra Sweets product";
  return lowerCategory && !lowerName.includes(lowerCategory) ? `${displayName} - ${category}` : displayName;
}

function productImageUrls(product?: Pick<Product, "imageUrl" | "imageUrls"> | null) {
  if (!product) return [];

  return [
    ...new Set(
      [product.imageUrl, ...(product.imageUrls || [])]
        .map((url) => url?.trim())
        .filter((url): url is string => Boolean(url)),
    ),
  ];
}

function productSizes(product?: Pick<Product, "sizes" | "price" | "originalPrice"> | null) {
  const sizes = product?.sizes || [];
  return sizes.filter((size) => size.label && Number.isFinite(Number(size.price)));
}

function productPriceSummary(product: Product) {
  const sizes = productSizes(product);
  if (sizes.length === 0) {
    return `AED ${product.price.toFixed(2)}${product.originalPrice ? ` / old AED ${product.originalPrice.toFixed(2)}` : ""}`;
  }

  return sizes
    .map(
      (size) =>
        `${size.label}: AED ${Number(size.price).toFixed(2)}${
          size.originalPrice ? ` / old AED ${Number(size.originalPrice).toFixed(2)}` : ""
        }`,
    )
    .join(" • ");
}

function sizeFormsFromProduct(product: Product): ProductSizeForm[] {
  return productSizes(product).map((size) => ({
    id: size.id,
    label: size.label,
    price: String(size.price),
    originalPrice: size.originalPrice ? String(size.originalPrice) : "",
  }));
}

function sizePayload(sizes: ProductSizeForm[]): ProductSizeOption[] {
  return sizes
    .filter((size) => size.label.trim() || size.price.trim() || size.originalPrice.trim())
    .map((size) => ({
      id: size.id,
      label: size.label.trim(),
      price: Number(size.price),
      originalPrice: size.originalPrice.trim() ? Number(size.originalPrice) : null,
    }))
}

function statusTone(status: OrderStatus) {
  switch (status) {
    case "new":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "confirmed":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "preparing":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "completed":
      return "border-green-200 bg-green-50 text-green-800";
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function activeTabClass(active: boolean) {
  return active
    ? "border-primary bg-gradient-gold text-primary-foreground shadow-glow"
    : "border-border bg-background/70 text-muted-foreground hover:border-primary/40 hover:bg-secondary hover:text-foreground";
}

function actionButtonClass(tone: "neutral" | "primary" | "danger" = "neutral") {
  if (tone === "primary") {
    return "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition disabled:opacity-60";
  }
  if (tone === "danger") {
    return "inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60";
  }
  return "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-60";
}

function shortOrderDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function App() {
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [productSizeForms, setProductSizeForms] = useState<ProductSizeForm[]>([]);
  const [locationForm, setLocationForm] = useState<LocationForm>(emptyLocationForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderBusyId, setOrderBusyId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationBusyId, setLocationBusyId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admin - Zekra Sweets";
  }, []);

  useEffect(() => {
    setToken(localStorage.getItem("adminToken") || "");
  }, []);

  useEffect(() => {
    if (!token) return;
    loadOrders(token);
    loadProducts(token);
    loadDeliveryLocations(token);
  }, [token]);

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingId),
    [editingId, products],
  );

  useEffect(() => {
    const previewUrls = images.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls(previewUrls);

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
      const matchesSearch = !query || orderSearchText(order).includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const activeOrder = useMemo(() => {
    if (selectedOrderId) {
      const selectedVisibleOrder = filteredOrders.find((order) => order.id === selectedOrderId);
      if (selectedVisibleOrder) return selectedVisibleOrder;
    }

    return filteredOrders[0] || null;
  }, [filteredOrders, selectedOrderId]);

  const detailOrder = useMemo(
    () => (detailOrderId ? orders.find((order) => order.id === detailOrderId) || null : null),
    [detailOrderId, orders],
  );

  useEffect(() => {
    if (!detailOrderId) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailOrderId(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailOrderId]);

  const orderMetrics = useMemo(() => {
    const openOrders = orders.filter((order) => order.status !== "completed" && order.status !== "cancelled").length;
    const completedOrders = orders.filter((order) => order.status === "completed").length;
    const revenue = orders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + orderTotal(order), 0);

    return [
      { label: "Total orders", value: String(orders.length), detail: "Loaded in admin", icon: ClipboardList },
      { label: "Open orders", value: String(openOrders), detail: "New to ready", icon: Truck },
      { label: "Completed", value: String(completedOrders), detail: "Finished orders", icon: CheckCircle2 },
      { label: "Total revenue", value: formatMoney(revenue), detail: "Excluding cancelled", icon: PackageCheck },
    ];
  }, [orders]);

  async function loadOrders(authToken = token) {
    setOrdersLoading(true);
    try {
      const nextOrders = await fetchAdminOrders(authToken);
      setOrders(nextOrders);
      setSelectedOrderId((currentId) =>
        currentId && nextOrders.some((order) => order.id === currentId) ? currentId : nextOrders[0]?.id ?? null,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load orders");
    } finally {
      setOrdersLoading(false);
    }
  }

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
    payload.append("sizes", JSON.stringify(sizePayload(productSizeForms)));
    payload.append("imageUrls", JSON.stringify(existingImageUrls));
    if (existingImageUrls[0]) payload.append("imageUrl", existingImageUrls[0]);
    images.forEach((file) => payload.append("images", file));

    try {
      await apiFetch<Product>(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      resetProductForm();
      setEditingId(null);
      setImages([]);
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
    const nextForm = {
      name: product.name,
      category: product.category,
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      tag: product.tag || "",
      description: product.description || "",
      isActive: product.isActive !== false,
    };

    setEditingId(product.id);
    setForm(nextForm);
    setProductSizeForms(sizeFormsFromProduct(product));
    setExistingImageUrls(productImageUrls(product));
    setImages([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    setEditingId(null);
    setForm(emptyForm);
    setProductSizeForms([]);
    setExistingImageUrls([]);
    setImages([]);
  }

  function updateProductIdentity(updates: Partial<Pick<ProductForm, "name" | "category">>) {
    setForm((currentForm) => ({ ...currentForm, ...updates }));
  }

  function handleImageSelection(files: FileList | null) {
    const nextFiles = Array.from(files || []);
    if (nextFiles.length === 0) return;
    setImages((currentImages) => [...currentImages, ...nextFiles]);
  }

  function removeExistingImage(url: string) {
    setExistingImageUrls((currentUrls) => currentUrls.filter((currentUrl) => currentUrl !== url));
  }

  function removeSelectedImage(index: number) {
    setImages((currentImages) => currentImages.filter((_, currentIndex) => currentIndex !== index));
  }

  function addProductSize() {
    setProductSizeForms((currentSizes) => [
      ...currentSizes,
      { label: "", price: "", originalPrice: "" },
    ]);
  }

  function updateProductSize(index: number, updates: Partial<ProductSizeForm>) {
    setProductSizeForms((currentSizes) =>
      currentSizes.map((size, currentIndex) =>
        currentIndex === index ? { ...size, ...updates } : size,
      ),
    );
  }

  function removeProductSize(index: number) {
    setProductSizeForms((currentSizes) => currentSizes.filter((_, currentIndex) => currentIndex !== index));
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

  async function changeOrderStatus(order: AdminOrder, status: OrderStatus) {
    if (order.status === status) return;
    setOrderBusyId(order.id);
    setMessage("");

    try {
      const updatedOrder = await updateAdminOrderStatus(token, order.id, status);
      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) => (currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder)),
      );
      setSelectedOrderId(updatedOrder.id);
      setMessage(`Order ${updatedOrder.id} marked ${orderStatusLabels[updatedOrder.status]}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update order status");
    } finally {
      setOrderBusyId(null);
    }
  }

  function openOrderDetails(order: AdminOrder) {
    setSelectedOrderId(order.id);
    setDetailOrderId(order.id);
  }

  function renderOrderDetails(order: AdminOrder) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>
              {orderStatusLabels[order.status]}
            </span>
            <h3 className="mt-3 break-all font-mono text-sm font-semibold">{order.id}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
          </div>
          <button type="button" onClick={() => downloadOrderPdf(order)} className={actionButtonClass()}>
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {orderStatuses.map((status) => (
            <button
              key={status}
              type="button"
              disabled={orderBusyId === order.id}
              onClick={() => changeOrderStatus(order, status)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                order.status === status
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              {orderStatusLabels[status]}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-5 text-sm">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Customer</h4>
            <dl className="mt-3 grid gap-3">
              <DetailRow label="Name" value={order.customer.name || "-"} />
              <DetailRow label="Phone" value={order.customer.phone || "-"} />
              {order.customer.email && <DetailRow label="Email" value={order.customer.email} />}
            </dl>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fulfillment</h4>
            <dl className="mt-3 grid gap-3">
              <DetailRow label="Type" value={fulfillmentMode(order) === "pickup" ? "Pickup" : "Delivery"} />
              <DetailRow label="Location" value={order.fulfillment.locationName || "-"} />
              <DetailRow label="Address" value={order.fulfillment.address || "-"} />
              {order.notes && <DetailRow label="Notes" value={order.notes} />}
            </dl>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment</h4>
            <dl className="mt-3 grid gap-3">
              <DetailRow label="Method" value={paymentMethodLabel(order)} />
              <DetailRow label="Status" value={paymentStatusLabel(order)} />
              {order.payment?.stripeSessionId && (
                <DetailRow label="Stripe" value={order.payment.stripeSessionId} />
              )}
            </dl>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Items</h4>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <div className="hidden grid-cols-[minmax(0,1fr)_46px_82px] gap-2 bg-muted/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
                <span>Item</span>
                <span>Qty</span>
                <span>Total</span>
              </div>
              <div className="divide-y divide-border">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.productId || item.id || item.name}`} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_46px_82px]">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatMoney(item.unitPrice)} each</p>
                    </div>
                    <p className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-2 py-1 font-semibold sm:block sm:bg-transparent sm:px-0 sm:py-0">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:hidden">Qty</span>
                      {item.quantity}
                    </p>
                    <p className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-2 py-1 font-semibold sm:block sm:bg-transparent sm:px-0 sm:py-0">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:hidden">Line</span>
                      {formatMoney(Number(item.lineTotal ?? item.quantity * item.unitPrice))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-border pt-4">
            <div className="space-y-2">
              <TotalRow label="Subtotal" value={formatMoney(orderSubtotal(order))} />
              <TotalRow label="Delivery" value={formatMoney(orderDeliveryFee(order))} />
              <TotalRow label="Total" value={formatMoney(orderTotal(order))} strong />
            </div>
          </section>
        </div>
      </div>
    );
  }

  function logout() {
    localStorage.removeItem("adminToken");
    setToken("");
    setOrders([]);
    setProducts([]);
    setDeliveryLocations([]);
    setSelectedOrderId(null);
    setDetailOrderId(null);
    setActiveTab("orders");
    resetProductForm();
    resetLocationForm();
  }

  function renderOrdersTab() {
    return (
      <section className="mt-8 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {orderMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article key={metric.label} className="rounded-2xl border border-border bg-card p-4 shadow-glass">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 truncate font-display text-3xl leading-none">{metric.value}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{metric.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-glass sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredOrders.length} shown from {orders.length} loaded
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadOrders()}
                disabled={ordersLoading}
                className={actionButtonClass()}
              >
                {ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => downloadOrdersCsv(orders)}
                disabled={orders.length === 0}
                className={actionButtonClass("primary")}
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Search order, customer, phone, item"
                className="w-full rounded-xl border border-border bg-background px-10 py-3 text-sm outline-none transition focus:border-primary"
              />
            </label>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value as OrderFilter)}
                className="w-full appearance-none rounded-xl border border-border bg-background px-10 py-3 text-sm font-medium outline-none transition focus:border-primary"
              >
                <option value="all">All statuses</option>
                {orderStatuses.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {ordersLoading && orders.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No customer orders yet.
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No orders match those filters.
            </div>
          ) : (
            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="hidden grid-cols-[minmax(120px,1fr)_minmax(125px,0.95fr)_minmax(150px,1.1fr)_44px_86px_118px_104px] gap-2 border-b border-border bg-muted/70 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
                  <span>Order / date</span>
                  <span>Customer</span>
                  <span>Fulfillment</span>
                  <span>Items</span>
                  <span>Total</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>

                <div className="divide-y divide-border">
                  {filteredOrders.map((order) => {
                    const selected = activeOrder?.id === order.id;
                    const updating = orderBusyId === order.id;

                    return (
                      <article
                        key={order.id}
                        className={`grid gap-3 bg-background/60 p-4 transition hover:bg-secondary/30 lg:grid-cols-[minmax(120px,1fr)_minmax(125px,0.95fr)_minmax(150px,1.1fr)_44px_86px_118px_104px] lg:items-center lg:gap-2 lg:px-3 ${
                          selected ? "bg-secondary/45" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-cocoa break-all">{order.id}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{shortOrderDate(order.createdAt)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{order.customer.name || "Customer"}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{order.customer.phone || "No phone"}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{fulfillmentLabel(order)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {order.fulfillment.address || order.fulfillment.preferredDate || "No details"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          <span className="text-xs font-medium text-muted-foreground lg:hidden">Items </span>
                          {orderItemCount(order)}
                        </p>
                        <p className="text-sm font-semibold">{formatMoney(orderTotal(order))}</p>
                        <select
                          value={order.status}
                          onChange={(event) => changeOrderStatus(order, event.target.value as OrderStatus)}
                          disabled={updating}
                          aria-label={`Change status for ${order.id}`}
                          className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition focus:border-primary disabled:opacity-60 ${statusTone(order.status)}`}
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {orderStatusLabels[status]}
                            </option>
                          ))}
                        </select>
                        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch lg:gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOrderDetails(order)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-card lg:w-full lg:flex-none"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadOrderPdf(order)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-card lg:w-full lg:flex-none"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="h-fit rounded-2xl border border-border bg-background/70 p-4 xl:sticky xl:top-6">
                {activeOrder ? (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${statusTone(activeOrder.status)}`}>
                          {orderStatusLabels[activeOrder.status]}
                        </span>
                        <h3 className="mt-3 break-all font-mono text-sm font-semibold">{activeOrder.id}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(activeOrder.createdAt)}</p>
                      </div>
                      <button type="button" onClick={() => downloadOrderPdf(activeOrder)} className={actionButtonClass()}>
                        <Download className="h-4 w-4" />
                        PDF
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {orderStatuses.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={orderBusyId === activeOrder.id}
                          onClick={() => changeOrderStatus(activeOrder, status)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                            activeOrder.status === status
                              ? "border-primary bg-secondary text-primary"
                              : "border-border bg-card hover:bg-secondary"
                          }`}
                        >
                          {orderStatusLabels[status]}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 space-y-5 text-sm">
                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Customer</h4>
                        <dl className="mt-3 grid gap-3">
                          <DetailRow label="Name" value={activeOrder.customer.name || "-"} />
                          <DetailRow label="Phone" value={activeOrder.customer.phone || "-"} />
                          {activeOrder.customer.email && <DetailRow label="Email" value={activeOrder.customer.email} />}
                        </dl>
                      </section>

                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fulfillment</h4>
                        <dl className="mt-3 grid gap-3">
                          <DetailRow label="Type" value={fulfillmentMode(activeOrder) === "pickup" ? "Pickup" : "Delivery"} />
                          <DetailRow label="Location" value={activeOrder.fulfillment.locationName || "-"} />
                          <DetailRow label="Address" value={activeOrder.fulfillment.address || "-"} />
                          {activeOrder.notes && <DetailRow label="Notes" value={activeOrder.notes} />}
                        </dl>
                      </section>

                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment</h4>
                        <dl className="mt-3 grid gap-3">
                          <DetailRow label="Method" value={paymentMethodLabel(activeOrder)} />
                          <DetailRow label="Status" value={paymentStatusLabel(activeOrder)} />
                          {activeOrder.payment?.stripeSessionId && (
                            <DetailRow label="Stripe" value={activeOrder.payment.stripeSessionId} />
                          )}
                        </dl>
                      </section>

                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Items</h4>
                        <div className="mt-3 overflow-hidden rounded-xl border border-border">
                          <div className="hidden grid-cols-[minmax(0,1fr)_46px_82px] gap-2 bg-muted/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
                            <span>Item</span>
                            <span>Qty</span>
                            <span>Total</span>
                          </div>
                          <div className="divide-y divide-border">
                            {activeOrder.items.map((item) => (
                              <div key={`${activeOrder.id}-${item.productId || item.id || item.name}`} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_46px_82px]">
                                <div className="min-w-0">
                                  <p className="break-words font-semibold">{item.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{formatMoney(item.unitPrice)} each</p>
                                </div>
                                <p className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-2 py-1 font-semibold sm:block sm:bg-transparent sm:px-0 sm:py-0">
                                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:hidden">Qty</span>
                                  {item.quantity}
                                </p>
                                <p className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-2 py-1 font-semibold sm:block sm:bg-transparent sm:px-0 sm:py-0">
                                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:hidden">Line</span>
                                  {formatMoney(Number(item.lineTotal ?? item.quantity * item.unitPrice))}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="border-t border-border pt-4">
                        <div className="space-y-2">
                          <TotalRow label="Subtotal" value={formatMoney(orderSubtotal(activeOrder))} />
                          <TotalRow label="Delivery" value={formatMoney(orderDeliveryFee(activeOrder))} />
                          <TotalRow label="Total" value={formatMoney(orderTotal(activeOrder))} strong />
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    Select an order to inspect details.
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderProductsTab() {
    const galleryPreviews = [
      ...existingImageUrls.map((url) => ({
        key: `existing-${url}`,
        src: assetUrl(url),
        label: "Saved image",
        onRemove: () => removeExistingImage(url),
      })),
      ...images.map((file, index) => ({
        key: `selected-${file.name}-${index}`,
        src: imagePreviewUrls[index] || "",
        label: file.name,
        onRemove: () => removeSelectedImage(index),
      })),
    ];

    return (
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
              <label className="block text-sm font-medium">Fallback price AED</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium">Fallback old price</label>
              <input type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-xl">Size prices</h3>
                <p className="mt-1 text-xs text-muted-foreground">Add sizes such as 250g, 500g, 1kg, box, or tray.</p>
              </div>
              <button type="button" onClick={addProductSize} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
                <Plus className="h-3.5 w-3.5" /> Add size
              </button>
            </div>

            {productSizeForms.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No size prices yet. The fallback price will be used.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {productSizeForms.map((size, index) => (
                  <div key={`${size.id || "new"}-${index}`} className="grid gap-2 rounded-xl border border-border bg-card p-3">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_110px_40px]">
                      <input
                        value={size.label}
                        onChange={(e) => updateProductSize(index, { label: e.target.value })}
                        placeholder="Size label"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={size.price}
                        onChange={(e) => updateProductSize(index, { price: e.target.value })}
                        placeholder="AED"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={size.originalPrice}
                        onChange={(e) => updateProductSize(index, { originalPrice: e.target.value })}
                        placeholder="Old AED"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeProductSize(index)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-destructive/30 text-destructive transition hover:bg-destructive/10"
                        aria-label={`Remove size ${size.label || index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="mt-4 block text-sm font-medium">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary" />

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-secondary/50 px-4 py-5 text-sm font-medium text-primary">
            <ImagePlus className="h-5 w-5" />
            {images.length > 0 ? `${images.length} new image${images.length === 1 ? "" : "s"} selected` : "Add product images"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                handleImageSelection(e.target.files);
                e.currentTarget.value = "";
              }}
              className="hidden"
            />
          </label>

          {galleryPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {galleryPreviews.map((preview, index) => (
                <div key={preview.key} className="group relative overflow-hidden rounded-2xl border border-border bg-background">
                  <img
                    src={preview.src}
                    alt={generatedImageAlt(form.name || editingProduct?.name || "", form.category || editingProduct?.category || "")}
                    className="aspect-square w-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={preview.onRemove}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-glass transition hover:bg-destructive hover:text-destructive-foreground"
                    aria-label={`Remove ${preview.label}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
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
          <div>
            <h2 className="font-display text-2xl">Products</h2>
            <p className="mt-1 text-sm text-muted-foreground">{products.length} configured products</p>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No products yet.
            </div>
          ) : (
            products.map((product) => {
              const productImages = productImageUrls(product);
              const primaryImage = productImages[0] || product.imageUrl;

              return (
                <article key={product.id} className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-glass sm:grid-cols-[140px_1fr_auto]">
                  {primaryImage ? (
                    <img src={assetUrl(primaryImage)} alt={product.imageAlt || generatedImageAlt(product.name, product.category)} className="aspect-square w-full rounded-2xl object-cover sm:w-[140px]" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-2xl bg-secondary text-primary sm:w-[140px]">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-caramel">{product.category}</span>
                      {productImages.length > 1 && (
                        <span className="rounded-full bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {productImages.length} images
                        </span>
                      )}
                      {product.isActive === false ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-3.5 w-3.5" /> Hidden</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-primary"><Eye className="h-3.5 w-3.5" /> Live</span>
                      )}
                    </div>
                    <h3 className="mt-3 font-display text-2xl leading-tight">{product.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{productPriceSummary(product)}</p>
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
              );
            })
          )}
        </div>
      </section>
    );
  }

  function renderLocationsTab() {
    return (
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
    );
  }

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-elegant">
          <h1 className="font-display text-3xl">Admin login</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage Zekra Sweets products, orders, and delivery locations.</p>
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

  const tabs = [
    { id: "orders" as const, label: "Orders", count: orders.length, icon: ClipboardList },
    { id: "products" as const, label: "Products", count: products.length, icon: ShoppingBag },
    { id: "locations" as const, label: "Delivery", count: deliveryLocations.length, icon: MapPin },
  ];

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

        <nav className="mt-6 flex flex-wrap gap-2 rounded-3xl border border-border bg-card p-2 shadow-glass" aria-label="Admin sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-12 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${activeTabClass(activeTab === tab.id)}`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                <span className="rounded-lg bg-card/70 px-2 py-0.5 text-xs text-cocoa">{tab.count}</span>
              </button>
            );
          })}
        </nav>

        {message && <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-3 text-sm">{message}</div>}

        {activeTab === "orders" && renderOrdersTab()}
        {activeTab === "products" && renderProductsTab()}
        {activeTab === "locations" && renderLocationsTab()}

        {detailOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDetailOrderId(null);
            }}
          >
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-caramel">Order details</p>
                  <h2 id="order-details-title" className="mt-2 font-display text-2xl">
                    {detailOrder.customer.name || detailOrder.id}
                  </h2>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detailOrder.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailOrderId(null)}
                  aria-label="Close order details"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5">{renderOrderDetails(detailOrder)}</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl bg-card/70 px-3 py-2 sm:grid-cols-[96px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-semibold">{value}</dd>
    </div>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "font-display text-xl" : "text-sm"}`}>
      <span className={strong ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
