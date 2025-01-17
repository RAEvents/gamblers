export function setOption(key, value) {
    const options = JSON.parse(localStorage.getItem("options"));
    options[key] = value;
    localStorage.setItem("options", JSON.stringify(options));
}

export function getOption(key) {
    return JSON.parse(localStorage.getItem("options"))[key];
}

