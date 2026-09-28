import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env automatically if present (Node.js 20.6+)
if (typeof process.loadEnvFile === "function") {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (e) {
      // Ignore if .env is missing or invalid
    }
  }
}

const PORT = parseInt(process.env.PORT || "5000", 10);
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Seed
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
    {
      id: "BIN-003",
      bin_name: "Brass Threaded Inserts M6",
      sku: "INSRT-BR-M6",
      current_weight_kg: 18.8,
      max_weight_kg: 20.0,
      tare_weight_kg: 0.4,
      unit_weight_kg: 0.012,
      low_stock_threshold_units: 250,
      stock_count: 1533,
      status: "OK",
      last_updated: new Date().toISOString(),
    },
    {
      id: "BIN-004",
      bin_name: "Flange Nuts M8",
      sku: "NUT-FLG-M8",
      current_weight_kg: 0.5,
      max_weight_kg: 15.0,
      tare_weight_kg: 0.5,
      unit_weight_kg: 0.015,
      low_stock_threshold_units: 150,
      stock_count: 0,
      status: "EMPTY",
      last_updated: new Date().toISOString(),
    },
  ],
};

function readDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    return JSON.parse(JSON.stringify(initialData));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return JSON.parse(JSON.stringify(initialData));
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};


function isAuthorizedAdmin(req) {
  const adminPass = process.env.ADMIN_PASSWORD || "smartweight2026";
  const expectedToken = "auth_token_" + Buffer.from(adminPass).toString("base64");
  const authHeader = req.headers["x-admin-token"] || req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/, "").trim();
  return token === expectedToken;
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, filePath) {
  let normalizedPath = filePath === "/" ? "index.html" : filePath.replace(/^\/+/, "");

  const searchDirs = [
    __dirname,
    path.join(__dirname, "public"),
  ];

  for (const dir of searchDirs) {
    let fullPath = path.join(dir, normalizedPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      fullPath = path.join(fullPath, "index.html");
    }
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = fs.readFileSync(fullPath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": content.length,
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(content);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
}

// =========================================================================
// CUSTOMIZED EMAIL NOTIFICATION ENGINE
// =========================================================================

async function sendCustomEmail({ to, subject, html, replyTo }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);

  // 1. SMTP / Nodemailer
  if (smtpUser && smtpPass) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        
        },
      });

      const info = await transporter.sendMail({
        from: `"SmartWeight Systems" <${smtpUser}>`,
        to,
        replyTo: replyTo || smtpUser,
        subject,
        html,
      });

      console.log(`📧 [EMAIL SENT] To: ${to} | Subject: "${subject}" | ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("⚠️ [SMTP EMAIL ERROR]:", err.message);
    }
  }

  // 2. Resend API (HTTP POST - zero external libraries)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "SmartWeight Systems <onboarding@resend.dev>",
          to: [to],
          reply_to: replyTo,
          subject,
          html,
        }),
      });
      const data = await res.json();
      console.log(`📧 [RESEND EMAIL SENT] To: ${to} | Subject: "${subject}"`);
      return { success: true, data };
    } catch (err) {
      console.error("⚠️ [RESEND EMAIL ERROR]:", err.message);
    }
  }

  // 3. Fallback Logger when credentials are not configured yet
  console.log("------------------------------------------------------------------");
  console.log(`📧 [SIMULATED EMAIL NOTIFICATION]`);
  console.log(`To:       ${to}`);
  console.log(`Subject:  ${subject}`);
  console.log(`(Configure SMTP_USER & SMTP_PASS in .env to deliver real emails)`);
  console.log("------------------------------------------------------------------");
  return { success: true, simulated: true };
}

// Customized Email Templates
function buildDemoAdminEmail({ name, email, phone, companyName, message, id }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">SmartWeight Systems</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #38bdf8;">Automated Inventory Intelligence</p>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
        <span style="display: inline-block; background: #e0f2fe; color: #0284c7; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 999px; margin-bottom: 14px;">NEW DEMO REQUEST #${id}</span>
        <h3 style="margin: 0 0 16px; color: #0f172a; font-size: 18px;">A new prospective client requested a demo:</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b; width: 140px;"><strong>Client Name:</strong></td><td style="padding: 10px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 10px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #0284c7; text-decoration: none;">${escapeHtml(email)}</a></td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 10px 0;"><a href="tel:${escapeHtml(phone)}" style="color: #0284c7; text-decoration: none;">${escapeHtml(phone)}</a></td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b;"><strong>Company:</strong></td><td style="padding: 10px 0;">${escapeHtml(companyName || "Not specified")}</td></tr>
        </table>

        <div style="background: #f8fafc; border-left: 4px solid #0284c7; border-radius: 4px; padding: 14px; margin-bottom: 24px;">
          <strong style="color: #334155; font-size: 13px; display: block; margin-bottom: 4px;">Requirement / Message:</strong>
          <p style="margin: 0; color: #0f172a; font-size: 14px;">${escapeHtml(message || "No message provided.")}</p>
        </div>

        <div style="text-align: center; margin: 24px 0 10px;">
          <a href="mailto:${escapeHtml(email)}?subject=Re: SmartWeight Systems Demo" style="background: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">Reply to Client</a>
        </div>
      </div>
      <div style="background: #f8fafc; color: #94a3b8; padding: 16px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
        Received via SmartWeight Systems Lead Ingestion &bull; Salem, India
      </div>
    </div>
  `;
}

