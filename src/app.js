import { buildAuthorization, getAchievementUnlocks } from "@retroachievements/api";
import { compress, decompress } from "./compression.js";
import { getOption, setOption } from "./options.js";
import * as api from "./api.js";
import "./css/style.css";

function html(literals, ...expr) {
    let string = "";

    for (const [index, literal] of literals.entries()) {
        string += literal;
        if (index in expr) string += expr[index];
    }

    return string;
}

function toast(text) {
    const div = document.createElement("div");
    div.id = "toast";
    div.innerText = text;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

async function getAuthorization() {
    if (!localStorage.getItem("auth")) {
        return await showAuthModal();
    } else {
        const obj = JSON.parse(localStorage.getItem("auth"));
        if ("apikey" in obj) {
            obj.webApiKey = obj.apikey;
            delete obj.apikey;
            localStorage.setItem("auth", JSON.stringify(obj));
        }
        const auth = buildAuthorization(obj);
        auth.toString = function() {
            return `z=${this.username}&y=${this.webApiKey}`;
        }
        return auth;
    }
}

function showAuthModal() {
    let template = document.getElementById("authModalTemplate");
    let modal = template.content.cloneNode(true);
    let button = modal.children[0].querySelector("button");
    document.body.appendChild(modal);

    return new Promise(resolve => {
        button.addEventListener("click", ev => {
            let modal = document.querySelector("div.authModal");
            let auth = {
                username: modal.querySelector("input[name='username']").value,
                webApiKey: modal.querySelector("input[name='apikey']").value,
            };
            if (modal.querySelector("input[name='saveinfo']").checked) {
                localStorage.setItem("auth", JSON.stringify(auth));
            }
            document.body.removeChild(modal);
            resolve(buildAuthorization(auth));
        });
    });
}

document.getElementById("verify").addEventListener("click", async () => {
    const auth = await getAuthorization();

    api.resetBackoff();

    switchToTab("output");
    const output = document.getElementById("output")
    output.innerHTML = html`
        <h1>Gamblers</h1><span class="copy">📋</span>
        <hr /><span class="spinner"></span>
    `;
    output.querySelector("h1 ~ span.copy").addEventListener("click", () => {
        navigator.clipboard.writeText(Array.from(output.querySelectorAll(".user > a")).map(e => e.innerText).join("\n"));
        toast("Full list copied to clipboard");
    });

    const spinner = output.querySelector(".spinner");
    let gamblers = [];

    const achievementElem = document.getElementById("achievements");
    const achievements = Array.from(achievementElem.querySelectorAll("input[type='text']"))
        .map(input => input.value)
        .map(value => Array.from(value.matchAll("https://(?:www.)?retroachievements.org/achievement/([0-9]+)")))
        .flatMap(x => x.map(([_, id]) => id));

    for (const achievement of achievements) {
        const data = await getAchievementUnlocks(auth, {
            achievementId: achievement,
            count: 500,
            offset: 0
        });
        await api.wait();
        let n = data.unlocksCount - 500;
        const unlocks = data.unlocks;
        while (n > 0) {
            const data = await getAchievementUnlocks(auth, {
                achievementId: achievement,
                count: 500,
                offset: unlocks.length,
            });
            await api.wait();
            unlocks.push(...data.unlocks);
            n -= 500;
        }

        if (gamblers.length == 0) {
            gamblers.push(...unlocks.map(u => u.user));
        } else {
            gamblers = gamblers.filter(user => unlocks.map(u => u.user).includes(user));
        }
    }

    for (const user of gamblers) {
        const div = document.createElement("div");
        div.className = "user";
        div.innerHTML = html`
            <a href=${`https://retroachievements.org/user/${user}`}>${user}</a>
            <span class="copy">📋</span>
        `;
        div.querySelector("span.copy").addEventListener("click", () => {
            navigator.clipboard.writeText(user);
            toast("Username copied to clipboard");
        });
        spinner.parentElement.append(div);
    }
    spinner.remove();
});

document.getElementById("clear").addEventListener("click", () => {
    document.getElementById("users").value = "";
    document.getElementById("output").innerHTML = "";
    switchToTab("submission");
});

document.getElementById("resetAuth").addEventListener("click", () => {
    localStorage.removeItem("auth");
});

for (const elem of document.querySelectorAll("#tabs > div")) {
    const target = elem.dataset.target;
    elem.addEventListener("mousedown", () => {
        switchToTab(target);
    });
}

function switchToTab(name) {
    document.getElementById(name).style.display = "block";
    for (const elem of document.querySelectorAll(`#content > :not(#${name})`)) {
        elem.style.display = "none";
    }
    for (const elem of document.querySelectorAll("#tabs > div")) {
        elem.classList.remove("selected");
        if (elem.dataset.target == name) {
            elem.classList.add("selected");
        }
    }
}

