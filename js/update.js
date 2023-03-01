import { replSend, replRawMode, replRawFlush, replResetConsole } from "./repl.js";
import { request } from "https://cdn.skypack.dev/@octokit/request";

export async function checkForUpdates() {

    let response;

    let currentVersion;
    let latestVersion;
    let gitRepoLink;

    try {
        // Flush the repl
        // await replSend('\x03');

        replResetConsole();
        await replRawMode(true);

        response = await replSend("import device;print(device.VERSION)");
        if (response.includes("ImportError")) {
            throw ("Could not detect the firmware version. " +
                "You may have to update manually.");
        }
        currentVersion = response.substring(response.indexOf("v"),
            response.lastIndexOf("\r\n"));

        response = await replSend("print(device.GIT_REPO);del(device)");
        if (response.includes("no attribute 'GIT_REPO'")) {
            throw ("Could not detect the device. Current version is" +
                currentVersion + ". You may have to update manually.");
        }
        gitRepoLink = response.substring(response.indexOf("https"),
            response.lastIndexOf('\r\n'));

        let owner = gitRepoLink.split('/')[3];
        let repo = gitRepoLink.split('/')[4];
        const getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
            owner: owner,
            repo: repo
        });
        latestVersion = getTag.data.tag_name;
    }
    catch (error) {
        return Promise.reject(error);
    }
    finally {
        await replRawMode(false);
    }

    if (currentVersion === latestVersion) {
        return Promise.resolve("");
    }

    if (gitRepoLink.includes("monocle")) {
        await replSend(
            "import display;" +
            "display.text('New firmware available',100,180,0xffffff);" +
            "display.show();" +
            "del(display)"
        );
    }

    return Promise.resolve(
        "New firmware <a href='" +
        gitRepoLink +
        "/releases/latest' target='_blank'>(" +
        latestVersion +
        ")</a> available."
    );
}

export async function startFirmwareUpdate() {

    await replRawMode(true);
    await replSend("import display;" +
        "display.text('Updating firmware...',120,180,0xffffff);" +
        "display.show();" +
        "import update;" +
        "update.micropython()");
    await replRawMode(false);
}

// TODO
export async function startFPGAUpdate() {
    await replRawMode(true);
    await replSend('import update;update.fpga()');
    await replRawMode(false);
}