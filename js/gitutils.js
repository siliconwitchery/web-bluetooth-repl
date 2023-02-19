import { Octokit } from "https://cdn.skypack.dev/@octokit/core";

export async function getLatestGitTag(owner, repo) {

    const octokit = new Octokit({});

    const latestRelease =
        await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: owner,
            repo: repo
        });

    return latestRelease.data.tag_name;
}