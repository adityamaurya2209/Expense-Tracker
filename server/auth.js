/* =====================================================
   AUTHENTICATION
===================================================== */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const { pool } = require("./db");


const COOKIE_NAME = "et_session";

const SESSION_DAYS = 7;

const EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function getSecret() {

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            "JWT_SECRET is not set. See .env.example."
        );
    }

    return secret;

}


function setSessionCookie(res, user) {

    const token = jwt.sign(
        {
            sub: String(user.id),
            name: user.name,
            email: user.email
        },
        getSecret(),
        { expiresIn: `${SESSION_DAYS}d` }
    );

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
    });

}


function readSession(req) {

    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        return null;
    }

    try {

        const payload =
            jwt.verify(token, getSecret());

        return {
            id: Number(payload.sub),
            name: payload.name,
            email: payload.email
        };

    } catch {

        return null;

    }

}


function requireAuth(req, res, next) {

    const user = readSession(req);

    if (!user) {
        return res
            .status(401)
            .json({ error: "Not logged in." });
    }

    req.user = user;

    next();

}


/* =====================================================
   ROUTES
===================================================== */

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        error: "Too many attempts. Please try again in a few minutes."
    }
});


router.post(
    "/signup",
    authLimiter,
    async (req, res, next) => {

        try {

            const name =
                String(req.body?.name || "").trim();

            const email =
                String(req.body?.email || "")
                    .trim()
                    .toLowerCase();

            const password =
                String(req.body?.password || "");


            if (!name || name.length > 100) {
                return res.status(400).json({
                    error: "Please enter your name (max 100 characters)."
                });
            }

            if (!EMAIL_PATTERN.test(email) || email.length > 255) {
                return res.status(400).json({
                    error: "Please enter a valid email address."
                });
            }

            if (password.length < 8 || password.length > 72) {
                return res.status(400).json({
                    error: "Password must be 8–72 characters long."
                });
            }


            const [existing] = await pool.query(
                "SELECT id FROM users WHERE email = ?",
                [email]
            );

            if (existing.length) {
                return res.status(409).json({
                    error: "An account with this email already exists."
                });
            }


            const passwordHash =
                await bcrypt.hash(password, 12);

            const [result] = await pool.query(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                [name, email, passwordHash]
            );

            await pool.query(
                "INSERT INTO user_settings (user_id, custom_categories) VALUES (?, ?)",
                [result.insertId, "[]"]
            );


            const user = {
                id: result.insertId,
                name,
                email
            };

            setSessionCookie(res, user);

            res.status(201).json({ user });

        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    error: "An account with this email already exists."
                });
            }

            next(error);

        }

    }
);


router.post(
    "/login",
    authLimiter,
    async (req, res, next) => {

        try {

            const email =
                String(req.body?.email || "")
                    .trim()
                    .toLowerCase();

            const password =
                String(req.body?.password || "");


            const [rows] = await pool.query(
                "SELECT id, name, email, password_hash FROM users WHERE email = ?",
                [email]
            );

            const row = rows[0];

            const valid =
                row &&
                await bcrypt.compare(
                    password,
                    row.password_hash
                );

            if (!valid) {
                return res.status(401).json({
                    error: "Incorrect email or password."
                });
            }


            const user = {
                id: row.id,
                name: row.name,
                email: row.email
            };

            setSessionCookie(res, user);

            res.json({ user });

        } catch (error) {

            next(error);

        }

    }
);


router.post("/logout", (req, res) => {

    res.clearCookie(COOKIE_NAME);

    res.json({ ok: true });

});


router.get("/me", requireAuth, (req, res) => {

    res.json({ user: req.user });

});


module.exports = {
    router,
    requireAuth,
    readSession
};
