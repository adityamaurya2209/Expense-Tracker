/* =====================================================
   EXPENSE TRACKER
   FINAL MEGA PASS
===================================================== */


/* =====================================================
   DEFAULT CATEGORIES
===================================================== */

const DEFAULT_CATEGORIES = [
    "Food",
    "Shopping",
    "Transport",
    "Education",
    "Entertainment",
    "Bills",
    "Health",
    "Travel",
    "Other"
];


/* =====================================================
   DOM
===================================================== */

const $ = id =>
    document.getElementById(id);


/* =====================================================
   DATA
===================================================== */

// Loaded from the server in initialize().

let transactions = [];

let customCategories = [];

let monthlyBudget = 0;

let savingsGoal = 0;

let currentUser = null;


/* =====================================================
   CHARTS
===================================================== */

let incomeExpenseChart = null;

let expenseCategoryChart = null;

let reportMonthlyChart = null;

let reportCategoryChart = null;


/* =====================================================
   FILTER STATE
===================================================== */

let filters = {
    search: "",
    type: "all",
    category: "all",
    sort: "newest",
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: ""
};


/* =====================================================
   SERVER STORAGE
===================================================== */

const LEGACY_KEYS = [
    "transactions",
    "customCategories",
    "monthlyBudget",
    "savingsGoal"
];


// Last state known to be saved on the server: id -> JSON string.
let syncedTransactions = new Map();

// Serialises writes so they reach the server in order.
let saveQueue = Promise.resolve();

let pendingSaves = 0;


async function api(path, options = {}) {

    const response = await fetch(path, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });


    if (response.status === 401) {

        location.href = "/login";

        throw new Error("Session expired.");

    }


    const result =
        await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.error || `Request failed (${response.status})`
        );
    }

    return result;

}


function enqueueSave(task, onError) {

    pendingSaves++;

    saveQueue = saveQueue
        .then(task)
        .catch(error => {

            console.error("Save error:", error);

            onError?.();

            showToast(
                "Could not save to the server. Please check your connection.",
                "error"
            );

        })
        .finally(() => {
            pendingSaves--;
        });

}


function snapshotTransactions() {

    syncedTransactions = new Map(
        transactions.map(transaction => [
            transaction.id,
            JSON.stringify(transaction)
        ])
    );

}


function loadJSON(key, fallback) {

    try {

        const value =
            localStorage.getItem(key);

        return value
            ? JSON.parse(value)
            : fallback;

    } catch (error) {

        console.error(
            "Storage error:",
            error
        );

        return fallback;
    }
}


function saveTransactions() {

    const current = new Map(
        transactions.map(transaction => [
            transaction.id,
            JSON.stringify(transaction)
        ])
    );

    const upsert = [];

    const remove = [];

    const previous = new Map();


    current.forEach((json, id) => {

        if (syncedTransactions.get(id) !== json) {

            upsert.push(JSON.parse(json));

            previous.set(id, syncedTransactions.get(id));

        }

    });

    syncedTransactions.forEach((json, id) => {

        if (!current.has(id)) {

            remove.push(id);

            previous.set(id, json);

        }

    });


    if (!upsert.length && !remove.length) {
        return;
    }


    syncedTransactions = current;


    enqueueSave(
        () => api("/api/transactions/sync", {
            method: "POST",
            body: JSON.stringify({ upsert, remove })
        }),
        () => {

            // Roll the snapshot back so the next save retries these changes.
            previous.forEach((json, id) => {

                if (json === undefined) {
                    syncedTransactions.delete(id);
                }

                else {
                    syncedTransactions.set(id, json);
                }

            });

        }
    );

}


function saveSettings() {

    const body = JSON.stringify({
        monthlyBudget,
        savingsGoal,
        customCategories
    });

    enqueueSave(
        () => api("/api/settings", {
            method: "PUT",
            body
        })
    );

}


function savePlanning() {

    saveSettings();

}


function saveCategories() {

    saveSettings();

}


async function loadUserData() {

    const data =
        await api("/api/data");

    currentUser = data.user;

    transactions = data.transactions;

    customCategories = data.customCategories;

    monthlyBudget = data.monthlyBudget;

    savingsGoal = data.savingsGoal;

    snapshotTransactions();

}


function offerLegacyImport() {

    const legacyTransactions =
        loadJSON("transactions", []);

    if (
        transactions.length > 0 ||
        !Array.isArray(legacyTransactions) ||
        legacyTransactions.length === 0
    ) {
        return;
    }


    const confirmed =
        confirm(
            `Found ${legacyTransactions.length} transaction(s) saved in this browser from an earlier version. Import them into your account?`
        );


    if (confirmed) {

        transactions = legacyTransactions;

        customCategories =
            loadJSON("customCategories", []);

        monthlyBudget = Number(
            localStorage.getItem("monthlyBudget") || 0
        );

        savingsGoal = Number(
            localStorage.getItem("savingsGoal") || 0
        );

        saveTransactions();

        saveSettings();

    }


    // Either way, don't offer again (or to another account on this browser).
    try {

        LEGACY_KEYS.forEach(key =>
            localStorage.removeItem(key)
        );

    } catch (error) {

        console.error("Storage error:", error);

    }


    if (confirmed) {

        saveQueue.then(() =>
            showToast(
                `✓ Imported ${transactions.length} transaction(s) into your account!`
            )
        );

    }

}


async function logout() {

    await saveQueue;

    await fetch("/api/auth/logout", {
        method: "POST"
    }).catch(() => {});

    location.href = "/login";

}


window.addEventListener(
    "beforeunload",
    event => {

        if (pendingSaves > 0) {
            event.preventDefault();
        }

    }
);


/* =====================================================
   HELPERS
===================================================== */

function formatCurrency(amount) {

    return "₹" +
        Number(amount || 0)
            .toLocaleString("en-IN", {
                maximumFractionDigits: 2
            });

}


function getToday() {

    const d = new Date();

    return [
        d.getFullYear(),

        String(
            d.getMonth() + 1
        ).padStart(2, "0"),

        String(
            d.getDate()
        ).padStart(2, "0")

    ].join("-");

}


function parseDate(dateString) {

    return new Date(
        `${dateString}T00:00:00`
    );

}