function buildDemoCustomerEmail({ name, message }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px;">SmartWeight Systems</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #38bdf8;">Automated Inventory Intelligence</p>
      </div>
      <div style="padding: 28px; color: #1e293b; line-height: 1.6;">
        <h3 style="margin: 0 0 12px; color: #0f172a;">Hello ${escapeHtml(name)},</h3>
        <p>Thank you for requesting a demo with <strong>SmartWeight Systems</strong>. We have received your request and our team is preparing a customized inventory automation walkthrough for you.</p>
        
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px; padding: 14px; margin: 20px 0;">
          <strong style="color: #166534; font-size: 13px; display: block; margin-bottom: 4px;">Your Submitted Requirement:</strong>
          <p style="margin: 0; color: #1e293b; font-size: 14px;">"${escapeHtml(message || "Automated stock visibility and weight-based bin monitoring")}"</p>
        </div>

        <p>Our team will contact you within 24 business hours. If you have immediate questions, you can reach out directly:</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; margin: 20px 0;">
          <div><strong>CEO:</strong> Stephen Jones C</div>
          <div style="margin-top: 6px;"><strong>Phone / WhatsApp:</strong> <a href="tel:6382368791" style="color: #0284c7; text-decoration: none;">+91 6382368791</a></div>
          <div style="margin-top: 6px;"><strong>Email:</strong> <a href="mailto:dharineesh1557@gmail.com" style="color: #0284c7; text-decoration: none;">dharineesh1557@gmail.com</a></div>
          <div style="margin-top: 6px;"><strong>Address:</strong> Opposite to Darling showroom, New Busstand, Salem – 636009</div>
        </div>

        <p style="color: #64748b; font-size: 13px; margin: 0;">We look forward to partnering with you to simplify stock management and eliminate stockouts!</p>
      </div>
      <div style="background: #f8fafc; color: #94a3b8; padding: 16px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
        &copy; 2026 SmartWeight Systems. Automated Inventory Intelligence.
      </div>
    </div>
  `;
}

function buildContactAdminEmail({ name, email, phone, message, id }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px;">SmartWeight Systems</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #38bdf8;">New Contact Inquiry</p>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
        <span style="display: inline-block; background: #e0f2fe; color: #0284c7; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 999px; margin-bottom: 14px;">MESSAGE #${id}</span>
        <h3 style="margin: 0 0 16px; color: #0f172a;">New Message Received:</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b; width: 140px;"><strong>Name:</strong></td><td style="padding: 10px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 10px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #0284c7; text-decoration: none;">${escapeHtml(email)}</a></td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 10px 0;">${escapeHtml(phone || "Not provided")}</td></tr>
        </table>

        <div style="background: #f8fafc; border-left: 4px solid #0284c7; border-radius: 4px; padding: 14px; margin-bottom: 24px;">
          <strong style="color: #334155; font-size: 13px; display: block; margin-bottom: 4px;">Message:</strong>
          <p style="margin: 0; color: #0f172a; font-size: 14px;">${escapeHtml(message)}</p>
        </div>

        <div style="text-align: center;">
          <a href="mailto:${escapeHtml(email)}?subject=Re: Your SmartWeight Systems Inquiry" style="background: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">Reply to Sender</a>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

// =========================================================================
// MAIN SERVER ROUTER
// =========================================================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  try {
    
    // Admin Login Authentication
    if (pathname === "/api/admin/login" && method === "POST") {
      const body = await parseJsonBody(req);
      const adminPass = process.env.ADMIN_PASSWORD || "smartweight2026";
      if (body.password === adminPass) {
        const token = "auth_token_" + Buffer.from(adminPass).toString("base64");
        return sendJson(res, 200, {
          success: true,
          token,
          message: "Admin authentication successful"
        });
      }
      return sendJson(res, 401, {
        success: false,
        error: "Incorrect admin password"
      });
    }

    // 1. Health Check
    if (pathname === "/api/health" && method === "GET") {
      return sendJson(res, 200, {
        status: "ok",
        service: "SmartWeight Systems API",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Demo Requests
    if (pathname === "/api/demo" && method === "POST") {
      const body = await parseJsonBody(req);
      const { name, email, phone, companyName, message } = body;

      if (!name || name.trim().length < 2) {
        return sendJson(res, 400, { success: false, error: "Name must be at least 2 characters" });
      }
      if (!email || !email.includes("@")) {
        return sendJson(res, 400, { success: false, error: "Valid email is required" });
      }
      if (!phone || phone.trim().length < 7) {
        return sendJson(res, 400, { success: false, error: "Valid phone number is required" });
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

      // Trigger customized email notifications asynchronously in background
      const adminEmail = process.env.ADMIN_EMAIL || "dharineesh1557@gmail.com";

      // 1. Email to Admin/CEO
      sendCustomEmail({
        to: adminEmail,
        subject: `🔔 New Demo Request: ${newEntry.name} (${newEntry.company_name || "Individual"})`,
        replyTo: newEntry.email,
        html: buildDemoAdminEmail(newEntry),
      }).catch((e) => console.error("Admin demo alert error:", e));

      // 2. Confirmation email to prospective customer
      sendCustomEmail({
        to: newEntry.email,
        subject: `SmartWeight Systems - We received your demo request!`,
        html: buildDemoCustomerEmail(newEntry),
      }).catch((e) => console.error("Customer confirmation email error:", e));

      return sendJson(res, 201, {
        success: true,
        message: "Thank you for requesting a demo! Confirmation email has been sent.",
        data: newEntry,
      });
    }

    if (pathname === "/api/demo" && method === "GET") {
      if (!isAuthorizedAdmin(req)) { return sendJson(res, 401, { success: false, error: "Unauthorized. Admin password required." }); }
      const db = readDatabase();
      return sendJson(res, 200, {
        success: true,
        count: db.demo_requests.length,
        data: db.demo_requests,
      });
    }

    // 3. Contact Messages
    if (pathname === "/api/contact" && method === "POST") {
      const body = await parseJsonBody(req);
      const { name, email, phone, message } = body;

      if (!name || name.trim().length < 2) {
        return sendJson(res, 400, { success: false, error: "Name must be at least 2 characters" });
      }
      if (!email || !email.includes("@")) {
        return sendJson(res, 400, { success: false, error: "Valid email is required" });
      }
      if (!message || message.trim().length < 3) {
        return sendJson(res, 400, { success: false, error: "Message is required" });
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

      // Trigger customized email notifications
      const adminEmail = process.env.ADMIN_EMAIL || "dharineesh1557@gmail.com";
      sendCustomEmail({
        to: adminEmail,
        subject: `✉️ New Contact Message from ${newMsg.name}`,
        replyTo: newMsg.email,
        html: buildContactAdminEmail(newMsg),
      }).catch((e) => console.error("Contact admin alert error:", e));

      return sendJson(res, 201, {
        success: true,
        message: "Your message has been sent successfully. We will get back to you soon.",
        data: newMsg,
      });
    }

    if (pathname === "/api/contact" && method === "GET") {
      if (!isAuthorizedAdmin(req)) { return sendJson(res, 401, { success: false, error: "Unauthorized. Admin password required." }); }
      const db = readDatabase();
      return sendJson(res, 200, {
        success: true,
        count: db.contact_messages.length,
        data: db.contact_messages,
      });
    }

    // 4. Inventory Telemetry
    if (pathname === "/api/inventory" && method === "GET") {
      const db = readDatabase();
      const bins = db.inventory_bins.map((bin) => {
        const maxUnits = Math.round((bin.max_weight_kg - bin.tare_weight_kg) / bin.unit_weight_kg);
        const fillPercentage = maxUnits > 0 ? Math.min(100, Math.round((bin.stock_count / maxUnits) * 100)) : 0;
        return {
          ...bin,
          max_units: maxUnits,
          fill_percentage: fillPercentage,
          is_low_stock: bin.status === "LOW_STOCK" || bin.status === "EMPTY",
        };
      });

      const summary = {
        total_bins: bins.length,
        ok_count: bins.filter((b) => b.status === "OK").length,
        low_stock_count: bins.filter((b) => b.status === "LOW_STOCK").length,
        empty_count: bins.filter((b) => b.status === "EMPTY").length,
      };

      return sendJson(res, 200, {
        success: true,
        summary,
        data: bins,
      });
    }

    // 5. Update Weight Telemetry from IoT Scales
    const weightMatch = pathname.match(/^\/api\/inventory\/([A-Za-z0-9-_]+)\/weight$/);
    if (weightMatch && method === "POST") {
      const binId = weightMatch[1];
      const body = await parseJsonBody(req);
      const weight = typeof body.current_weight_kg === "number" ? body.current_weight_kg : parseFloat(body.current_weight_kg);

      if (isNaN(weight) || weight < 0) {
        return sendJson(res, 400, { success: false, error: "Valid current_weight_kg number is required" });
      }

      const db = readDatabase();
      const binIndex = db.inventory_bins.findIndex((b) => b.id.toUpperCase() === binId.toUpperCase());
      if (binIndex === -1) {
        return sendJson(res, 404, { success: false, error: `Bin ${binId} not found` });
      }

      const bin = db.inventory_bins[binIndex];
      const netWeight = Math.max(0, weight - bin.tare_weight_kg);
      let calculatedUnits = Math.round(netWeight / bin.unit_weight_kg);
      if (netWeight < 0.005) {
        calculatedUnits = 0;
      }

      let newStatus = "OK";
      if (calculatedUnits === 0) {
        newStatus = "EMPTY";
      } else if (calculatedUnits <= bin.low_stock_threshold_units) {
        newStatus = "LOW_STOCK";
      }

      bin.current_weight_kg = weight;
      bin.stock_count = calculatedUnits;
      bin.status = newStatus;
      bin.last_updated = new Date().toISOString();

      db.inventory_bins[binIndex] = bin;
      writeDatabase(db);

      return sendJson(res, 200, {
        success: true,
        message: `Bin ${binId} telemetry updated`,
        alert: newStatus !== "OK" ? `Alert: ${bin.bin_name} is ${newStatus} (${calculatedUnits} units remaining)` : null,
        data: bin,
      });
    }

    // 6. Get Single Bin
    const singleBinMatch = pathname.match(/^\/api\/inventory\/([A-Za-z0-9-_]+)$/);
    if (singleBinMatch && method === "GET") {
      const binId = singleBinMatch[1];
      const db = readDatabase();
      const bin = db.inventory_bins.find((b) => b.id.toUpperCase() === binId.toUpperCase());
      if (!bin) {
        return sendJson(res, 404, { success: false, error: `Bin ${binId} not found` });
      }
      return sendJson(res, 200, { success: true, data: bin });
    }

    
    // 6b. Add New Inventory Bin
    if (pathname === "/api/inventory" && method === "POST") {
      const body = await parseJsonBody(req);
      const { bin_name, sku, max_weight_kg, unit_weight_kg, low_stock_threshold_units, initial_weight_kg, tare_weight_kg } = body;
      
      if (!bin_name || !sku) {
        return sendJson(res, 400, { success: false, error: "Bin name and SKU are required" });
      }
      
      const db = readDatabase();
      const id = "BIN-" + String(db.inventory_bins.length + 1).padStart(3, "0");
      const unitWt = parseFloat(unit_weight_kg) || 0.01;
      const tareWt = parseFloat(tare_weight_kg) || 0.5;
      const maxWt = parseFloat(max_weight_kg) || 25.0;
      const curWt = typeof initial_weight_kg !== "undefined" ? parseFloat(initial_weight_kg) : maxWt * 0.7;
      const threshold = parseInt(low_stock_threshold_units, 10) || 100;
      
      const net = Math.max(0, curWt - tareWt);
      const units = Math.round(net / unitWt);
      let status = "OK";
      if (units === 0) status = "EMPTY";
      else if (units <= threshold) status = "LOW_STOCK";

      const newBin = {
        id,
        bin_name: bin_name.trim(),
        sku: sku.trim().toUpperCase(),
        current_weight_kg: curWt,
        max_weight_kg: maxWt,
        tare_weight_kg: tareWt,
        unit_weight_kg: unitWt,
        low_stock_threshold_units: threshold,
        stock_count: units,
        status,
        last_updated: new Date().toISOString()
      };

      db.inventory_bins.push(newBin);
      writeDatabase(db);
      return sendJson(res, 201, { success: true, message: `Bin ${id} created`, data: newBin });
    }

    // 6c. Delete Inventory Bin
    const deleteBinMatch = pathname.match(/^\/api\/inventory\/([A-Za-z0-9-_]+)$/);
    if (deleteBinMatch && method === "DELETE") {
      const binId = deleteBinMatch[1];
      const db = readDatabase();
      const idx = db.inventory_bins.findIndex(b => b.id.toUpperCase() === binId.toUpperCase());
      if (idx === -1) {
        return sendJson(res, 404, { success: false, error: `Bin ${binId} not found` });
      }
      const removed = db.inventory_bins.splice(idx, 1)[0];
      writeDatabase(db);
      return sendJson(res, 200, { success: true, message: `Bin ${binId} deleted`, data: removed });
    }

    // 6d. Trigger Reorder PO
    const reorderBinMatch = pathname.match(/^\/api\/inventory\/([A-Za-z0-9-_]+)\/reorder$/);
    if (reorderBinMatch && method === "POST") {
      const binId = reorderBinMatch[1];
      const db = readDatabase();
      const bin = db.inventory_bins.find(b => b.id.toUpperCase() === binId.toUpperCase());
      if (!bin) {
        return sendJson(res, 404, { success: false, error: `Bin ${binId} not found` });
      }

      if (!db.reorder_logs) db.reorder_logs = [];
      const poNum = "PO-" + Math.floor(1000 + Math.random() * 9000);
      const reorderQty = Math.max(100, (bin.low_stock_threshold_units * 3));

      const newPO = {
        id: poNum,
        bin_id: bin.id,
        item_name: bin.bin_name,
        sku: bin.sku,
        reorder_quantity: reorderQty,
        dispatched_to: "Certified Vendor Supply Portal (EDI / REST API)",
        status: "TRANSMITTED",
        timestamp: new Date().toISOString()
      };

      db.reorder_logs.unshift(newPO);
      writeDatabase(db);
      return sendJson(res, 201, { success: true, message: `Automated Purchase Order ${poNum} dispatched!`, data: newPO });
    }

    // 6e. Get Reorder Logs
    if (pathname === "/api/reorders" && method === "GET") {
      const db = readDatabase();
      return sendJson(res, 200, { success: true, count: (db.reorder_logs || []).length, data: db.reorder_logs || [] });
    }

    // 6f. Update Demo Status
    const demoStatusMatch = pathname.match(/^\/api\/demo\/(\d+)\/status$/);
    if (demoStatusMatch && method === "POST") {
      if (!isAuthorizedAdmin(req)) { return sendJson(res, 401, { success: false, error: "Unauthorized" }); }
      const demoId = parseInt(demoStatusMatch[1], 10);
      const body = await parseJsonBody(req);
      const db = readDatabase();
      const demo = db.demo_requests.find(d => d.id === demoId);
      if (!demo) {
        return sendJson(res, 404, { success: false, error: "Demo not found" });
      }
      demo.status = body.status || "CONTACTED";
      writeDatabase(db);
      return sendJson(res, 200, { success: true, message: "Status updated", data: demo });
    }

    // 6g. Update Contact Status
    const contactStatusMatch = pathname.match(/^\/api\/contact\/(\d+)\/status$/);
    if (contactStatusMatch && method === "POST") {
      if (!isAuthorizedAdmin(req)) { return sendJson(res, 401, { success: false, error: "Unauthorized" }); }
      const contactId = parseInt(contactStatusMatch[1], 10);
      const body = await parseJsonBody(req);
      const db = readDatabase();
      const msg = db.contact_messages.find(c => c.id === contactId);
      if (!msg) {
        return sendJson(res, 404, { success: false, error: "Message not found" });
      }
      msg.status = body.status || "REPLIED";
      writeDatabase(db);
      return sendJson(res, 200, { success: true, message: "Status updated", data: msg });
    }

    
    // 6h. Delete Demo
    const deleteDemoMatch = pathname.match(/^\/api\/demo\/(\d+)$/);
    if (deleteDemoMatch && method === "DELETE") {
      if (!isAuthorizedAdmin(req)) { return sendJson(res, 401, { success: false, error: "Unauthorized" }); }
      const demoId = parseInt(deleteDemoMatch[1], 10);
      const db = readDatabase();
      const idx = db.demo_requests.findIndex(d => d.id === demoId);
      if (idx === -1) {
        return sendJson(res, 404, { success: false, error: "Demo not found" });
      }
      const removed = db.demo_requests.splice(idx, 1)[0];
      writeDatabase(db);
      return sendJson(res, 200, { success: true, message: "Demo request deleted", data: removed });
    }

    // 6i. Delete Contact
    const deleteContactMatch = pathname.match(/^\/api\/contact\/(\d+)$/);
    if (deleteContactMatch && method === "DELETE") {
      if (!isAuthorizedAdmin(req)) { return sendJson(res, 401, { success: false, error: "Unauthorized" }); }
      const contactId = parseInt(deleteContactMatch[1], 10);
      const db = readDatabase();
      const idx = db.contact_messages.findIndex(c => c.id === contactId);
      if (idx === -1) {
        return sendJson(res, 404, { success: false, error: "Message not found" });
      }
      const removed = db.contact_messages.splice(idx, 1)[0];
      writeDatabase(db);
      return sendJson(res, 200, { success: true, message: "Contact message deleted", data: removed });
    }

    // 7. Static Website Serving
    if (method === "GET") {
      return serveStatic(req, res, pathname);
    }

    sendJson(res, 404, { success: false, error: "Endpoint not found" });
  } catch (err) {
    console.error("Server error:", err);
    sendJson(res, 500, { success: false, error: "Internal Server Error" });
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SmartWeight Systems Backend running successfully!`);
  console.log(`🌐 Website URL:    http://localhost:${PORT}`);
  console.log(`📡 API Base URL:   http://localhost:${PORT}/api`);
  console.log(`📊 Admin Console:  http://localhost:${PORT}/admin.html`);
  console.log(`📧 Email Alerts:   Active -> ${process.env.ADMIN_EMAIL || "dharineesh1557@gmail.com"}`);
  console.log(`=======================================================`);
});

export default server;
