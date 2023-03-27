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

    let message = await getUpdateInfo();

    await replRawMode(false);

    return message;
}

async function getUpdateInfo() {

    // Check nRF firmware
    let response = await replSend("import device;print(device.VERSION)");
    if (response.includes("Error")) {
        return "Could not detect the firmware version. You may have to update" +
            " manually. Try typing: <b>import update;update.micropython()</b>";
    }
    let currentVersion = response.substring(response.indexOf("v"),
        response.lastIndexOf("\r\n"));

    response = await replSend("print(device.GIT_REPO);del(device)");
    if (response.includes("Error")) {
        return "Could not detect the device. Current version is: " +
            currentVersion + ". You may have to update manually. Try typing: " +
            "<b>import update;update.micropython()</b>";
    }
    let gitRepoLink = response.substring(response.indexOf("https"),
        response.lastIndexOf('\r\n'));

    micropythonGit.owner = gitRepoLink.split('/')[3];
    micropythonGit.repo = gitRepoLink.split('/')[4];
    let getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: micropythonGit.owner,
        repo: micropythonGit.repo
    });
    let latestVersion = getTag.data.tag_name;

    if (currentVersion != latestVersion) {
        return "New firmware <a href='" + gitRepoLink + "/releases/latest' " +
            "target='_blank'>(" + latestVersion + ")</a> available. Click " +
            "<a href='#' onclick='updateFirmware();return false;'>here</a> to update";
    }

    // Check FPGA image
    fpgaGit.owner = micropythonGit.owner;
    fpgaGit.repo = micropythonGit.repo.replace("micropython", "fpga");
    getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: fpgaGit.owner,
        repo: fpgaGit.repo
    });
    latestVersion = getTag.data.tag_name;

    response = await replSend("import fpga;" +
        "print('v'+(lambda:''.join('%02x' % i for i in fpga.read(2,3)))());" +
        "del(fpga)");
    if (response.includes("Error")) {
        return "Could not detect the FPGA image. Click " +
            "<a href='#' onclick='updateFpga();return false;'>here</a> to update";
    }

    if (!response.includes(latestVersion)) {
        return "New FPGA image available. Click " +
            "<a href='#' onclick='updateFpga();return false;'>here</a> to update";
    }

    return "Connected. Device is up to date";
}

export async function startFirmwareUpdate() {

    await replRawMode(true);
    await replSend("import update;update.micropython()");
    await replRawMode(false);
}

let fpga_update_in_progress = false;

export async function startFpgaUpdate(file) {

    if (!isConnected()) {
        return Promise.reject("Connect to Monocle first");
    }

    if (fpga_update_in_progress === true) {
        return Promise.reject("FPGA update already in progress");
    }

    await replRawMode(true).catch((error) => {
        return Promise.reject(error);
    });

    if (file === undefined) {
        file = await downloadLatestFpgaImage();
    }

    fpga_update_in_progress = true;
    await updateFPGA(file);
    fpga_update_in_progress = false;

    await replRawMode(false);
}

async function updateFPGA(file) {

    console.log("Starting FPGA update");
    console.log("Converting " + file.byteLength + " bytes of file to base64");
    let bytes = new Uint8Array(file);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let asciiFile = btoa(binary);

    await replSend('import ubinascii, update, device, bluetooth');

    let response = await replSend('print(bluetooth.max_length())');
    const maxMtu = parseInt(response.match(/\d/g).join(''), 10);

    // 45 is the string length of the update string. Calculates base64 chunk length
    let chunk_size = (Math.floor(Math.floor((maxMtu - 45) / 3) / 4) * 4 * 3);
    let chunks = Math.ceil(asciiFile.length / chunk_size);
    console.log("Chunk size = " + chunk_size + ". Total chunks = " + chunks);

    await replSend('update.Fpga.erase()');
    for (let chk = 0; chk < chunks; chk++) {
        response = await replSend("update.Fpga.write(ubinascii.a2b_base64(b'" +
            asciiFile.slice(chk * chunk_size, (chk * chunk_size) + chunk_size)
            + "'))");

        if (response.includes("Error")) {
            console.log("Retrying this chunk");
            chk--;
        }

        reportUpdatePercentage((100 / asciiFile.length) * chk * chunk_size);
    }

    await replSend("update.Fpga.write(b'done')");
    await replSend('device.reset()');

    console.log("Completed FPGA update. Resetting");
}

async function downloadLatestFpgaImage() {

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