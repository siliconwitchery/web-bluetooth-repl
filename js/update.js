import { reportUpdatePercentage } from "./main.js"
import { replSend, replRawMode } from "./repl.js";
import { isConnected } from "./bluetooth.js";
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

let fpga_update_in_progress = false;

export async function startFpgaUpdate() {

    if (!isConnected()) {
        return Promise.reject("Connect to Monocle first.");
    }

    if (fpga_update_in_progress === true) {
        return Promise.reject("FPGA update already in progress.");
    }

    fpga_update_in_progress = true;

    console.log("Starting FPGA update");
    let file = await obtainFpgaFile();

    console.log("Converting " + file.byteLength + " bytes of file to base64");
    let bytes = new Uint8Array(file);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let asciiFile = btoa(binary);

    await replRawMode(true);
    await replSend('import ubinascii;import storage;import device');
    await replSend('storage.delete("FPGA_BITSTREAM")');

    let chunk_size = 84;
    let chunks = Math.ceil(asciiFile.length / chunk_size);
    for (let chk = 0; chk < chunks; chk++) {
        let response = await replSend('storage.append("FPGA_BITSTREAM",ubinascii.a2b_base64("' +
            asciiFile.slice(chk * chunk_size, (chk * chunk_size) + chunk_size)
            + '"))');

        if (response.includes("Error")) {
            console.log("Retrying this chunk");
            chk--;
        }

        reportUpdatePercentage((100 / asciiFile.length) * chk * chunk_size);
    }

    await replSend('storage.append("FPGA_BITSTREAM","BITSTREAM_WRITTEN")');
    await replSend('device.reset()');
    await replRawMode(false);

    console.log("Completed FPGA update. Resetting");

    fpga_update_in_progress = false;
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