function formatDate(dateString) {

    if (!dateString) {
        return "—";
    }

    const date =
        parseDate(dateString);

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function getAllCategories() {

    return [
        ...DEFAULT_CATEGORIES,
        ...customCategories
            .filter(
                category =>
                    !DEFAULT_CATEGORIES.includes(category)
            )
    ];

}


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =====================================================
   TOAST
===================================================== */

function showToast(
    message,
    type = "success"
) {

    const container =
        $("toastContainer");

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    setTimeout(
        () => toast.remove(),
        3000
    );

}


/* =====================================================
   NAVIGATION
===================================================== */

const pageTitles = {

    dashboard: [
        "Dashboard",
        "Track and manage your finances"
    ],

    transactions: [
        "Transactions",
        "Search and manage your financial activity"
    ],

    reports: [
        "Reports",
        "Analyze your financial performance"
    ],

    planning: [
        "Planning",
        "Set budgets and savings goals"
    ],

    categories: [
        "Categories",
        "Manage your spending categories"
    ],

    settings: [
        "Settings",
        "Manage application preferences"
    ]

};


function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(
            section =>
                section.classList.remove(
                    "active-page"
                )
        );


    const selected =
        $(`${page}Page`);

    if (!selected) {
        return;
    }


    selected.classList.add(
        "active-page"
    );


    document
        .querySelectorAll(".nav-item")
        .forEach(
            item => {

                item.classList.toggle(
                    "active",
                    item.dataset.page === page
                );

            }
        );


    $("pageTitle").textContent =
        pageTitles[page][0];

    $("pageSubtitle").textContent =
        pageTitles[page][1];


    history.replaceState(
        null,
        "",
        `#${page}`
    );


    document
        .querySelector(".sidebar")
        .classList.remove(
            "mobile-open"
        );


    if (page === "dashboard") {
        updateDashboard();
    }

    if (page === "transactions") {
        displayTransactions();
    }

    if (page === "reports") {
        updateReports();
    }

    if (page === "planning") {
        updatePlanning();
    }

    if (page === "categories") {
        renderCategories();
    }

}


/* =====================================================
   NAV EVENTS
===================================================== */

document
    .querySelectorAll("[data-page]")
    .forEach(
        element => {

            element.addEventListener(
                "click",
                () => showPage(
                    element.dataset.page
                )
            );

        }
    );


$("mobileMenuButton")
    .addEventListener(
        "click",
        () => {

            document
                .querySelector(".sidebar")
                .classList.toggle(
                    "mobile-open"
                );

        }
    );


/* =====================================================
   CATEGORY SELECTS
===================================================== */

function populateCategorySelects() {

    const categories =
        getAllCategories();


    const categorySelect =
        $("category");

    const editCategory =
        $("editCategory");

    const filter =
        $("categoryFilter");


    const current =
        categorySelect.value;


    categorySelect.innerHTML =
        `<option value="">
            Select Category
        </option>`;


    categories.forEach(
        category => {

            categorySelect.insertAdjacentHTML(
                "beforeend",
                `<option value="${escapeHTML(category)}">
                    ${escapeHTML(category)}
                </option>`
            );

        }
    );


    if (
        categories.includes(current)
    ) {
        categorySelect.value =
            current;
    }


    editCategory.innerHTML = "";


    categories.forEach(
        category => {

            editCategory.insertAdjacentHTML(
                "beforeend",
                `<option value="${escapeHTML(category)}">
                    ${escapeHTML(category)}
                </option>`
            );

        }
    );


    const oldFilter =
        filter.value;


    filter.innerHTML =
        `<option value="all">
            All Categories
        </option>`;


    categories.forEach(
        category => {

            filter.insertAdjacentHTML(
                "beforeend",
                `<option value="${escapeHTML(category)}">
                    ${escapeHTML(category)}
                </option>`
            );

        }
    );


    if (
        categories.includes(oldFilter)
    ) {
        filter.value =
            oldFilter;
    }

}


/* =====================================================
   TOTALS
===================================================== */

function calculateTotals() {

    let income = 0;

    let expense = 0;


    transactions.forEach(
        transaction => {

            const amount =
                Number(transaction.amount);


            if (
                transaction.type ===
                "income"
            ) {

                income += amount;

            } else {

                expense += amount;

            }

        }
    );


    return {

        income,

        expense,

        balance:
            income - expense

    };

}


/* =====================================================
   MONTH HELPERS
===================================================== */

function getCurrentMonthExpenses() {

    const now =
        new Date();

    return transactions
        .filter(
            transaction => {

                if (
                    transaction.type !==
                    "expense"
                ) {
                    return false;
                }

                const date =
                    parseDate(
                        transaction.date
                    );

                return (
                    date.getMonth() ===
                        now.getMonth() &&
                    date.getFullYear() ===
                        now.getFullYear()
                );

            }
        )
        .reduce(
            (sum, transaction) =>
                sum +
                Number(
                    transaction.amount
                ),
            0
        );

}


function getCurrentMonthIncome() {

    const now =
        new Date();

    return transactions
        .filter(
            transaction => {

                if (
                    transaction.type !==
                    "income"
                ) {
                    return false;
                }

                const date =
                    parseDate(
                        transaction.date
                    );

                return (
                    date.getMonth() ===
                        now.getMonth() &&
                    date.getFullYear() ===
                        now.getFullYear()
                );

            }
        )
        .reduce(
            (sum, transaction) =>
                sum +
                Number(
                    transaction.amount
                ),
            0
        );

}


/* =====================================================
   PLANNING
===================================================== */

function updatePlanningCards() {

    const currentExpense =
        getCurrentMonthExpenses();


    const totals =
        calculateTotals();


    const remaining =
        monthlyBudget -
        currentExpense;


    const budgetPercent =
        monthlyBudget > 0
            ? Math.min(
                100,
                (
                    currentExpense /
                    monthlyBudget
                ) * 100
            )
            : 0;


    const savings =
        totals.balance;


    const savingsPercent =
        savingsGoal > 0
            ? Math.min(
                100,
                Math.max(
                    0,
                    (
                        savings /
                        savingsGoal
                    ) * 100
                )
            )
            : 0;


    $("dashboardBudget").textContent =
        formatCurrency(
            monthlyBudget
        );

    $("dashboardBudgetSpent").textContent =
        formatCurrency(
            currentExpense
        );

    $("dashboardBudgetRemaining").textContent =
        formatCurrency(
            Math.max(
                0,
                remaining
            )
        );

    $("dashboardBudgetProgress")
        .style.width =
        `${budgetPercent}%`;


    $("dashboardSavingsGoal").textContent =
        formatCurrency(
            savingsGoal
        );

    $("dashboardCurrentSavings").textContent =
        formatCurrency(
            savings
        );

    $("dashboardSavingsProgress")
        .style.width =
        `${savingsPercent}%`;

    $("dashboardSavingsPercent").textContent =
        `${savingsPercent.toFixed(0)}%`;


    $("planningBudget").textContent =
        formatCurrency(
            monthlyBudget
        );

    $("planningSpent").textContent =
        formatCurrency(
            currentExpense
        );

    $("planningRemaining").textContent =
        formatCurrency(
            remaining
        );

    $("planningBudgetProgress")
        .style.width =
        `${budgetPercent}%`;


    $("planningGoal").textContent =
        formatCurrency(
            savingsGoal
        );

    $("planningSavings").textContent =
        formatCurrency(
            savings
        );

    $("planningSavingsProgress")
        .style.width =
        `${savingsPercent}%`;

    $("planningPercent").textContent =
        `${savingsPercent.toFixed(0)}%`;

}


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {

    const totals =
        calculateTotals();


    $("totalIncome").textContent =
        formatCurrency(
            totals.income
        );

    $("totalExpense").textContent =
        formatCurrency(
            totals.expense
        );

    $("totalBalance").textContent =
        formatCurrency(
            totals.balance
        );


    const savingsRate =
        totals.income > 0
            ? (
                totals.balance /
                totals.income
            ) * 100
            : 0;


    $("dashboardSavingsRate").textContent =
        `${savingsRate.toFixed(1)}%`;


    updatePlanningCards();

    updateAnalytics();

    updateFinancialHealth();

    displayDashboardTransactions();

    updateCharts();

    updateInsights();

}


