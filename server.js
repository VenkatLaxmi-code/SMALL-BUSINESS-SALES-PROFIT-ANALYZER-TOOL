const express = require("express");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const SECRET = "milestone_secret";

const USERS = "users.json";
const SALES = "sales.json";
const EXP = "expenses.json";
const INV = "inventory.json";

/* 🔒 PRODUCT MASTER (DO NOT CHANGE) */
const PRODUCTS = [
    { id: 1, name: "Ball Pen", cost: 5 },
    { id: 2, name: "Gel Pen", cost: 10 },
    { id: 3, name: "Fountain Pen", cost: 120 },
    { id: 4, name: "Pencil", cost: 3 },
    { id: 5, name: "Color Pencil Pack", cost: 80 },
    { id: 6, name: "Eraser", cost: 2 },
    { id: 7, name: "Sharpener", cost: 4 },
    { id: 8, name: "Notebook A4", cost: 40 },
    { id: 9, name: "Notebook A5", cost: 30 },
    { id: 10, name: "Spiral Notebook", cost: 60 },
    { id: 11, name: "Sticky Notes", cost: 25 },
    { id: 12, name: "Highlighter", cost: 20 },
    { id: 13, name: "Marker", cost: 25 },
    { id: 14, name: "Whiteboard Marker", cost: 30 },
    { id: 15, name: "File Folder", cost: 15 },
    { id: 16, name: "Ring File", cost: 55 },
    { id: 17, name: "Plastic Folder", cost: 20 },
    { id: 18, name: "Paper Clips", cost: 10 },
    { id: 19, name: "Binder Clips", cost: 15 },
    { id: 20, name: "Stapler", cost: 80 },
    { id: 21, name: "Stapler Pins", cost: 20 },
    { id: 22, name: "Scissors", cost: 60 },
    { id: 23, name: "Glue Stick", cost: 18 },
    { id: 24, name: "Correction Pen", cost: 25 },
    { id: 25, name: "Ruler", cost: 10 },
    { id: 26, name: "Calculator", cost: 250 },
    { id: 27, name: "Chart Paper", cost: 15 },
    { id: 28, name: "Drawing Book", cost: 70 },
    { id: 29, name: "Sketch Pens", cost: 120 },
    { id: 30, name: "Sticky Flags", cost: 30 },
    { id: 31, name: "Office Tape", cost: 20 },
    { id: 32, name: "Envelopes", cost: 10 },
    { id: 33, name: "Index Cards", cost: 25 },
    { id: 34, name: "Clip Board", cost: 90 },
    { id: 35, name: "Desk Organizer", cost: 150 },
    { id: 36, name: "Pen Stand", cost: 50 },
    { id: 37, name: "Whiteboard", cost: 900 },
    { id: 38, name: "Permanent Marker", cost: 35 },
    { id: 39, name: "Drawing Scale Set", cost: 120 },
    { id: 40, name: "Paper Cutter", cost: 300 },
    { id: 41, name: "Carbon Paper", cost: 40 },
    { id: 42, name: "Notebook Long", cost: 50 },
    { id: 43, name: "Graph Book", cost: 60 },
    { id: 44, name: "Invoice Book", cost: 80 },
    { id: 45, name: "Receipt Book", cost: 75 },
    { id: 46, name: "Attendance Register", cost: 100 },
    { id: 47, name: "Sticky Labels", cost: 30 },
    { id: 48, name: "Exam Pad", cost: 70 },
    { id: 49, name: "Plastic Cover", cost: 8 },
    { id: 50, name: "Document Folder", cost: 35 }
];
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "vyshnavi2603@gmail.com",
        pass: "smgx zhab frmi wlhi"
    }
});

/* FILE HELPERS */
const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

const upload = multer({ dest: "uploads/" });

/* AUTH */
function auth(req, res, next) {
    try {
        req.user = jwt.verify(req.headers.authorization, SECRET);
        next();
    } catch {
        res.status(401).json({ msg: "Unauthorized" });
    }
}

/* REGISTER */
app.post("/register", async (req, res) => {
    const u = load(USERS);
    const h = await bcrypt.hash(req.body.password, 10);
    u.push({ ...req.body, password: h });
    save(USERS, u);
    res.json({ msg: "Registered" });
});

/* LOGIN */
app.post("/login", async (req, res) => {
    const u = load(USERS).find(x => x.email === req.body.email);
    if (!u) return res.json({ msg: "Invalid" });

    const ok = await bcrypt.compare(req.body.password, u.password);
    if (!ok) return res.json({ msg: "Wrong" });

    const t = jwt.sign({ email: u.email, role: u.role }, SECRET);
    res.json({ token: t, role: u.role });
});

