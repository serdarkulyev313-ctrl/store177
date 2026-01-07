import fs from "fs";
import path from "path";

export type OrderStatus = "created" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "unpaid" | "paid_cash";

export type OrderItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
};

export type Order = {
  id: string;
  createdAt: string;
  updatedAt?: string;

  tgUserId: number | null;

  customerName: string;
  phone: string;
  method: "courier" | "pickup";
  address: string | null;
  comment: string | null;

  items: OrderItem[];
  total: number;

  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
};

const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf-8");
}

export function readOrders(): Order[] {
  try {
    ensureStorage();
    const raw = fs.readFileSync(ORDERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Order[]) : [];
  } catch {
    return [];
  }
}

export function writeOrders(orders: Order[]) {
  ensureStorage();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

export function makeOrderId() {
  // короткий и понятный id
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    d.getFullYear().toString().slice(2) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${stamp}-${rnd}`;
}