/* =====================================================
   ANALYTICS
===================================================== */

function updateAnalytics() {

    $("transactionCount").textContent =
        transactions.length;


    $("monthlySpending").textContent =
        formatCurrency(
            getCurrentMonthExpenses()
        );


    const totals = {};


    transactions.forEach(
        transaction => {

            if (
                transaction.type !==
                "expense"
            ) {
                return;
            }

            totals[
                transaction.category
            ] =
                (
                    totals[
                        transaction.category
                    ] || 0
                ) +
                Number(
                    transaction.amount
                );

        }
    );


    let top = "—";

    let highest = 0;


    Object.entries(totals)
        .forEach(
            ([category, amount]) => {

                if (
                    amount > highest
                ) {

                    highest = amount;

                    top = category;

                }

            }
        );


    $("topCategory").textContent =
        top;

}


/* =====================================================
   FINANCIAL HEALTH
===================================================== */

function updateFinancialHealth() {

    const totals =
        calculateTotals();


    const rate =
        totals.income > 0
            ? (
                totals.balance /
                totals.income
            ) * 100
            : 0;


    let health;

    let message;


    if (
        transactions.length === 0
    ) {

        health = "No Data";

        message =
            "Add transactions to receive financial insights.";

    }

    else if (
        totals.balance < 0
    ) {

        health = "Critical";

        message =
            "Your expenses are higher than your income.";

    }

    else if (
        monthlyBudget > 0 &&
        getCurrentMonthExpenses() >
            monthlyBudget
    ) {

        health = "Needs Attention";

        message =
            "You have exceeded your monthly budget.";

    }

    else if (
        rate >= 30
    ) {

        health = "Excellent";

        message =
            "You are maintaining an excellent savings rate.";

    }

    else if (
        rate >= 15
    ) {

        health = "Good";

        message =
            "Your finances are in a healthy range.";

    }

    else {

        health = "Needs Attention";

        message =
            "Try reducing unnecessary expenses and increasing savings.";

    }


    $("financialHealth").textContent =
        health;

    $("financialHealthMessage").textContent =
        message;

}


/* =====================================================
   FINANCIAL INSIGHTS
===================================================== */

function updateInsights() {

    const container =
        $("insightsContainer");

    container.innerHTML = "";


    const totals =
        calculateTotals();


    const insights = [];


    if (
        totals.balance < 0
    ) {

        insights.push({
            type: "warning",
            text:
                "Your total expenses are currently higher than your income."
        });

    }


    if (
        monthlyBudget > 0
    ) {

        const spent =
            getCurrentMonthExpenses();

        const percent =
            (
                spent /
                monthlyBudget
            ) * 100;


        if (
            percent >= 100
        ) {

            insights.push({
                type: "warning",
                text:
                    "You have exceeded your monthly budget."
            });

        }

        else if (
            percent >= 80
        ) {

            insights.push({
                type: "warning",
                text:
                    `You have used ${percent.toFixed(0)}% of your monthly budget.`
            });

        }

    }


    if (
        totals.income > 0
    ) {

        const rate =
            (
                totals.balance /
                totals.income
            ) * 100;


        if (
            rate >= 30
        ) {

            insights.push({
                type: "success",
                text:
                    `Excellent! Your savings rate is ${rate.toFixed(1)}%.`
            });

        }

        else if (
            rate >= 15
        ) {

            insights.push({
                type: "success",
                text:
                    `Your savings rate is ${rate.toFixed(1)}%. Keep it up.`
            });

        }

    }


    const categoryTotals = {};


    transactions.forEach(
        transaction => {

            if (
                transaction.type ===
                "expense"
            ) {

                categoryTotals[
                    transaction.category
                ] =
                    (
                        categoryTotals[
                            transaction.category
                        ] || 0
                    ) +
                    Number(
                        transaction.amount
                    );

            }

        }
    );


    const categoryEntries =
        Object.entries(
            categoryTotals
        );


    if (
        categoryEntries.length > 0
    ) {

        categoryEntries.sort(
            (a, b) =>
                b[1] - a[1]
        );


        insights.push({
            type: "info",
            text:
                `${categoryEntries[0][0]} is your highest spending category at ${formatCurrency(categoryEntries[0][1])}.`
        });

    }


    if (
        insights.length === 0
    ) {

        insights.push({
            type: "info",
            text:
                "Add more transactions to generate personalized financial insights."
        });

    }


    insights.forEach(
        insight => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                `insight ${insight.type}`;

            div.textContent =
                insight.text;

            container.appendChild(
                div
            );

        }
    );

}


/* =====================================================
   DASHBOARD TRANSACTIONS
===================================================== */

function displayDashboardTransactions() {

    const container =
        $("dashboardTransactions");

    container.innerHTML = "";


    const recent =
        [...transactions]
            .sort(
                (a, b) =>
                    parseDate(b.date) -
                    parseDate(a.date)
            )
            .slice(0, 5);


    if (
        recent.length === 0
    ) {

        container.innerHTML =
            `<div class="empty-message">
                No transactions yet.
            </div>`;

        return;
    }


    recent.forEach(
        transaction => {

            container.appendChild(
                createTransactionElement(
                    transaction,
                    false
                )
            );

        }
    );

}


/* =====================================================
   TRANSACTION ELEMENT
===================================================== */

