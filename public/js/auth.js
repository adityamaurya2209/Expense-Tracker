/* =====================================================
   EXPENSE TRACKER — LOGIN / SIGNUP
===================================================== */

const $ = id =>
    document.getElementById(id);


let mode =
    location.pathname === "/signup"
        ? "signup"
        : "login";


const COPY = {

    login: {
        title: "Welcome back",
        subtitle: "Log in to your account to continue.",
        button: "Log in"
    },

    signup: {
        title: "Create your account",
        subtitle: "Sign up to start tracking your expenses.",
        button: "Create account"
    }

};


function setMode(nextMode) {

    mode = nextMode;

    const signup = mode === "signup";

    $("loginTab").classList.toggle("active", !signup);

    $("signupTab").classList.toggle("active", signup);

    $("nameField").classList.toggle("hidden", !signup);

    $("confirmField").classList.toggle("hidden", !signup);

    $("password").autocomplete =
        signup
            ? "new-password"
            : "current-password";

    $("authTitle").textContent = COPY[mode].title;

    $("authSubtitle").textContent = COPY[mode].subtitle;

    $("authSubmit").textContent = COPY[mode].button;

    $("authError").textContent = "";

    history.replaceState(null, "", `/${mode}`);

}


function validate() {

    const email = $("email").value.trim();

    const password = $("password").value;

    if (mode === "signup" && !$("name").value.trim()) {
        return "Please enter your name.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Please enter a valid email address.";
    }

    if (mode === "signup") {

        if (password.length < 8) {
            return "Password must be at least 8 characters.";
        }

        if (password !== $("confirmPassword").value) {
            return "Passwords do not match.";
        }

    }

    else if (!password) {
        return "Please enter your password.";
    }

    return "";

}


async function handleSubmit(event) {

    event.preventDefault();

    const problem = validate();

    if (problem) {
        $("authError").textContent = problem;
        return;
    }


    const button = $("authSubmit");

    button.disabled = true;

    button.textContent = "Please wait…";

    $("authError").textContent = "";


    try {

        const response = await fetch(`/api/auth/${mode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: $("name").value.trim(),
                email: $("email").value.trim(),
                password: $("password").value
            })
        });

        const result =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error || "Something went wrong. Please try again."
            );
        }

        location.href = "/";

    } catch (error) {

        $("authError").textContent = error.message;

        button.disabled = false;

        button.textContent = COPY[mode].button;

    }

}


try {

    document.body.classList.toggle(
        "dark-mode",
        localStorage.getItem("theme") === "dark"
    );

} catch {
    // Storage unavailable; keep light theme.
}


$("loginTab").addEventListener("click", () => setMode("login"));

$("signupTab").addEventListener("click", () => setMode("signup"));

$("authForm").addEventListener("submit", handleSubmit);

setMode(mode);
