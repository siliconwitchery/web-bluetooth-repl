import { gitInfo } from "./update.js";
import { request } from "https://cdn.skypack.dev/@octokit/request";

export const nordicDfuServiceUuid = 0xfe59;

export async function startNordicDFU() {

    if (!gitInfo.owner || !gitInfo.repo) {
        // TODO
        gitInfo.owner = 'brilliantlabsAR';
        gitInfo.repo = 'monocle-micropython';
    }

    let response = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: gitInfo.owner,
        repo: gitInfo.repo
    });

    let assetId;
    response.data.assets.forEach((item, index) => {
        if (item.content_type === 'application/zip') {
            assetId = item.id;
        }
    });

    response = await request("GET /repos/{owner}/{repo}/releases/assets/{assetId}", {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
        assetId: assetId,
        headers: {
            'Accept': 'application/octet-stream'
        }
    });

    console.log(response.data);
}