function createTransactionElement(
    transaction,
    showActions = true
) {

    const item =
        document.createElement(
            "div"
        );

    item.className =
        "transaction-item";


    const info =
        document.createElement(
            "div"
        );

    info.className =
        "transaction-info";


    const title =
        document.createElement(
            "strong"
        );

    title.textContent =
        transaction.description ||
        transaction.category;


    const details =
        document.createElement(
            "p"
        );

    details.textContent =
        `${transaction.category} • ${formatDate(transaction.date)}`;


    info.appendChild(title);

    info.appendChild(details);


    const right =
        document.createElement(
            "div"
        );

    right.className =
        "transaction-right";


    const amount =
        document.createElement(
            "strong"
        );

    amount.className =
        transaction.type === "income"
            ? "income-amount"
            : "expense-amount";


    amount.textContent =
        `${
            transaction.type === "income"
                ? "+"
                : "-"
        }${formatCurrency(
            transaction.amount
        )}`;


    right.appendChild(
        amount
    );


    if (showActions) {

        const edit =
            document.createElement(
                "button"
            );

        edit.className =
            "edit-btn";

        edit.textContent =
            "Edit";

        edit.addEventListener(
            "click",
            () =>
                openEditModal(
                    transaction.id
                )
        );


        const del =
            document.createElement(
                "button"
            );

        del.className =
            "delete-btn";

        del.textContent =
            "Delete";

        del.addEventListener(
            "click",
            () =>
                deleteTransaction(
                    transaction.id
                )
        );


        right.appendChild(
            edit
        );

        right.appendChild(
            del
        );

    }


    item.appendChild(info);

    item.appendChild(right);


    return item;

}


/* =====================================================
   ADD TRANSACTION
===================================================== */

$("transactionForm")
    .addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const type =
                $("type").value;

            const amount =
                Number(
                    $("amount").value
                );

            const category =
                $("category").value;

            const date =
                $("date").value;

            const description =
                $("description")
                    .value
                    .trim();


            if (
                !amount ||
                amount <= 0 ||
                !category ||
                !date
            ) {

                showToast(
                    "Please fill all required fields.",
                    "error"
                );

                return;
            }


            const transaction = {

                id:
                    Date.now(),

                type,

                amount,

                category,

                date,

                description:
                    description ||
                    category

            };


            transactions.push(
                transaction
            );


            saveTransactions();


            event.target.reset();


            $("date").value =
                getToday();


            refreshApplication();


            showToast(
                "✓ Transaction added successfully!"
            );

        }
    );


/* =====================================================
   DELETE
===================================================== */

function deleteTransaction(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this transaction?"
        );


    if (!confirmed) {
        return;
    }


    transactions =
        transactions.filter(
            transaction =>
                transaction.id !== id
        );


    saveTransactions();


    refreshApplication();


    showToast(
        "✓ Transaction deleted successfully!"
    );

}


/* =====================================================
   EDIT MODAL
===================================================== */

function openEditModal(id) {

    const transaction =
        transactions.find(
            item =>
                item.id === id
        );


    if (!transaction) {
        return;
    }


    $("editId").value =
        transaction.id;

    $("editType").value =
        transaction.type;

    $("editAmount").value =
        transaction.amount;

    $("editCategory").value =
        transaction.category;

    $("editDate").value =
        transaction.date;

    $("editDescription").value =
        transaction.description || "";


    $("editModal")
        .classList.add(
            "show"
        );

}


function closeEditModal() {

    $("editModal")
        .classList.remove(
            "show"
        );

}


$("closeEditModal")
    .addEventListener(
        "click",
        closeEditModal
    );

$("cancelEdit")
    .addEventListener(
        "click",
        closeEditModal
    );


$("editModal")
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("editModal")
            ) {

                closeEditModal();

            }

        }
    );


$("editForm")
    .addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const id =
                Number(
                    $("editId").value
                );


            const transaction =
                transactions.find(
                    item =>
                        item.id === id
                );


            if (!transaction) {
                return;
            }


            const amount =
                Number(
                    $("editAmount").value
                );


            if (
                amount <= 0
            ) {

                showToast(
                    "Amount must be greater than zero.",
                    "error"
                );

                return;
            }


            transaction.type =
                $("editType").value;

            transaction.amount =
                amount;

            transaction.category =
                $("editCategory").value;

            transaction.date =
                $("editDate").value;

            transaction.description =
                $("editDescription")
                    .value
                    .trim() ||
                transaction.category;


            saveTransactions();

            closeEditModal();

            refreshApplication();


            showToast(
                "✓ Transaction updated successfully!"
            );

        }
    );


/* =====================================================
   TRANSACTION FILTERS
===================================================== */

function readFilters() {

    filters = {

        search:
            $("searchInput")
                .value
                .toLowerCase()
                .trim(),

        type:
            $("typeFilter").value,

        category:
            $("categoryFilter").value,

        sort:
            $("sortFilter").value,

        fromDate:
            $("fromDate").value,

        toDate:
            $("toDate").value,

        minAmount:
            $("minAmount").value,

        maxAmount:
            $("maxAmount").value

    };

}


function getFilteredTransactions() {

    return transactions.filter(
        transaction => {

            const searchable =
                `${transaction.description || ""} ${transaction.category}`
                    .toLowerCase();


            if (
                filters.search &&
                !searchable.includes(
                    filters.search
                )
            ) {
                return false;
            }


            if (
                filters.type !== "all" &&
                transaction.type !==
                    filters.type
            ) {
                return false;
            }


            if (
                filters.category !== "all" &&
                transaction.category !==
                    filters.category
            ) {
                return false;
            }


            if (
                filters.fromDate &&
                transaction.date <
                    filters.fromDate
            ) {
                return false;
            }


            if (
                filters.toDate &&
                transaction.date >
                    filters.toDate
            ) {
                return false;
            }


            if (
                filters.minAmount !== "" &&
                Number(transaction.amount) <
                    Number(filters.minAmount)
            ) {
                return false;
            }


            if (
                filters.maxAmount !== "" &&
                Number(transaction.amount) >
                    Number(filters.maxAmount)
            ) {
                return false;
            }


            return true;

        }
    );

}


function sortTransactions(list) {

    return list.sort(
        (a, b) => {

            if (
                filters.sort ===
                "newest"
            ) {

                return (
                    parseDate(b.date) -
                    parseDate(a.date)
                );

            }


            if (
                filters.sort ===
                "oldest"
            ) {

                return (
                    parseDate(a.date) -
                    parseDate(b.date)
                );

            }


            if (
                filters.sort ===
                "highest"
            ) {

                return (
                    Number(b.amount) -
                    Number(a.amount)
                );

            }


            if (
                filters.sort ===
                "lowest"
            ) {

                return (
                    Number(a.amount) -
                    Number(b.amount)
                );

            }


            return 0;

        }
    );

}


