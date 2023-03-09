import { reportUpdatePercentage } from "./main.js"
import { replSend, replRawMode } from "./repl.js";
import { request } from "https://cdn.skypack.dev/@octokit/request";

export let micropythonGit = {};
export let fpgaGit = {};

export async function checkForUpdates() {

    await replRawMode(true);

    // Short delay to throw away bluetooth data received upon connection
    await new Promise(r => setTimeout(r, 100));

    let response = await replSend("import device;print(device.VERSION)");
    if (response.includes("Error")) {
        await replRawMode(false);
        return Promise.reject("Could not detect the firmware version. " +
            "You may have to update manually. " +
            "Try typing: <b>import update;update.micropython()</b>");
    }
    let currentVersion = response.substring(response.indexOf("v"),
        response.lastIndexOf("\r\n"));

    response = await replSend("print(device.GIT_REPO);del(device)");
    if (response.includes("Error")) {
        await replRawMode(false);
        return Promise.reject("Could not detect the device. Current version is: " +
            currentVersion + ". You may have to update manually. " +
            "Try typing: <b>import update;update.micropython()</b>");
    }
    let gitRepoLink = response.substring(response.indexOf("https"),
        response.lastIndexOf('\r\n'));

    micropythonGit.owner = gitRepoLink.split('/')[3];
    micropythonGit.repo = gitRepoLink.split('/')[4];
    const getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: micropythonGit.owner,
        repo: micropythonGit.repo
    });
    let latestVersion = getTag.data.tag_name;

    if (currentVersion === latestVersion) {
        await replRawMode(false);
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

    await replRawMode(false);
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
export async function startFpgaUpdate() {

    let file = await obtainFpgaFile();

    // Convert to base64 string
    let bytes = new Uint8Array(file);
    let len = bytes.byteLength;
    let binary = '';
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let asciiFile = btoa(binary);

    console.log("Total: " + asciiFile.length);

    await replRawMode(true);

    await replSend('import ubinascii;import storage');
    await replSend('storage.delete("FPGA_BITSTREAM")');

    let chunks = Math.ceil(asciiFile.length / 256);
    for (let chk = 0; chk < chunks; chk++) {
        await replSend('storage.append("FPGA_BITSTREAM",ubinascii.a2b_base64("' +
            asciiFile.slice(chk * 256, (chk * 256) + 256)
            + '"))');

        reportUpdatePercentage(Math.round((100 / asciiFile.length) * chk * 256));
    }

    await replRawMode(false);
}

async function obtainFpgaFile() {

    if (!fpgaGit.owner || !fpgaGit.repo) {
        // TODO
        fpgaGit.owner = 'brilliantlabsAR';
        fpgaGit.repo = 'monocle-fpga';
    }

    console.log("Downloading latest release from: github.com/" +
        fpgaGit.owner + "/" + fpgaGit.repo);

    let response = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: fpgaGit.owner,
        repo: fpgaGit.repo
    });

    let assetId;
    response.data.assets.forEach((item, index) => {
        if (item.content_type === 'application/macbinary') {
            assetId = item.id;
        }
    });

    response = await request("GET /repos/{owner}/{repo}/releases/assets/{assetId}", {
        owner: fpgaGit.owner,
        repo: fpgaGit.repo,
        assetId: assetId
    });

    // Annoyingly we have to fetch the data via a cors proxy
    let download = await fetch('https://api.brilliant.xyz/firmware?url=' + response.data.browser_download_url);
    let blob = await download.blob();
    let bin = await blob.arrayBuffer();

    return bin;
}