import { buildAuthorization } from "@retroachievements/api";
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

    const users = Array.from(document.getElementById("users").value.split("\n"));
    const untracked = [];

    switchToTab("output");
    output.innerHTML = html`
        <h1>Untracked</h1><hr />
        <div class="progress">
            <span class="spinner"></span>
            <span class="amount"></span>
        </div>
    `;

    const progress = output.querySelector(".progress");
    const amount = output.querySelector(".progress > .amount");

    let i = 0;
    for (const user of users) {
        const result = await api.checkUser(auth, user);
        if (result.untracked) {
            untracked.push(result);
        }
        await api.wait();
        amount.innerText = `${++i} / ${users.length}`;
    }

    if (untracked.length == 0) {
        progress.innerHTML = `No untracked users!`;
        return;
    }

    for (const user of untracked) {
        const div = document.createElement("div");
        div.className = "user";
        div.innerHTML = html`
            <img src=${`https://retroachievements.org${user.userPic}`}></img>
            <a href=${`https://retroachievements.org/user/${user.username}`}>${user.username}</span>
        `;
        progress.parentElement.append(div);
    }
    progress.remove();
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