/* =====================================================
   DISPLAY TRANSACTIONS
===================================================== */

function displayTransactions() {

    const list =
        $("transactionList");


    readFilters();


    let filtered =
        getFilteredTransactions();


    filtered =
        sortTransactions(
            filtered
        );


    $("filteredTransactionCount")
        .textContent =
        `${filtered.length} transaction${
            filtered.length === 1
                ? ""
                : "s"
        }`;


    const total =
        filtered.reduce(
            (sum, transaction) =>
                sum +
                Number(
                    transaction.amount
                ),
            0
        );


    $("filteredTransactionTotal")
        .textContent =
        formatCurrency(
            total
        );


    list.innerHTML = "";


    if (
        filtered.length === 0
    ) {

        list.innerHTML =
            `<div class="empty-message">
                No matching transactions found.
            </div>`;

        return;
    }


    filtered.forEach(
        transaction => {

            list.appendChild(
                createTransactionElement(
                    transaction,
                    true
                )
            );

        }
    );

}


/* =====================================================
   FILTER EVENTS
===================================================== */

[
    "searchInput",
    "typeFilter",
    "categoryFilter",
    "sortFilter",
    "fromDate",
    "toDate",
    "minAmount",
    "maxAmount"
]
.forEach(
    id => {

        $(id).addEventListener(
            "input",
            displayTransactions
        );

        $(id).addEventListener(
            "change",
            displayTransactions
        );

    }
);


$("applyFiltersButton")
    .addEventListener(
        "click",
        displayTransactions
    );


$("resetFiltersButton")
    .addEventListener(
        "click",
        () => {

            $("searchInput").value = "";

            $("typeFilter").value =
                "all";

            $("categoryFilter").value =
                "all";

            $("sortFilter").value =
                "newest";

            $("fromDate").value = "";

            $("toDate").value = "";

            $("minAmount").value = "";

            $("maxAmount").value = "";

            displayTransactions();

        }
    );


/* =====================================================
   CSV EXPORT
===================================================== */

function csvEscape(value) {

    return `"${String(
        value ?? ""
    ).replaceAll(
        '"',
        '""'
    )}"`;

}


function downloadCSV(
    data,
    filename
) {

    const headers = [
        "ID",
        "Type",
        "Amount",
        "Category",
        "Date",
        "Description"
    ];


    const rows =
        data.map(
            transaction =>
                [
                    transaction.id,
                    transaction.type,
                    transaction.amount,
                    csvEscape(
                        transaction.category
                    ),
                    transaction.date,
                    csvEscape(
                        transaction.description
                    )
                ].join(",")
        );


    const csv =
        [
            headers.join(","),
            ...rows
        ].join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );

    link.href = url;

    link.download =
        filename;

    link.click();


    URL.revokeObjectURL(
        url
    );

}


$("exportCsvButton")
    .addEventListener(
        "click",
        () => {

            if (
                transactions.length === 0
            ) {

                showToast(
                    "No transactions to export.",
                    "error"
                );

                return;
            }


            downloadCSV(
                transactions,
                "expense-tracker.csv"
            );


            showToast(
                "✓ CSV exported successfully!"
            );

        }
    );


$("exportFilteredButton")
    .addEventListener(
        "click",
        () => {

            readFilters();


            const data =
                sortTransactions(
                    getFilteredTransactions()
                );


            if (
                data.length === 0
            ) {

                showToast(
                    "No filtered transactions to export.",
                    "error"
                );

                return;
            }


            downloadCSV(
                data,
                "filtered-transactions.csv"
            );


            showToast(
                "✓ Filtered transactions exported!"
            );

        }
    );


/* =====================================================
   CSV IMPORT
===================================================== */

function parseCSVLine(line) {

    const result = [];

    let current = "";

    let quoted = false;


    for (
        let i = 0;
        i < line.length;
        i++
    ) {

        const char =
            line[i];


        if (
            char === '"' &&
            line[i + 1] === '"'
        ) {

            current += '"';

            i++;

            continue;

        }


        if (
            char === '"'
        ) {

            quoted =
                !quoted;

            continue;

        }


        if (
            char === "," &&
            !quoted
        ) {

            result.push(
                current.trim()
            );

            current = "";

        }

        else {

            current += char;

        }

    }


    result.push(
        current.trim()
    );


    return result;

}


$("importCsvInput")
    .addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];


            if (!file) {
                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                () => {

                    try {

                        const lines =
                            reader.result
                                .split(/\r?\n/)
                                .filter(
                                    line =>
                                        line.trim()
                                );


                        if (
                            lines.length < 2
                        ) {

                            throw new Error(
                                "Invalid CSV"
                            );

                        }


                        const imported = [];


                        for (
                            let i = 1;
                            i < lines.length;
                            i++
                        ) {

                            const columns =
                                parseCSVLine(
                                    lines[i]
                                );


                            if (
                                columns.length <
                                6
                            ) {
                                continue;
                            }


                            const transaction = {

                                id:
                                    Number(
                                        columns[0]
                                    ) ||
                                    Date.now() +
                                    i,

                                type:
                                    columns[1],

                                amount:
                                    Number(
                                        columns[2]
                                    ),

                                category:
                                    columns[3],

                                date:
                                    columns[4],

                                description:
                                    columns[5] ||
                                    columns[3]

                            };


                            if (
                                (
                                    transaction.type ===
                                        "income" ||
                                    transaction.type ===
                                        "expense"
                                ) &&
                                transaction.amount >
                                    0 &&
                                transaction.category &&
                                transaction.date
                            ) {

                                imported.push(
                                    transaction
                                );

                            }

                        }


                        if (
                            imported.length === 0
                        ) {

                            throw new Error(
                                "No valid transactions"
                            );

                        }


                        const existingIds =
                            new Set(
                                transactions.map(
                                    t => t.id
                                )
                            );


                        const unique =
                            imported.filter(
                                t =>
                                    !existingIds.has(
                                        t.id
                                    )
                            );


                        if (
                            unique.length === 0
                        ) {

                            showToast(
                                "All imported transactions already exist.",
                                "info"
                            );

                            return;
                        }


                        const confirmed =
                            confirm(
                                `Import ${unique.length} new transaction(s)?`
                            );


                        if (!confirmed) {
                            return;
                        }


                        transactions.push(
                            ...unique
                        );


                        saveTransactions();

                        refreshApplication();


                        showToast(
                            `✓ ${unique.length} transaction(s) imported!`
                        );

                    }

                    catch (error) {

                        console.error(
                            error
                        );

                        showToast(
                            "Unable to import CSV.",
                            "error"
                        );

                    }

                };


            reader.readAsText(
                file
            );


            event.target.value =
                "";

        }
    );


