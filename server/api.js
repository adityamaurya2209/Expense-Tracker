/* =====================================================
   DATA API
===================================================== */

const express = require("express");

const { pool } = require("./db");
const { requireAuth } = require("./auth");


const router = express.Router();

router.use(requireAuth);


const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MAX_AMOUNT = 999999999999;

const BATCH_SIZE = 500;


function toMoney(value) {

    const number = Number(value);

    return Number.isFinite(number) &&
        number >= 0 &&
        number <= MAX_AMOUNT
        ? Math.round(number * 100) / 100
        : null;

}


function cleanTransaction(raw) {

    const id = Number(raw?.id);

    const amount = toMoney(raw?.amount);

    const type = raw?.type;

    const category =
        String(raw?.category || "").trim().slice(0, 100);

    const date = String(raw?.date || "");

    if (
        !Number.isSafeInteger(id) ||
        amount === null ||
        amount <= 0 ||
        (type !== "income" && type !== "expense") ||
        !category ||
        !DATE_PATTERN.test(date)
    ) {
        return null;
    }

    return {
        id,
        type,
        amount,
        category,
        date,
        description:
            String(raw?.description || category).slice(0, 500)
    };

}


/* -------- Load everything for the current user -------- */

router.get("/data", async (req, res, next) => {

    try {

        const [transactions] = await pool.query(
            `SELECT id, type, amount, category, date, description
             FROM transactions
             WHERE user_id = ?
             ORDER BY date, id`,
            [req.user.id]
        );

        const [settingsRows] = await pool.query(
            `SELECT monthly_budget, savings_goal, custom_categories
             FROM user_settings
             WHERE user_id = ?`,
            [req.user.id]
        );

        const settings = settingsRows[0] || {};

        let customCategories = settings.custom_categories || [];

        if (typeof customCategories === "string") {
            customCategories = JSON.parse(customCategories);
        }

        res.json({
            user: req.user,
            transactions: transactions.map(t => ({
                ...t,
                id: Number(t.id),
                amount: Number(t.amount)
            })),
            monthlyBudget: Number(settings.monthly_budget || 0),
            savingsGoal: Number(settings.savings_goal || 0),
            customCategories
        });

    } catch (error) {

        next(error);

    }

});


/* -------- Sync transaction changes (upserts + deletions) -------- */

router.post("/transactions/sync", async (req, res, next) => {

    const upsert = Array.isArray(req.body?.upsert)
        ? req.body.upsert
        : [];

    const remove = Array.isArray(req.body?.remove)
        ? req.body.remove
        : [];

    const cleaned = upsert.map(cleanTransaction);

    if (cleaned.some(t => t === null)) {
        return res.status(400).json({
            error: "One or more transactions are invalid."
        });
    }

    const removeIds = remove
        .map(Number)
        .filter(Number.isSafeInteger);


    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        for (let i = 0; i < removeIds.length; i += BATCH_SIZE) {

            await connection.query(
                "DELETE FROM transactions WHERE user_id = ? AND id IN (?)",
                [req.user.id, removeIds.slice(i, i + BATCH_SIZE)]
            );

        }

        for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {

            const rows = cleaned
                .slice(i, i + BATCH_SIZE)
                .map(t => [
                    req.user.id,
                    t.id,
                    t.type,
                    t.amount,
                    t.category,
                    t.date,
                    t.description
                ]);

            await connection.query(
                `INSERT INTO transactions
                    (user_id, id, type, amount, category, date, description)
                 VALUES ?
                 ON DUPLICATE KEY UPDATE
                    type = VALUES(type),
                    amount = VALUES(amount),
                    category = VALUES(category),
                    date = VALUES(date),
                    description = VALUES(description)`,
                [rows]
            );

        }

        await connection.commit();

        res.json({ ok: true });

    } catch (error) {

        await connection.rollback();

        next(error);

    } finally {

        connection.release();

    }

});


/* -------- Budget, savings goal and custom categories -------- */

router.put("/settings", async (req, res, next) => {

    try {

        const monthlyBudget = toMoney(req.body?.monthlyBudget ?? 0);

        const savingsGoal = toMoney(req.body?.savingsGoal ?? 0);

        const customCategories = Array.isArray(req.body?.customCategories)
            ? req.body.customCategories
                .map(c => String(c).trim().slice(0, 100))
                .filter(Boolean)
                .slice(0, 200)
            : [];

        if (monthlyBudget === null || savingsGoal === null) {
            return res.status(400).json({
                error: "Invalid budget or savings goal."
            });
        }

        await pool.query(
            `INSERT INTO user_settings
                (user_id, monthly_budget, savings_goal, custom_categories)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                monthly_budget = VALUES(monthly_budget),
                savings_goal = VALUES(savings_goal),
                custom_categories = VALUES(custom_categories)`,
            [
                req.user.id,
                monthlyBudget,
                savingsGoal,
                JSON.stringify(customCategories)
            ]
        );

        res.json({ ok: true });

    } catch (error) {

        next(error);

    }

});


module.exports = router;
