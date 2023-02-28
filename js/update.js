import { replSend, replSendRaw } from "./repl.js";
import { request } from "https://cdn.skypack.dev/@octokit/request";

export async function checkForUpdates() {

    let response = await replSendRaw("import device;print(device.VERSION)");

    if (response.includes("ImportError")) {
        await replSend("\x03\x02"); // Exit to friendly repl
        return Promise.reject("Could not detect the firmware version. " +
            "You may have to update manually.");
    }

    let currentVersion = response.substring(response.indexOf("v"),
        response.lastIndexOf("\r\n"));

    response = await replSendRaw("print(device.GIT_REPO)");

    if (response.includes("no attribute 'GIT_REPO'")) {
        await replSend("\x03\x02"); // Exit to friendly repl
        return Promise.reject("Could not detect the device. Current version is" +
            currentVersion + ". You may have to update manually.");
    }

    await replSendRaw("del(device)");

    let gitRepoLink = response.substring(response.indexOf("https"),
        response.lastIndexOf('\r\n'));

    let owner = gitRepoLink.split('/')[3];
    let repo = gitRepoLink.split('/')[4];

    const getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: owner,
        repo: repo
    });

    let latestVersion = getTag.data.tag_name;

    if (currentVersion === latestVersion) {
        await replSend("\x03\x02"); // Exit to friendly repl
        return Promise.resolve("");
    }

    if (gitRepoLink.includes("monocle")) {
        await replSendRaw(
            "import display;" +
            "display.text('New firmware available',100,180,0xffffff);" +
            "display.show();" +
            "del(display)"
        );
    }

    await replSend("\x03\x02"); // Exit to friendly repl

    return Promise.resolve(
        "New firmware <a href='" +
        gitRepoLink +
        "/releases/latest' target='_blank'>(" +
        latestVersion +
        ")</a> available."
    );
}

export function startFirmwareUpdate() {

    replSendRaw("import display");
    replSendRaw("display.text('Updating firmware...',120,180,0xffffff)");
    replSendRaw("display.show()");
    replSendRaw("import update");
    replSendRaw("update.micropython()");
}