/* =====================================================
   CHART DATA
===================================================== */

function getMonthlyData() {

    const data = {};


    transactions.forEach(
        transaction => {

            const date =
                parseDate(
                    transaction.date
                );


            const key =
                `${date.getFullYear()}-${
                    String(
                        date.getMonth() + 1
                    ).padStart(2, "0")
                }`;


            if (!data[key]) {

                data[key] = {

                    income: 0,

                    expense: 0,

                    date

                };

            }


            if (
                transaction.type ===
                "income"
            ) {

                data[key].income +=
                    Number(
                        transaction.amount
                    );

            }

            else {

                data[key].expense +=
                    Number(
                        transaction.amount
                    );

            }

        }
    );


    return data;

}


/* =====================================================
   CHARTS
===================================================== */

function updateCharts() {

    createIncomeExpenseChart();

    createExpenseCategoryChart();

    createReportCharts();

}


function createIncomeExpenseChart() {

    const canvas =
        $("incomeExpenseChart");


    if (!canvas) {
        return;
    }


    const data =
        getMonthlyData();


    const keys =
        Object.keys(data)
            .sort();


    const labels =
        keys.map(
            key =>
                data[key]
                    .date
                    .toLocaleString(
                        "en-IN",
                        {
                            month: "short",
                            year: "numeric"
                        }
                    )
        );


    const income =
        keys.map(
            key =>
                data[key].income
        );


    const expense =
        keys.map(
            key =>
                data[key].expense
        );


    if (
        incomeExpenseChart
    ) {

        incomeExpenseChart.destroy();

    }


    incomeExpenseChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels,

                    datasets: [

                        {
                            label: "Income",
                            data: income,
                            backgroundColor:
                                "#22c55e"
                        },

                        {
                            label: "Expenses",
                            data: expense,
                            backgroundColor:
                                "#fb7185"
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            position:
                                "bottom"
                        }

                    },

                    scales: {

                        y: {
                            beginAtZero:
                                true
                        }

                    }

                }

            }
        );

}


function createExpenseCategoryChart() {

    const canvas =
        $("expenseCategoryChart");


    if (!canvas) {
        return;
    }


    const totals = {};


    transactions.forEach(
        transaction => {

            if (
                transaction.type !==
                "expense"
            ) {
                return;
            }


            totals[
                transaction.category
            ] =
                (
                    totals[
                        transaction.category
                    ] || 0
                ) +
                Number(
                    transaction.amount
                );

        }
    );


    const categories =
        Object.keys(
            totals
        );


    const values =
        categories.map(
            category =>
                totals[category]
        );


    if (
        expenseCategoryChart
    ) {

        expenseCategoryChart.destroy();

    }


    if (
        categories.length === 0
    ) {

        return;

    }


    expenseCategoryChart =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels: categories,

                    datasets: [

                        {
                            data: values,

                            backgroundColor: [
                                "#60a5fa",
                                "#fb7185",
                                "#a78bfa",
                                "#34d399",
                                "#fbbf24",
                                "#f472b6",
                                "#38bdf8",
                                "#c084fc",
                                "#94a3b8"
                            ]

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            position:
                                "bottom"
                        }

                    }

                }

            }
        );

}


/* =====================================================
   REPORTS
===================================================== */

function updateReports() {

    const totals =
        calculateTotals();


    const expenses =
        transactions.filter(
            t =>
                t.type ===
                "expense"
        );


    const average =
        expenses.length
            ? totals.expense /
                expenses.length
            : 0;


    const highest =
        expenses.length
            ? Math.max(
                ...expenses.map(
                    t =>
                        Number(
                            t.amount
                        )
                )
            )
            : 0;


    const lowest =
        expenses.length
            ? Math.min(
                ...expenses.map(
                    t =>
                        Number(
                            t.amount
                        )
                )
            )
            : 0;


    const savingsRate =
        totals.income > 0
            ? (
                totals.balance /
                totals.income
            ) * 100
            : 0;


    $("reportNetSavings")
        .textContent =
        formatCurrency(
            totals.balance
        );


    $("reportAverageExpense")
        .textContent =
        formatCurrency(
            average
        );


    $("reportHighestExpense")
        .textContent =
        formatCurrency(
            highest
        );


    $("reportExpenseCount")
        .textContent =
        expenses.length;


    $("reportSavingsRate")
        .textContent =
        `${savingsRate.toFixed(1)}%`;


    $("reportLowestExpense")
        .textContent =
        formatCurrency(
            lowest
        );


    updateCategoryTable();

    updateMonthlyComparison();

    createReportCharts();

}


/* =====================================================
   REPORT CATEGORY TABLE
===================================================== */

