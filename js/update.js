import { replSend, replSendRaw } from "./repl.js";
import { Octokit } from "https://cdn.skypack.dev/@octokit/core";

export async function checkForUpdates() {

    let response = await replSendRaw("import device;print(device.VERSION)");

    if (response.includes("no module named 'device'")) {

        replSend("\x03\x02"); // Exit to friendly repl

        return Promise.reject("Could not detect the firmware version. " +
            "You may have to update manually.");
    }

    let currentVersion = response.substring(response.indexOf("v") + 1,
        response.lastIndexOf("\r\n"));

    response = await replSendRaw("print(device.GIT_REPO)");

    if (response.includes("no attribute 'GIT_REPO'")) {

        replSend("\x03\x02"); // Exit to friendly repl

        return Promise.reject("Could not detect the device. Current version is" +
            currentVersion + ". You may have to update manually.");
    }

    let gitRepoLink = response.substring(response.indexOf("https"),
        response.lastIndexOf('\r\n'));

    let owner = gitRepoLink.split('/')[3];
    let repo = gitRepoLink.split('/')[4];

    let latestVersion = await getLatestGitTag(owner, repo);

    if (currentVersion === latestVersion) {
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

    await replSendRaw("del(device)");

    replSend("\x03"); // Send Ctrl-C to clear the prompt
    replSend("\x02"); // Send Ctrl-B to enter friendly mode

    return Promise.resolve(
        "New firmware <a href='" +
        gitRepoLink +
        "/releases/latest' target='_blank'>(" +
        latestVersion +
        ")</a> available. Click <a href='#' " +
        "onclick='startMonocleFirmwareUpdate();return false;'>" +
        "here</a> to update."
    );
}

window.startMonocleFirmwareUpdate = () => {

    replSendRaw("import display");
    replSendRaw("display.text('Updating firmware...',120,180,0xffffff)");
    replSendRaw("display.show()");
    replSendRaw("import update");
    replSendRaw("update.micropython()");
    replSendRaw("print('UPDATE STARTED')");
}

async function getLatestGitTag(owner, repo) {

    const octokit = new Octokit({});

    const latestRelease =
        await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: owner,
            repo: repo
        });

    return latestRelease.data.tag_name;
}