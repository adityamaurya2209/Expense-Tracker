// ========================================
// STUDENT EXPENSE TRACKER
// ========================================


// ========================================
// GET HTML ELEMENTS
// ========================================

const transactionForm =
    document.getElementById("transactionForm");

const totalBalance =
    document.getElementById("totalBalance");

const totalIncome =
    document.getElementById("totalIncome");

const totalExpense =
    document.getElementById("totalExpense");

const transactionList =
    document.getElementById("transactionList");

const searchInput =
    document.getElementById("searchInput");

const typeFilter =
    document.getElementById("typeFilter");

const categoryFilter =
    document.getElementById("categoryFilter");

const sortFilter =
    document.getElementById("sortFilter");


// ========================================
// ANALYTICS ELEMENTS
// ========================================

const transactionCount =
    document.getElementById("transactionCount");

const monthlySpending =
    document.getElementById("monthlySpending");

const topCategory =
    document.getElementById("topCategory");


// ========================================
// THEME
// ========================================

const themeToggle =
    document.getElementById("themeToggle");


// ========================================
// TOAST
// ========================================

const toast =
    document.getElementById("toast");

let toastTimeout;


// ========================================
// CHART INSTANCES
// ========================================

let incomeExpenseChart = null;

let expenseCategoryChart = null;


// ========================================
// LOAD TRANSACTIONS
// ========================================

let transactions =
    JSON.parse(
        localStorage.getItem("transactions")
    ) || [];


// ========================================
// ADD TRANSACTION
// ========================================

transactionForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        const type =
            document.getElementById("type").value;

        const amount =
            Number(
                document.getElementById("amount").value
            );

        const category =
            document.getElementById("category").value;

        const date =
            document.getElementById("date").value;

        const description =
            document
                .getElementById("description")
                .value
                .trim();


        // Validate amount

        if (!amount || amount <= 0) {

            showToast(
                "Please enter a valid amount.",
                "error"
            );

            return;

        }


        // Create transaction

        const transaction = {

            id: Date.now(),

            type: type,

            amount: amount,

            category: category,

            date: date,

            description: description

        };


        transactions.push(transaction);


        saveTransactions();

        updateDashboard();

        displayTransactions();

        updateAnalytics();


        transactionForm.reset();


        showToast(
            "Transaction added successfully!",
            "success"
        );

    }
);


// ========================================
// SAVE TRANSACTIONS
// ========================================

function saveTransactions() {

    localStorage.setItem(
        "transactions",
        JSON.stringify(transactions)
    );

}


// ========================================
// UPDATE DASHBOARD
// ========================================

function updateDashboard() {

    let income = 0;

    let expense = 0;


    transactions.forEach(
        function (transaction) {

            if (
                transaction.type === "income"
            ) {

                income += transaction.amount;

            } else {

                expense += transaction.amount;

            }

        }
    );


    const balance =
        income - expense;


    totalIncome.textContent =
        formatCurrency(income);

    totalExpense.textContent =
        formatCurrency(expense);

    totalBalance.textContent =
        formatCurrency(balance);

}


// ========================================
// DISPLAY TRANSACTIONS
// ========================================