/* 🔁 MAP PRODUCT NAME → ID */
function getProductIdByName(name) {
    if (!name) return null;

    const cleanName = name.trim().toLowerCase();

    const p = PRODUCTS.find(
        x => x.name.trim().toLowerCase() === cleanName
    );

    return p ? p.id : null;
}


/* ✅ INVENTORY UPDATE ON SALE (ADDED ONLY) */
function applySaleToInventory(productName, qty) {
    const productId = getProductIdByName(productName);
    if (!productId) return;

    const inventory = load(INV);
    let item = inventory.find(i => i.productId === productId);

    if (!item) {
        item = { productId, initialStock: 50, sold: 0 };
        inventory.push(item);
    }

    item.sold += Number(qty);
    save(INV, inventory);
}
app.post("/restock", auth, (req, res) => {
    console.log("RESTOCK BODY:", req.body); // 🔍 DEBUG

    if (req.user.role !== "owner") {
        return res.status(403).json({ msg: "Only owner can restock" });
    }

    const { productId, quantity } = req.body;
    console.log("PID:", productId, "QTY:", quantity); // 🔍 DEBUG

    const inventory = load(INV);
    const item = inventory.find(i => i.productId == Number(productId));

    if (!item) {
        console.log("ITEM NOT FOUND");
        return res.json({ msg: "Product not found" });
    }

    const sold = Number(item.sold || 0);
    const newAvailable = (item.initialStock - sold) + Number(quantity);
    item.initialStock = sold + newAvailable;

    save(INV, inventory);

    console.log("UPDATED ITEM:", item); // 🔍 DEBUG
    res.json({ msg: "Stock updated successfully" });
});

/* SALES */
app.post("/sales", auth, upload.none(), (req, res) => {
    const s = load(SALES);
    s.push({ id: Date.now(), ...req.body });
    save(SALES, s);

    /* 🔥 ADDITION ONLY */
    applySaleToInventory(req.body.product, req.body.qty);

    res.json({ msg: "Sale saved & inventory updated" });
});

/* ❗ DO NOT TOUCH BELOW (AS REQUESTED) */
app.get("/sales", auth, (r, s) => s.json(load(SALES)));

app.put("/sales/:id", auth, (r, s) => {
    if (!["owner", "accountant"].includes(r.user.role)) return s.sendStatus(403);
    const d = load(SALES);
    Object.assign(d.find(x => x.id == r.params.id), r.body);
    save(SALES, d);
    s.json({ msg: "Updated" });
});

app.delete("/sales/:id", auth, (r, s) => {
    if (!["owner", "accountant"].includes(r.user.role)) return s.sendStatus(403);
    save(SALES, load(SALES).filter(x => x.id != r.params.id));
    s.json({ msg: "Deleted" });
});

/* EXPENSES */
app.post("/expenses", auth, upload.none(), (r, s) => {
    const e = load(EXP);
    e.push({ id: Date.now(), ...r.body });
    save(EXP, e);
    s.json({ msg: "Expense added" });
});

/* ❗ DO NOT TOUCH BELOW */
app.get("/expenses", auth, (r, s) => s.json(load(EXP)));

app.put("/expenses/:id", auth, (r, s) => {
    if (!["owner", "accountant"].includes(r.user.role)) return s.sendStatus(403);
    const e = load(EXP);
    Object.assign(e.find(x => x.id == r.params.id), r.body);
    save(EXP, e);
    s.json({ msg: "Updated" });
});

app.delete("/expenses/:id", auth, (r, s) => {
    if (!["owner", "accountant"].includes(r.user.role)) return s.sendStatus(403);
    save(EXP, load(EXP).filter(x => x.id != r.params.id));
    s.json({ msg: "Deleted" });
});

/* 📦 INVENTORY DASHBOARD (NEW API) */
app.get("/inventory-dashboard", auth, (req, res) => {
    let inventory = load(INV);

    // ✅ FIX: flatten inventory if nested
    if (Array.isArray(inventory[0])) {
        inventory = inventory.flat();
    }

    const result = inventory.map(i => {
        const product = PRODUCTS.find(p => p.id === i.productId);

        const sold = Number(i.sold || 0);
        const initialStock = Number(i.initialStock || 0);
        const available = initialStock - sold;
        const cost = product ? product.cost : 0;

        return {
            productId: i.productId,                 // ✅ for restock
            product: product ? product.name : "Unknown", // ✅ ALL 50 NAMES
            costPrice: cost,
            stock: initialStock,
            sold: sold,
            available: available,
            cogs: sold * cost,
            status: available <= 5 ? "Low Stock" : "Sufficient"
        };
    });

    res.json(result);
});



