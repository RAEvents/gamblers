import { getUserProfile, getGameInfoAndUserProgress, getAchievementUnlocks } from "@retroachievements/api";
import { getOption } from "./options.js";

const sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

const sleepBase = 200;
const maxTries = 5;
let apiFailures = 0;

export async function wait() {
    await sleep(sleepBase * Math.pow(2, apiFailures));
}

export function resetBackoff() {
    apiFailures = 0;
}

function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    switch (getOption("dateFormat")) {
        case 0:
            return `${year}-${month}-${day}`;
        case 1:
            return `${month}/${day}/${year}`;
        case 2:
            return `${day}/${month}/${year}`;
        case 3:
            return `${month}-${day}-${year}`;
        case 4:
            return `${day}-${month}-${year}`;
    }
}

export async function checkGame(auth, username, id, startDate, endDate) {
    let result;
    for (let i = 0;; i++) {
        try {
            result = await getGameInfoAndUserProgress(auth, {
                username,
                gameId: id,
                shouldIncludeHighestAwardMetadata: true,
            });
        } catch (e) {
            apiFailures += 1;
            await wait();
            if (i < maxTries) continue;
        }

        break;
    }

    let status = "failure";
    switch (result.highestAwardKind) {
        case "mastered":
            status = "success mastered";
            break;
        case "beaten-hardcore":
            status = "success";
            break;
        default:
            break;
    }

    const awardDate = new Date(result.highestAwardDate);
    if (awardDate < startDate || awardDate > endDate) {
        status = "failure";
    }

    const timestamp = result.highestAwardDate ? formatDate(awardDate) : "N/A";

    const alt = document.getElementById("altUsername").value;
    if (username != alt && alt.length && status == "failure") {
        const altResult = await checkGame(auth, alt, id, startDate);
        if (altResult.status.includes("success")) {
            altResult.status += " alt";
            return altResult;
        }
    }

    return {
        status,
        title: result.title,
        icon: result.imageIcon,
        timestamp,
    }
}

export async function checkAchievement(auth, username, id, startDate, endDate) {
    let info, game;
    for (let i = 0;; i++) {
        try {
            info = await getAchievementUnlocks(auth, { count: 1, achievementId: id });
            game = await getGameInfoAndUserProgress(auth, {
                username,
                gameId: info.game.id,
                shouldIncludeHighestAwardMetadata: false,
            });
        } catch (e) {
            apiFailures += 1;
            await wait();
            if (i < maxTries) continue;
        }

        break;
    }

    const achievement = game.achievements[info.achievement.id];
    const unlocked = achievement.dateEarnedHardcore != "";
    const unlockedDate = unlocked ? new Date(achievement.dateEarnedHardcore) : new Date(0);

    const result = {
        status: unlocked && (unlockedDate >= startDate && unlockedDate <= endDate) ? "success" : "failure",
        timestamp: unlocked ? formatDate(unlockedDate) : "N/A",
        title: info.achievement.title,
        icon: `/Badge/${achievement.badgeName}.png`,
    }

    if (result.status == "failure") {
        const alt = document.getElementById("altUsername").value;
        if (alt.length && alt != username) {
            const altResult = await checkAchievement(auth, alt, id, startDate, endDate);
            if (altResult.status == "success") {
                altResult.status += " alt";
                return altResult;
            }
        }
    }

    return result;
}

export async function checkUser(auth, username) {
    try {
        const profile = await getUserProfile(auth, { username });
        return { untracked: profile.untracked, username, userPic: profile.userPic };
    } catch (e) {
        if (e.message.includes("404")) {
            return { untracked: true, username, userPic: `/UserPic/${username}.png` };
        }
    }
}