function displayTransactions() {

    transactionList.innerHTML = "";


    const searchText =
        searchInput.value
            .toLowerCase()
            .trim();

    const selectedType =
        typeFilter.value;

    const selectedCategory =
        categoryFilter.value;

    const selectedSort =
        sortFilter.value;


    let filteredTransactions =
        transactions.filter(
            function (transaction) {

                const description =
                    transaction.description || "";

                const matchesSearch =

                    description
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    transaction.category
                        .toLowerCase()
                        .includes(searchText);


                const matchesType =

                    selectedType === "all"

                    ||

                    transaction.type ===
                    selectedType;


                const matchesCategory =

                    selectedCategory === "all"

                    ||

                    transaction.category ===
                    selectedCategory;


                return (
                    matchesSearch &&
                    matchesType &&
                    matchesCategory
                );

            }
        );


    // ====================================
    // SORT
    // ====================================

    filteredTransactions.sort(
        function (a, b) {

            if (
                selectedSort === "newest"
            ) {

                return (
                    new Date(b.date) -
                    new Date(a.date)
                );

            }


            if (
                selectedSort === "oldest"
            ) {

                return (
                    new Date(a.date) -
                    new Date(b.date)
                );

            }


            if (
                selectedSort === "highest"
            ) {

                return b.amount - a.amount;

            }


            if (
                selectedSort === "lowest"
            ) {

                return a.amount - b.amount;

            }


            return 0;

        }
    );


    // ====================================
    // NO RESULTS
    // ====================================

    if (
        filteredTransactions.length === 0
    ) {

        transactionList.innerHTML = `
            <p class="empty-message">
                No matching transactions found.
            </p>
        `;

        return;

    }


    // ====================================
    // DISPLAY
    // ====================================

    filteredTransactions.forEach(
        function (transaction) {

            const transactionItem =
                document.createElement("div");


            transactionItem.classList.add(
                "transaction-item"
            );


            // Information

            const transactionInfo =
                document.createElement("div");


            transactionInfo.classList.add(
                "transaction-info"
            );


            const title =
                document.createElement("strong");


            title.textContent =
                transaction.description ||
                transaction.category;


            const details =
                document.createElement("p");


            details.textContent =
                `${transaction.category} • ${transaction.date}`;


            transactionInfo.appendChild(title);

            transactionInfo.appendChild(details);


            // Right side

            const transactionRight =
                document.createElement("div");


            transactionRight.classList.add(
                "transaction-right"
            );


            // Amount

            const amount =
                document.createElement("strong");


            amount.classList.add(

                transaction.type === "income"

                    ? "income-amount"

                    : "expense-amount"

            );


            amount.textContent =

                `${
                    transaction.type === "income"
                        ? "+"
                        : "-"
                }${formatCurrency(transaction.amount)}`;


            // Delete button

            const deleteButton =
                document.createElement("button");


            deleteButton.classList.add(
                "delete-btn"
            );


            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteTransaction(
                        transaction.id
                    );

                }
            );


            transactionRight.appendChild(
                amount
            );

            transactionRight.appendChild(
                deleteButton
            );


            transactionItem.appendChild(
                transactionInfo
            );

            transactionItem.appendChild(
                transactionRight
            );


            transactionList.appendChild(
                transactionItem
            );

        }
    );

}


// ========================================
// DELETE TRANSACTION
// ========================================

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
            function (transaction) {

                return transaction.id !== id;

            }
        );


    saveTransactions();

    updateDashboard();

    displayTransactions();

    updateAnalytics();


    showToast(
        "Transaction deleted successfully!",
        "success"
    );

}


// ========================================
// CURRENCY FORMAT
// ========================================

function formatCurrency(amount) {

    return (
        "₹" +
        amount.toLocaleString("en-IN")
    );

}


// ========================================
// FILTER EVENTS
// ========================================

searchInput.addEventListener(
    "input",
    displayTransactions
);


typeFilter.addEventListener(
    "change",
    displayTransactions
);


categoryFilter.addEventListener(
    "change",
    displayTransactions
);


sortFilter.addEventListener(
    "change",
    displayTransactions
);


// ========================================
// ANALYTICS
// ========================================

function updateAnalytics() {

    transactionCount.textContent =
        transactions.length;


    const currentDate =
        new Date();

    const currentMonth =
        currentDate.getMonth();

    const currentYear =
        currentDate.getFullYear();


    let currentMonthExpense = 0;


    transactions.forEach(
        function (transaction) {

            if (
                transaction.type !==
                "expense"
            ) {

                return;

            }


            const transactionDate =
                new Date(transaction.date);


            if (
                transactionDate.getMonth() ===
                currentMonth &&

                transactionDate.getFullYear() ===
                currentYear
            ) {

                currentMonthExpense +=
                    transaction.amount;

            }

        }
    );


    monthlySpending.textContent =
        formatCurrency(
            currentMonthExpense
        );


    const categoryTotals = {};


    transactions.forEach(
        function (transaction) {

            if (
                transaction.type !==
                "expense"
            ) {

                return;

            }


            if (
                !categoryTotals[
                    transaction.category
                ]
            ) {

                categoryTotals[
                    transaction.category
                ] = 0;

            }


            categoryTotals[
                transaction.category
            ] += transaction.amount;

        }
    );


    let highestCategory = "—";

    let highestAmount = 0;


    Object.keys(categoryTotals).forEach(
        function (category) {

            if (
                categoryTotals[category] >
                highestAmount
            ) {

                highestAmount =
                    categoryTotals[category];

                highestCategory =
                    category;

            }

        }
    );


    topCategory.textContent =
        highestCategory;


    updateCharts();

}


// ========================================
// CHARTS
// ========================================

function updateCharts() {

    const isDark =
        document.body.classList.contains(
            "dark-mode"
        );


    Chart.defaults.color =
        isDark
            ? "#cbd5e1"
            : "#374151";


    Chart.defaults.borderColor =
        isDark
            ? "#334155"
            : "#e5e7eb";


    createIncomeExpenseChart();

    createExpenseCategoryChart();

}