function updateCategoryTable() {

    const body =
        $("categoryReportBody");


    body.innerHTML = "";


    const totals = {};

    const counts = {};


    transactions.forEach(
        transaction => {

            if (
                transaction.type !==
                "expense"
            ) {
                return;
            }


            const category =
                transaction.category;


            totals[category] =
                (
                    totals[category] ||
                    0
                ) +
                Number(
                    transaction.amount
                );


            counts[category] =
                (
                    counts[category] ||
                    0
                ) + 1;

        }
    );


    const totalExpense =
        Object.values(
            totals
        ).reduce(
            (sum, value) =>
                sum + value,
            0
        );


    const categories =
        Object.keys(
            totals
        ).sort(
            (a, b) =>
                totals[b] -
                totals[a]
        );


    if (
        categories.length === 0
    ) {

        body.innerHTML =
            `<tr>
                <td colspan="4">
                    No expense data available.
                </td>
            </tr>`;

        return;
    }


    categories.forEach(
        category => {

            const percentage =
                totalExpense > 0
                    ? (
                        totals[category] /
                        totalExpense
                    ) * 100
                    : 0;


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    <strong>
                        ${escapeHTML(category)}
                    </strong>
                </td>

                <td>
                    ${counts[category]}
                </td>

                <td>
                    ${formatCurrency(
                        totals[category]
                    )}
                </td>

                <td>
                    ${percentage.toFixed(1)}%
                </td>

            `;


            body.appendChild(
                row
            );

        }
    );

}


/* =====================================================
   REPORT CHARTS
===================================================== */

function createReportCharts() {

    const monthlyCanvas =
        $("reportMonthlyChart");


    const categoryCanvas =
        $("reportCategoryChart");


    if (
        reportMonthlyChart
    ) {

        reportMonthlyChart.destroy();

    }


    if (
        reportCategoryChart
    ) {

        reportCategoryChart.destroy();

    }


    const monthlyData =
        getMonthlyData();


    const keys =
        Object.keys(
            monthlyData
        ).sort();


    reportMonthlyChart =
        new Chart(
            monthlyCanvas,
            {

                type: "line",

                data: {

                    labels:
                        keys.map(
                            key =>
                                monthlyData[key]
                                    .date
                                    .toLocaleString(
                                        "en-IN",
                                        {
                                            month:
                                                "short",
                                            year:
                                                "numeric"
                                        }
                                    )
                        ),

                    datasets: [

                        {
                            label:
                                "Income",

                            data:
                                keys.map(
                                    key =>
                                        monthlyData[key]
                                            .income
                                ),

                            borderColor:
                                "#22c55e",

                            backgroundColor:
                                "rgba(34,197,94,.1)",

                            tension:
                                0.3

                        },

                        {
                            label:
                                "Expenses",

                            data:
                                keys.map(
                                    key =>
                                        monthlyData[key]
                                            .expense
                                ),

                            borderColor:
                                "#f43f5e",

                            backgroundColor:
                                "rgba(244,63,94,.1)",

                            tension:
                                0.3

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            position:
                                "bottom"
                        }

                    }

                }

            }
        );


    const categoryTotals = {};


    transactions.forEach(
        transaction => {

            if (
                transaction.type ===
                "expense"
            ) {

                categoryTotals[
                    transaction.category
                ] =
                    (
                        categoryTotals[
                            transaction.category
                        ] || 0
                    ) +
                    Number(
                        transaction.amount
                    );

            }

        }
    );


    const categories =
        Object.keys(
            categoryTotals
        );


    if (
        categories.length > 0
    ) {

        reportCategoryChart =
            new Chart(
                categoryCanvas,
                {

                    type: "pie",

                    data: {

                        labels:
                            categories,

                        datasets: [

                            {
                                data:
                                    categories.map(
                                        category =>
                                            categoryTotals[
                                                category
                                            ]
                                    ),

                                backgroundColor: [
                                    "#fb7185",
                                    "#60a5fa",
                                    "#a78bfa",
                                    "#34d399",
                                    "#fbbf24",
                                    "#f472b6",
                                    "#38bdf8",
                                    "#c084fc",
                                    "#94a3b8"
                                ]

                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        plugins: {

                            legend: {
                                position:
                                    "bottom"
                            }

                        }

                    }

                }
            );

    }

}


/* =====================================================
   MONTHLY COMPARISON
===================================================== */

function updateMonthlyComparison() {

    const data =
        getMonthlyData();


    const keys =
        Object.keys(
            data
        ).sort();


    const output =
        $("monthlyComparison");


    if (
        keys.length < 2
    ) {

        output.textContent =
            "Add transactions across at least two months to compare spending.";

        return;
    }


    const current =
        data[
            keys[keys.length - 1]
        ];

    const previous =
        data[
            keys[keys.length - 2]
        ];


    const expenseDifference =
        current.expense -
        previous.expense;


    const incomeDifference =
        current.income -
        previous.income;


    let message =
        "";


    if (
        expenseDifference > 0
    ) {

        message +=
            `Expenses increased by ${formatCurrency(expenseDifference)} compared with the previous month. `;

    }

    else if (
        expenseDifference < 0
    ) {

        message +=
            `Expenses decreased by ${formatCurrency(Math.abs(expenseDifference))} compared with the previous month. `;

    }

    else {

        message +=
            "Expenses remained unchanged. ";

    }


    if (
        incomeDifference > 0
    ) {

        message +=
            `Income increased by ${formatCurrency(incomeDifference)}.`;

    }

    else if (
        incomeDifference < 0
    ) {

        message +=
            `Income decreased by ${formatCurrency(Math.abs(incomeDifference))}.`;

    }

    else {

        message +=
            "Income remained unchanged.";

    }


    output.textContent =
        message;

}


/* =====================================================
   CATEGORIES
===================================================== */

function renderCategories() {

    const container =
        $("categoryList");


    container.innerHTML = "";


    getAllCategories()
        .forEach(
            category => {

                const used =
                    transactions.filter(
                        transaction =>
                            transaction.category ===
                            category
                    ).length;


                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "category-item";


                const info =
                    document.createElement(
                        "div"
                    );


                info.innerHTML = `

                    <div class="category-name">
                        ${escapeHTML(category)}
                    </div>

                    <div class="category-meta">
                        ${used} transaction${
                            used === 1
                                ? ""
                                : "s"
                        }
                    </div>

                `;


                item.appendChild(
                    info
                );


                if (
                    customCategories.includes(
                        category
                    )
                ) {

                    const button =
                        document.createElement(
                            "button"
                        );


                    button.className =
                        "delete-btn";

                    button.textContent =
                        "Delete";


                    button.addEventListener(
                        "click",
                        () =>
                            deleteCategory(
                                category
                            )
                    );


                    item.appendChild(
                        button
                    );

                }


                container.appendChild(
                    item
                );

            }
        );

}


$("categoryForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const input =
                $("newCategoryInput");


            const category =
                input.value
                    .trim();


            if (
                !category
            ) {
                return;
            }


            const exists =
                getAllCategories()
                    .some(
                        existing =>
                            existing.toLowerCase() ===
                            category.toLowerCase()
                    );


            if (exists) {

                showToast(
                    "That category already exists.",
                    "error"
                );

                return;
            }


            customCategories.push(
                category
            );


            saveCategories();

            populateCategorySelects();

            renderCategories();


            input.value = "";


            showToast(
                "✓ Category added successfully!"
            );

        }
    );


function deleteCategory(
    category
) {

    const used =
        transactions.some(
            transaction =>
                transaction.category ===
                category
        );


    if (used) {

        showToast(
            "This category is being used by a transaction.",
            "error"
        );

        return;
    }


    const confirmed =
        confirm(
            `Delete category "${category}"?`
        );


    if (!confirmed) {
        return;
    }


    customCategories =
        customCategories.filter(
            item =>
                item !== category
        );


    saveCategories();

    populateCategorySelects();

    renderCategories();


    showToast(
        "Category deleted."
    );

}


/* =====================================================
   PLANNING BUTTONS
===================================================== */

function setBudget() {

    const value =
        prompt(
            "Enter your monthly budget:",
            monthlyBudget || ""
        );


    if (
        value === null
    ) {
        return;
    }


    const amount =
        Number(value);


    if (
        !amount ||
        amount <= 0
    ) {

        showToast(
            "Please enter a valid budget.",
            "error"
        );

        return;
    }


    monthlyBudget =
        amount;


    savePlanning();

    refreshApplication();


    showToast(
        "✓ Monthly budget updated!"
    );

}


function setSavingsGoal() {

    const value =
        prompt(
            "Enter your savings goal:",
            savingsGoal || ""
        );


    if (
        value === null
    ) {
        return;
    }


    const amount =
        Number(value);


    if (
        !amount ||
        amount <= 0
    ) {

        showToast(
            "Please enter a valid savings goal.",
            "error"
        );

        return;
    }


    savingsGoal =
        amount;


    savePlanning();

    refreshApplication();


    showToast(
        "✓ Savings goal updated!"
    );

}


$("setBudgetButton")
    .addEventListener(
        "click",
        setBudget
    );


$("setSavingsButton")
    .addEventListener(
        "click",
        setSavingsGoal
    );


$("settingsBudgetButton")
    .addEventListener(
        "click",
        setBudget
    );


$("settingsSavingsButton")
    .addEventListener(
        "click",
        setSavingsGoal
    );


/* =====================================================
   THEME
===================================================== */

function syncChartTheme(dark) {

    if (typeof Chart === "undefined") {
        return;
    }

    Chart.defaults.font.family =
        getComputedStyle(document.body).fontFamily;

    Chart.defaults.color =
        dark
            ? "#8f9cb5"
            : "#6b7891";

    Chart.defaults.borderColor =
        dark
            ? "rgba(143, 156, 181, 0.15)"
            : "rgba(15, 27, 51, 0.08)";

}


function applyTheme() {

    const dark =
        localStorage.getItem(
            "theme"
        ) === "dark";


    document.body.classList.toggle(
        "dark-mode",
        dark
    );


    syncChartTheme(dark);


    $("themeToggle")
        .textContent =
        dark
            ? "☀️"
            : "🌙";

}


function toggleTheme() {

    const dark =
        document.body
            .classList
            .toggle(
                "dark-mode"
            );


    localStorage.setItem(
        "theme",
        dark
            ? "dark"
            : "light"
    );


    $("themeToggle")
        .textContent =
        dark
            ? "☀️"
            : "🌙";


    showToast(
        dark
            ? "Dark mode enabled"
            : "Light mode enabled",
        "info"
    );


    // Charts are rebuilt on refresh, picking up the new colours.
    syncChartTheme(dark);

    refreshApplication();

}


$("themeToggle")
    .addEventListener(
        "click",
        toggleTheme
    );


$("settingsThemeButton")
    .addEventListener(
        "click",
        toggleTheme
    );


/* =====================================================
   BACKUP
===================================================== */

$("backupButton")
    .addEventListener(
        "click",
        () => {

            const backup = {

                version: "2.0",

                createdAt:
                    new Date()
                        .toISOString(),

                transactions,

                customCategories,

                monthlyBudget,

                savingsGoal,

                theme:
                    localStorage.getItem(
                        "theme"
                    ) || "light"

            };


            const blob =
                new Blob(
                    [
                        JSON.stringify(
                            backup,
                            null,
                            2
                        )
                    ],
                    {
                        type:
                            "application/json"
                    }
                );


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;

            link.download =
                "expense-tracker-backup.json";

            link.click();


            URL.revokeObjectURL(
                url
            );


            showToast(
                "✓ Backup created successfully!"
            );

        }
    );


/* =====================================================
   RESTORE
===================================================== */

$("restoreInput")
    .addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];


            if (!file) {
                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                () => {

                    try {

                        const backup =
                            JSON.parse(
                                reader.result
                            );


                        if (
                            !Array.isArray(
                                backup.transactions
                            )
                        ) {

                            throw new Error(
                                "Invalid backup"
                            );

                        }


                        const confirmed =
                            confirm(
                                "Restore this backup? Current application data will be replaced."
                            );


                        if (!confirmed) {
                            return;
                        }


                        transactions =
                            backup.transactions;


                        customCategories =
                            Array.isArray(
                                backup.customCategories
                            )
                                ? backup.customCategories
                                : [];


                        monthlyBudget =
                            Number(
                                backup.monthlyBudget ||
                                0
                            );


                        savingsGoal =
                            Number(
                                backup.savingsGoal ||
                                0
                            );


                        saveTransactions();

                        saveCategories();

                        savePlanning();


                        if (
                            backup.theme ===
                            "dark"
                        ) {

                            localStorage.setItem(
                                "theme",
                                "dark"
                            );

                        }

                        else {

                            localStorage.setItem(
                                "theme",
                                "light"
                            );

                        }


                        applyTheme();

                        populateCategorySelects();

                        refreshApplication();

                        renderCategories();


                        showToast(
                            "✓ Backup restored successfully!"
                        );

                    }

                    catch (error) {

                        console.error(
                            error
                        );

                        showToast(
                            "Invalid backup file.",
                            "error"
                        );

                    }

                };


            reader.readAsText(
                file
            );


            event.target.value =
                "";

        }
    );


/* =====================================================
   CLEAR DATA
===================================================== */

$("clearDataButton")
    .addEventListener(
        "click",
        () => {

            if (
                transactions.length === 0
            ) {

                showToast(
                    "There is no transaction data to clear.",
                    "info"
                );

                return;
            }


            const confirmed =
                confirm(
                    "This will permanently delete ALL transactions from your account. Continue?"
                );


            if (!confirmed) {
                return;
            }


            transactions = [];


            saveTransactions();


            refreshApplication();


            showToast(
                "All transaction data cleared.",
                "info"
            );

        }
    );


/* =====================================================
   REFRESH
===================================================== */

function refreshApplication() {

    updateDashboard();

    displayTransactions();

    updateReports();

    updatePlanningCards();

    renderCategories();

}


/* =====================================================
   INITIALIZATION
===================================================== */

async function initialize() {

    applyTheme();


    $("date").value =
        getToday();


    try {

        await loadUserData();

    } catch (error) {

        console.error("Load error:", error);

        showToast(
            "Could not load your data from the server. Please refresh.",
            "error"
        );

        return;

    }


    $("userName").textContent =
        currentUser.name;

    $("userEmail").textContent =
        currentUser.email;

    $("logoutButton")
        .addEventListener(
            "click",
            logout
        );


    offerLegacyImport();


    populateCategorySelects();


    updateDashboard();

    displayTransactions();

    updateReports();

    updatePlanningCards();

    renderCategories();


    const hash =
        location.hash
            .replace(
                "#",
                ""
            );


    if (
        pageTitles[hash]
    ) {

        showPage(
            hash
        );

    }

    else {

        showPage(
            "dashboard"
        );

    }

}


initialize();