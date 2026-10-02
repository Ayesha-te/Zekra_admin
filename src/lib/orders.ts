import type { AdminOrder, OrderStatus } from "./api";

export const orderStatuses: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "collected",
  "cancelled",
];

export const orderStatusLabels: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  completed: "Delivered",
  collected: "Collected",
  cancelled: "Cancelled",
};

const moneyFormatter = new Intl.NumberFormat("en-AE", {
  currency: "AED",
  style: "currency",
});

export function formatMoney(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return moneyFormatter.format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(date);
}

export function fulfillmentMode(order: AdminOrder) {
  return (
    order.fulfillment.type ||
    order.fulfillment.mode ||
    "delivery"
  ).toLowerCase();
}

export function fulfillmentLabel(order: AdminOrder) {
  const mode = fulfillmentMode(order) === "pickup" ? "Pickup" : "Delivery";
  return order.fulfillment.locationName
    ? `${mode} - ${order.fulfillment.locationName}`
    : mode;
}

export function orderItemCount(order: AdminOrder) {
  return order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function orderLineTotal(item: AdminOrder["items"][number]) {
  const saved = Number(item.lineTotal);
  if (Number.isFinite(saved)) return saved;

  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  return Number((quantity * unitPrice).toFixed(2));
}

export function orderItemLabel(item: AdminOrder["items"][number]) {
  const comboSummary = Array.isArray(item.comboSelectionItems)
    ? item.comboSelectionItems
        .map((selection) => {
          const name = String(selection.name || "").trim();
          const sizeLabel = String(selection.sizeLabel || "").trim();
          if (!name) return "";
          return sizeLabel ? `${name} (${sizeLabel})` : name;
        })
        .filter(Boolean)
        .join(", ")
    : "";

  if (comboSummary) return `${item.name} - Selected sizes: ${comboSummary}`;
  return item.sizeLabel ? `${item.name} (${item.sizeLabel})` : item.name;
}

export function orderSubtotal(order: AdminOrder) {
  const saved = Number(order.totals.subtotal);
  if (Number.isFinite(saved)) return saved;
  return Number(
    order.items.reduce((sum, item) => sum + orderLineTotal(item), 0).toFixed(2),
  );
}

export function orderDeliveryFee(order: AdminOrder) {
  const saved = Number(order.totals.deliveryFee ?? order.totals.delivery ?? 0);
  return Number.isFinite(saved) ? saved : 0;
}

export function orderVat(order: AdminOrder) {
  const saved = Number(order.totals.vat);
  if (Number.isFinite(saved)) return saved;
  return Number(
    Math.max(0, orderSubtotal(order) - orderDiscount(order) + orderDeliveryFee(order))
      .toFixed(2),
  ) * 0.05;
}

export function orderDiscount(order: AdminOrder) {
  const saved = Number(order.totals.discount ?? 0);
  return Number.isFinite(saved) ? saved : 0;
}

export function orderTotal(order: AdminOrder) {
  const saved = Number(order.totals.total);
  if (Number.isFinite(saved)) return saved;
  return Number(
    (
      orderSubtotal(order) -
      orderDiscount(order) +
      orderDeliveryFee(order) +
      orderVat(order)
    ).toFixed(2),
  );
}

export function paymentMethodLabel(order: AdminOrder) {
  const method = String(order.payment?.method || "")
    .trim()
    .toLowerCase();
  if (method === "stripe") return "Stripe";
  if (method === "cash_on_delivery") return "Cash on delivery";
  if (method === "cash_on_pickup") return "Cash on pickup";
  if (method === "no_payment_required") return "No payment required";
  return method
    ? method.replace(/^\w/, (letter) => letter.toUpperCase())
    : "Not set";
}

export function paymentStatusLabel(order: AdminOrder) {
  const status = String(order.payment?.status || "")
    .trim()
    .toLowerCase();
  if (!status) return "Not paid";
  return status
    .split(/[_-]+/g)
    .map((part) => part.replace(/^\w/, (letter) => letter.toUpperCase()))
    .join(" ");
}

export function orderSearchText(order: AdminOrder) {
  return [
    order.id,
    order.status,
    paymentMethodLabel(order),
    paymentStatusLabel(order),
    order.customer.name,
    order.customer.phone,
    order.customer.email,
    fulfillmentLabel(order),
    order.fulfillment.address,
    order.notes,
    ...order.items.map((item) => `${item.name} ${item.category || ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function downloadOrdersCsv(orders: AdminOrder[]) {
  const header = [
    "Order ID",
    "Created",
    "Status",
    "Customer",
    "Phone",
    "Email",
    "Fulfillment",
    "Location",
    "Address",
    "Notes",
    "Item Count",
    "Subtotal AED",
    "Delivery AED",
    "Total AED",
    "Payment Method",
    "Payment Status",
    "Items",
  ];

  const rows = orders.map((order) => [
    order.id,
    order.createdAt,
    order.status,
    order.customer.name,
    order.customer.phone,
    order.customer.email || "",
    fulfillmentMode(order),
    order.fulfillment.locationName || "",
    order.fulfillment.address || "",
    order.notes || "",
    String(orderItemCount(order)),
    orderSubtotal(order).toFixed(2),
    orderDeliveryFee(order).toFixed(2),
    orderTotal(order).toFixed(2),
    paymentMethodLabel(order),
    paymentStatusLabel(order),
    order.items
      .map(
        (item) =>
          `${item.quantity} x ${orderItemLabel(item)} @ ${Number(item.unitPrice || 0).toFixed(2)} = ${orderLineTotal(item).toFixed(2)}`,
      )
      .join("; "),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  saveBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `zekra-orders-${todayStamp()}.csv`,
  );
}

export function downloadOrderPdf(order: AdminOrder) {
  saveBlob(
    createOrderPdf(order),
    `zekra-${safeFilename(order.id || "order")}.pdf`,
  );
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "order";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createOrderPdf(order: AdminOrder) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const bottom = 44;
  const contentWidth = pageWidth - margin * 2;
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = pageHeight - margin;

  const addPage = () => {
    if (commands.length) pages.push(commands);
    commands = [];
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < bottom) addPage();
  };

  const text = (
    x: number,
    textY: number,
    value: string,
    size = 10,
    bold = false,
  ) => {
    commands.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${textY.toFixed(2)} Td (${escapePdfText(value)}) Tj ET`,
    );
  };

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    commands.push(
      `0.69 0.60 0.43 RG 0.45 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  };

  const heading = (value: string) => {
    ensureSpace(26);
    text(margin, y, value, 13, true);
    y -= 22;
  };

  const note = (value: string) => {
    const lines = wrapPdfText(value, 88);
    ensureSpace(lines.length * 13 + 4);
    lines.forEach((lineText) => {
      text(margin, y, lineText, 10);
      y -= 13;
    });
    y -= 4;
  };

  const tableRow = (values: string[], widths: number[], header = false) => {
    const fontSize = header ? 8.5 : 9;
    const lineHeight = header ? 11 : 12;
    const paddingX = 5;
    const paddingY = 7;
    const wrapped = values.map((value, index) =>
      wrapPdfText(
        value || "-",
        Math.max(
          6,
          Math.floor((widths[index] - paddingX * 2) / (fontSize * 0.55)),
        ),
      ),
    );
    const rowHeight =
      Math.max(...wrapped.map((lines) => lines.length)) * lineHeight +
      paddingY * 2;

    ensureSpace(rowHeight + 2);

    const bottomY = y - rowHeight;
    if (header) {
      commands.push(
        `q 0.94 0.90 0.80 rg ${margin.toFixed(2)} ${bottomY.toFixed(2)} ${contentWidth.toFixed(2)} ${rowHeight.toFixed(2)} re f Q`,
      );
    }

    let x = margin;
    values.forEach((_value, index) => {
      commands.push(
        `${x.toFixed(2)} ${bottomY.toFixed(2)} ${widths[index].toFixed(2)} ${rowHeight.toFixed(2)} re S`,
      );
      wrapped[index].forEach((lineText, lineIndex) => {
        text(
          x + paddingX,
          y - paddingY - fontSize - lineIndex * lineHeight,
          lineText,
          fontSize,
          header,
        );
      });
      x += widths[index];
    });

    y = bottomY;
  };

  text(margin, y, "ZEKRA SWEETS L.L.C.", 18, true);
  text(margin, y - 19, "(SOLE PROPRIETORSHIP)", 10, true);
  text(margin, y - 38, "TAX INVOICE", 14, true);
  text(margin, y - 55, "TRN: 105025996700003", 10);
  text(pageWidth - margin - 170, y - 19, `Invoice No: ${order.id}`, 9);
  text(pageWidth - margin - 170, y - 36, `Date: ${formatDateTime(order.createdAt).split(",")[0]}`, 9);
  y -= 72;
  line(margin, y, pageWidth - margin, y);
  y -= 20;

  tableRow(["Customer name", order.customer.name || "-"], [120, contentWidth - 120]);
  tableRow(["Address", order.fulfillment.address || "-"], [120, contentWidth - 120]);
  tableRow(["Contact", [order.customer.phone, order.customer.email].filter(Boolean).join(" | ") || "-"], [120, contentWidth - 120]);
  y -= 12;

  heading("Items");
  tableRow(
    ["S.no", "Item description", "Qty", "Unit", "Rate", "Amount"],
    [34, contentWidth - 242, 38, 42, 58, 70],
    true,
  );
  if (order.items.length === 0) {
    tableRow(["1", "No items", "-", "-", formatMoney(0), formatMoney(0)], [34, contentWidth - 242, 38, 42, 58, 70]);
  } else {
    order.items.forEach((item, index) => {
      tableRow(
        [
          String(index + 1),
          orderItemLabel(item),
          String(item.quantity),
          "pcs",
          formatMoney(item.unitPrice),
          formatMoney(orderLineTotal(item)),
        ],
        [34, contentWidth - 242, 38, 42, 58, 70],
      );
    });
  }
  y -= 16;

  heading("Summary");
  tableRow(
    ["Amount", formatMoney(orderSubtotal(order))],
    [contentWidth - 120, 120],
  );
  tableRow(
    ["VAT 5%", formatMoney(orderVat(order))],
    [contentWidth - 120, 120],
  );
  tableRow(
    ["Delivery", formatMoney(orderDeliveryFee(order))],
    [contentWidth - 120, 120],
  );
  tableRow(
    ["Total", formatMoney(orderTotal(order))],
    [contentWidth - 120, 120],
    true,
  );
  y -= 16;
  text(margin, y, "This is a system generated invoice and does not require signature.", 8);

  if (commands.length) pages.push(commands);
  return buildPdf(pages.map((page) => page.join("\n")));
}

function wrapPdfText(value: string, maxChars: number) {
  const clean = pdfSafeText(value).replace(/\s+/g, " ").trim() || "-";
  const lines: string[] = [];
  let current = "";

  clean.split(" ").forEach((word) => {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function pdfSafeText(value: string) {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function escapePdfText(value: string) {
  return pdfSafeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdf(pageStreams: string[]) {
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageIds = pageStreams.map((_stream, index) => 5 + index * 2);
  const contentIds = pageStreams.map((_stream, index) => 6 + index * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pageStreams.forEach((stream, index) => {
    objects[pageIds[index]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objects[contentIds[index]] =
      `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