// ========================================
// INCOME VS EXPENSE CHART
// ========================================

function createIncomeExpenseChart() {

    const monthlyData = {};


    transactions.forEach(
        function (transaction) {

            const date =
                new Date(transaction.date);


            const month =
                date.toLocaleString(
                    "en-IN",
                    {
                        month: "short"
                    }
                );


            const year =
                date.getFullYear();


            const key =
                `${month} ${year}`;


            if (!monthlyData[key]) {

                monthlyData[key] = {

                    income: 0,

                    expense: 0,

                    date: date

                };

            }


            if (
                transaction.type ===
                "income"
            ) {

                monthlyData[key].income +=
                    transaction.amount;

            } else {

                monthlyData[key].expense +=
                    transaction.amount;

            }

        }
    );


    const sortedMonths =
        Object.keys(monthlyData).sort(
            function (a, b) {

                return (
                    monthlyData[a].date -
                    monthlyData[b].date
                );

            }
        );


    const incomeData =
        sortedMonths.map(
            function (month) {

                return monthlyData[
                    month
                ].income;

            }
        );


    const expenseData =
        sortedMonths.map(
            function (month) {

                return monthlyData[
                    month
                ].expense;

            }
        );


    const canvas =
        document.getElementById(
            "incomeExpenseChart"
        );


    if (incomeExpenseChart) {

        incomeExpenseChart.destroy();

    }


    incomeExpenseChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels:
                        sortedMonths,

                    datasets: [

                        {

                            label:
                                "Income",

                            data:
                                incomeData

                        },

                        {

                            label:
                                "Expenses",

                            data:
                                expenseData

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


// ========================================
// EXPENSE CATEGORY CHART
// ========================================

function createExpenseCategoryChart() {

    const categoryTotals = {};


    transactions.forEach(
        function (transaction) {

            if (
                transaction.type !==
                "expense"
            ) {

                return;

            }


            if (
                !categoryTotals[
                    transaction.category
                ]
            ) {

                categoryTotals[
                    transaction.category
                ] = 0;

            }


            categoryTotals[
                transaction.category
            ] += transaction.amount;

        }
    );


    const categories =
        Object.keys(categoryTotals);


    const amounts =
        categories.map(
            function (category) {

                return categoryTotals[
                    category
                ];

            }
        );


    const canvas =
        document.getElementById(
            "expenseCategoryChart"
        );


    if (expenseCategoryChart) {

        expenseCategoryChart.destroy();

    }


    if (
        categories.length === 0
    ) {

        expenseCategoryChart =
            null;

        return;

    }


    expenseCategoryChart =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels:
                        categories,

                    datasets: [

                        {

                            label:
                                "Expenses",

                            data:
                                amounts

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


// ========================================
// DARK MODE
// ========================================

function applyTheme() {

    const savedTheme =
        localStorage.getItem(
            "theme"
        );


    if (
        savedTheme === "dark"
    ) {

        document.body.classList.add(
            "dark-mode"
        );

        themeToggle.textContent =
            "☀️";

    } else {

        document.body.classList.remove(
            "dark-mode"
        );

        themeToggle.textContent =
            "🌙";

    }

}


// ========================================
// THEME TOGGLE
// ========================================

themeToggle.addEventListener(
    "click",
    function () {

        document.body.classList.toggle(
            "dark-mode"
        );


        const isDark =
            document.body.classList.contains(
                "dark-mode"
            );


        if (isDark) {

            themeToggle.textContent =
                "☀️";

            localStorage.setItem(
                "theme",
                "dark"
            );


            showToast(
                "Dark mode enabled",
                "success"
            );

        } else {

            themeToggle.textContent =
                "🌙";

            localStorage.setItem(
                "theme",
                "light"
            );


            showToast(
                "Light mode enabled",
                "success"
            );

        }


        updateCharts();

    }
);


// ========================================
// TOAST NOTIFICATION
// ========================================

function showToast(
    message,
    type = "success"
) {

    if (!toast) {

        console.error(
            "Toast element was not found."
        );

        return;

    }


    // Clear previous timer

    clearTimeout(toastTimeout);


    // Reset classes

    toast.className =
        "toast";


    // Set message

    toast.textContent =
        message;


    // Add type

    toast.classList.add(type);


    // Force browser reflow
    // This guarantees animation
    void toast.offsetWidth;


    // Show toast

    toast.classList.add("show");


    // Hide after 2.5 seconds

    toastTimeout =
        setTimeout(
            function () {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );

}


// ========================================
// INITIALIZE APPLICATION
// ========================================

applyTheme();

updateDashboard();

displayTransactions();

updateAnalytics();