/* 🧠 AI REPORT API */
app.get("/ai-report", auth, (req, res) => {
    const sales = load(SALES);
    const expenses = load(EXP);

    let totalSales = 0;
    let totalExpenses = 0;

    sales.forEach(s => totalSales += Number(s.amount || 0));
    expenses.forEach(e => totalExpenses += Number(e.amount || 0));

    const profit = totalSales - totalExpenses;

    res.json({
        totalSales,
        totalExpenses,
        profit,
        prediction:
            profit > 0
                ? "📈 Business likely to be PROFITABLE"
                : "📉 Business may face LOSS"
    });
});
const PDFDocument = require("pdfkit");

app.get("/download-pdf", auth, (req, res) => {
    const sales = load(SALES);
    const expenses = load(EXP);

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=business-report.pdf");

    doc.pipe(res);
    doc.fontSize(18).text("Business Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text("Sales:");
    sales.forEach(s => {
        doc.fontSize(10).text(
            `${s.date} | ${s.product} | Qty: ${s.qty} | ₹${s.amount}`
        );
    });

    doc.moveDown();
    doc.fontSize(14).text("Expenses:");
    expenses.forEach(e => {
        doc.fontSize(10).text(
            `${e.date} | ${e.type} | ₹${e.amount}`
        );
    });

    doc.end();
});
const ExcelJS = require("exceljs");
async function generateExcel() {
    const workbook = new ExcelJS.Workbook();

    const salesSheet = workbook.addWorksheet("Sales");
    salesSheet.columns = [
        { header: "Date", key: "date" },
        { header: "Product", key: "product" },
        { header: "Qty", key: "qty" },
        { header: "Amount", key: "amount" }
    ];
    load(SALES).forEach(s => salesSheet.addRow(s));

    const expSheet = workbook.addWorksheet("Expenses");
    expSheet.columns = [
        { header: "Date", key: "date" },
        { header: "Type", key: "type" },
        { header: "Amount", key: "amount" }
    ];
    load(EXP).forEach(e => expSheet.addRow(e));

    await workbook.xlsx.writeFile("business-report.xlsx");
}


app.get("/download-excel", auth, async (req, res) => {
    const workbook = new ExcelJS.Workbook();

    const salesSheet = workbook.addWorksheet("Sales");
    salesSheet.columns = [
        { header: "Date", key: "date" },
        { header: "Product", key: "product" },
        { header: "Qty", key: "qty" },
        { header: "Amount", key: "amount" }
    ];
    load(SALES).forEach(s => salesSheet.addRow(s));

    const expSheet = workbook.addWorksheet("Expenses");
    expSheet.columns = [
        { header: "Date", key: "date" },
        { header: "Type", key: "type" },
        { header: "Amount", key: "amount" }
    ];
    load(EXP).forEach(e => expSheet.addRow(e));

    res.setHeader(
        "Content-Disposition",
        "attachment; filename=business-report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
});

const path = require("path");

app.get("/email-report", auth, async (req, res) => {
    if (req.user.role !== "owner") {
        return res.status(403).json({ msg: "Only owner allowed" });
    }

    const pdfPath = path.join(__dirname, "business-report.pdf");
    const excelPath = path.join(__dirname, "business-report.xlsx");

    // 🔹 CREATE PDF
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);
    doc.fontSize(18).text("Business Report", { align: "center" });
    doc.end();

    stream.on("finish", async () => {
        // 🔹 CREATE EXCEL BEFORE EMAIL
        await generateExcel();

        const mailOptions = {
            from: "vyshnavi2603@gmail.com",
            to: "vyshnavi2603@gmail.com",
            subject: "Business Report",
            text: "Attached are the business reports.",
            attachments: [
                { filename: "business-report.pdf", path: pdfPath },
                { filename: "business-report.xlsx", path: excelPath }
            ]
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error(err);
                return res.json({ msg: "Email failed", error: err.message });
            }
            res.json({ msg: "Email sent successfully" });
        });
    });
});

app.listen(5000, () =>
    console.log("✅ Server running at http://localhost:5000")
);
