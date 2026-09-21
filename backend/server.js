import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

// 1. Ensure the database file exists with initial data
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const initialData = {
  demo_requests: [],
  contact_messages: [],
  inventory_bins: [
    {
      id: "BIN-001",
      bin_name: "Hex Head Bolts M10x50",
      sku: "BOLT-HEX-M10",
      current_weight_kg: 24.5,
      max_weight_kg: 30.0,
      tare_weight_kg: 0.5,
      unit_weight_kg: 0.048,
      low_stock_threshold_units: 100,
      stock_count: 500,
      status: "OK",
      last_updated: new Date().toISOString(),
    },
    {
      id: "BIN-002",
      bin_name: "Stainless Steel Washers 10mm",
      sku: "WASH-SS-10",
      current_weight_kg: 3.2,
      max_weight_kg: 25.0,
      tare_weight_kg: 0.5,
      unit_weight_kg: 0.009,
      low_stock_threshold_units: 400,
      stock_count: 300,
      status: "LOW_STOCK",
      last_updated: new Date().toISOString(),
    },
  ],
};

function readDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    return JSON.parse(JSON.stringify(initialData));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// 2. Helper to send JSON responses
function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

// 3. Helper to parse incoming POST request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// 4. Helper to serve HTML, CSS, and JS files from /public
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

function serveStatic(res, filePath) {
  let normalizedPath = filePath === "/" ? "/index.html" : filePath;
  let fullPath = path.join(PUBLIC_DIR, normalizedPath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(fullPath);
    res.writeHead(200, { "Content-Type": contentType });
    return res.end(content);
  }

  // Fallback to index.html
  const indexHtml = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexHtml)) {
    const content = fs.readFileSync(indexHtml);
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(content);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
}

// 5. Main HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  try {
    // Health Check
    if (pathname === "/api/health" && method === "GET") {
      return sendJson(res, 200, { status: "ok", service: "SmartWeight Backend" });
    }

    // A. POST /api/demo -> Save Demo Request
    if (pathname === "/api/demo" && method === "POST") {
      const body = await parseJsonBody(req);
      const { name, email, phone, companyName, message } = body;

      if (!name || !email || !phone) {
        return sendJson(res, 400, { success: false, error: "Name, email, and phone are required" });
      }

      const db = readDatabase();
      const newEntry = {
        id: db.demo_requests.length + 1,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company_name: (companyName || "").trim(),
        message: (message || "").trim(),
        status: "PENDING",
        created_at: new Date().toISOString(),
      };

      db.demo_requests.unshift(newEntry);
      writeDatabase(db);

      return sendJson(res, 201, {
        success: true,
        message: "Thank you for requesting a demo! Our team will contact you shortly.",
        data: newEntry,
      });
    }

    // GET /api/demo -> Retrieve Demo Requests
    if (pathname === "/api/demo" && method === "GET") {
      const db = readDatabase();
      return sendJson(res, 200, { success: true, count: db.demo_requests.length, data: db.demo_requests });
    }

    // B. POST /api/contact -> Save Contact Form Message
    if (pathname === "/api/contact" && method === "POST") {
      const body = await parseJsonBody(req);
      const { name, email, phone, message } = body;

      if (!name || !email || !message) {
        return sendJson(res, 400, { success: false, error: "Name, email, and message are required" });
      }

      const db = readDatabase();
      const newMsg = {
        id: db.contact_messages.length + 1,
        name: name.trim(),
        email: email.trim(),
        phone: (phone || "").trim(),
        message: message.trim(),
        status: "NEW",
        created_at: new Date().toISOString(),
      };

      db.contact_messages.unshift(newMsg);
      writeDatabase(db);

      return sendJson(res, 201, {
        success: true,
        message: "Your message has been sent successfully. We will get back to you soon.",
        data: newMsg,
      });
    }

    // GET /api/contact -> Retrieve Contact Messages
    if (pathname === "/api/contact" && method === "GET") {
      const db = readDatabase();
      return sendJson(res, 200, { success: true, count: db.contact_messages.length, data: db.contact_messages });
    }

    // C. GET /api/inventory -> Retrieve Real-Time Weight Bins
    if (pathname === "/api/inventory" && method === "GET") {
      const db = readDatabase();
      return sendJson(res, 200, { success: true, data: db.inventory_bins });
    }

    // D. POST /api/inventory/:id/weight -> Receive Scale Telemetry
    const weightMatch = pathname.match(/^\/api\/inventory\/([A-Za-z0-9-_]+)\/weight$/);
    if (weightMatch && method === "POST") {
      const binId = weightMatch[1];
      const body = await parseJsonBody(req);
      const weight = parseFloat(body.current_weight_kg);

      const db = readDatabase();
      const binIndex = db.inventory_bins.findIndex((b) => b.id.toUpperCase() === binId.toUpperCase());
      if (binIndex === -1) {
        return sendJson(res, 404, { success: false, error: "Bin not found" });
      }

      const bin = db.inventory_bins[binIndex];
      const netWeight = Math.max(0, weight - bin.tare_weight_kg);
      const units = Math.round(netWeight / bin.unit_weight_kg);
      const status = units === 0 ? "EMPTY" : units <= bin.low_stock_threshold_units ? "LOW_STOCK" : "OK";

      bin.current_weight_kg = weight;
      bin.stock_count = units;
      bin.status = status;
      bin.last_updated = new Date().toISOString();

      db.inventory_bins[binIndex] = bin;
      writeDatabase(db);

      return sendJson(res, 200, { success: true, message: `Bin ${binId} updated`, data: bin });
    }

    // E. Static Frontend Files
    if (method === "GET") {
      return serveStatic(res, pathname);
    }

    sendJson(res, 404, { success: false, error: "Endpoint not found" });
  } catch (err) {
    sendJson(res, 500, { success: false, error: "Internal Server Error" });
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SmartWeight Systems Backend is running!`);
  console.log(`🌐 Website URL:   http://localhost:${PORT}`);
  console.log(`📡 API Base:      http://localhost:${PORT}/api`);
  console.log(`📊 Admin Panel:   http://localhost:${PORT}/admin.html`);
  console.log(`=======================================================`);
});