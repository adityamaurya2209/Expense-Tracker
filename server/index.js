/* =====================================================
   EXPENSE TRACKER — SERVER
===================================================== */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { initSchema } = require("./db");
const auth = require("./auth");
const api = require("./api");


const app = express();

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "..", "public");


// Render terminates TLS at its proxy.
app.set("trust proxy", 1);

app.use(express.json({ limit: "5mb" }));

app.use(cookieParser());


/* -------- API -------- */

app.get("/api/health", (req, res) => {
    res.json({ ok: true });
});

app.use("/api/auth", auth.router);

app.use("/api", api);


/* -------- Pages -------- */

app.get(["/", "/index.html"], (req, res) => {

    if (!auth.readSession(req)) {
        return res.redirect("/login");
    }

    res.sendFile(path.join(PUBLIC_DIR, "index.html"));

});

app.get(["/login", "/signup"], (req, res) => {

    if (auth.readSession(req)) {
        return res.redirect("/");
    }

    res.sendFile(path.join(PUBLIC_DIR, "login.html"));

});

app.use(express.static(PUBLIC_DIR, { index: false }));


/* -------- Errors -------- */

app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found." });
});

app.use((error, req, res, next) => {

    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "Something went wrong on the server."
    });

});


/* -------- Start -------- */

initSchema()
    .then(() => {

        app.listen(PORT, () => {
            console.log(`Expense Tracker running on port ${PORT}`);
        });

    })
    .catch(error => {

        console.error("Failed to initialise database:", error);

        process.exit(1);

    });
