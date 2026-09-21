import http from "node:http";
import assert from "node:assert";

// Launch server on a test port
process.env.PORT = "5055";
const { default: server } = await import("../server.js");

const BASE_URL = "http://localhost:5055";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log("\n🧪 Running SmartWeight Systems API Test Suite...\n");

// 1. Health Check
await test("GET /api/health should return status ok", async () => {
  const res = await request("/api/health");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, "ok");
});

// 2. Demo Request Submission
await test("POST /api/demo should record a demo request", async () => {
  const payload = {
    name: "John Doe",
    email: "john@acme.com",
    phone: "9876543210",
    companyName: "Acme Industrial",
    message: "Interested in automated bin monitoring for warehouse",
  };
  const res = await request("/api/demo", { method: "POST", body: payload });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.name, "John Doe");
  assert.strictEqual(res.data.data.company_name, "Acme Industrial");
});

// 3. Demo Request Validation
await test("POST /api/demo should reject invalid email", async () => {
  const payload = {
    name: "Invalid User",
    email: "notanemail",
    phone: "12345678",
  };
  const res = await request("/api/demo", { method: "POST", body: payload });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.data.success, false);
});

// 4. Retrieve Demo Requests
await test("GET /api/demo should list recorded demo requests", async () => {
  const res = await request("/api/demo");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert(res.data.count >= 1);
});

// 5. Contact Message Submission
await test("POST /api/contact should record a contact inquiry", async () => {
  const payload = {
    name: "Jane Smith",
    email: "jane@techcorp.com",
    phone: "555-1234",
    message: "Would like pricing details for 50 smart bins.",
  };
  const res = await request("/api/contact", { method: "POST", body: payload });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.email, "jane@techcorp.com");
});

// 6. Retrieve Contact Inquiries
await test("GET /api/contact should list inquiries", async () => {
  const res = await request("/api/contact");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert(res.data.count >= 1);
});

// 7. Inventory List
await test("GET /api/inventory should return smart weight bins and summary", async () => {
  const res = await request("/api/inventory");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.summary.total_bins, 4);
  assert(Array.isArray(res.data.data));
});

// 8. Single Bin Fetch
await test("GET /api/inventory/BIN-001 should return bin details", async () => {
  const res = await request("/api/inventory/BIN-001");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.id, "BIN-001");
});

// 9. IoT Weight Telemetry Update - Normal
await test("POST /api/inventory/BIN-001/weight should update telemetry", async () => {
  // Unit weight = 0.048kg, Tare = 0.5kg
  // If weight = 24.5kg -> net = 24.0kg -> units = 500 -> OK
  const res = await request("/api/inventory/BIN-001/weight", {
    method: "POST",
    body: { current_weight_kg: 24.5 },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.status, "OK");
  assert.strictEqual(res.data.data.stock_count, 500);
});

// 10. IoT Weight Telemetry Update - Trigger LOW_STOCK Alert
await test("POST /api/inventory/BIN-001/weight should trigger LOW_STOCK alert", async () => {
  // Net = 4.0kg - 0.5kg = 3.5kg / 0.048 = 73 units (<= threshold 100) -> LOW_STOCK
  const res = await request("/api/inventory/BIN-001/weight", {
    method: "POST",
    body: { current_weight_kg: 4.0 },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.status, "LOW_STOCK");
  assert(res.data.alert !== null);
});

// 11. Static File Serving
await test("GET / should serve the index.html frontend", async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.strictEqual(res.status, 200);
  const text = await res.text();
  assert(text.includes("SmartWeight Systems"));
  assert(text.includes("Request a Demo"));
});

console.log(`\n===================================`);
console.log(`Tests Complete: ${passed} passed, ${failed} failed`);
console.log(`===================================\n`);

server.close();
process.exit(failed > 0 ? 1 : 0);
