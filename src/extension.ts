// VS Code extension for viewing the diff of a Launchpad Merge Proposal
import { error } from 'console';
import * as vscode from 'vscode';
const cp = require("child_process");
const fs = require("fs");
const got = require('got');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const path = require("path");

const TARGET_REMOTE = "lp-diff-target"
const SOURCE_REMOTE = "lp-diff-src"

type MergeProposal = {
	target_branch: string;
	source_branch: string;
	source_repo: string;
	target_repo: string;
}


async function openInDiffEditor(leftFilePath: string, rightFilePath: string, title: string): Promise<void>
/*
Open the two files in a diff editor.
*/ {
	var wd: string = "";
	if (vscode.workspace.workspaceFolders != undefined) {
		wd = vscode.workspace.workspaceFolders[0].uri.fsPath;
	}
	else {
		error("No workspace is open");
		return;
	}
	var left: string = path.join(wd, leftFilePath);
	var right: string = path.join(wd, rightFilePath);
	const leftUri = vscode.Uri.file(left);
	const rightUri = vscode.Uri.file(right);
	return new Promise<void>(function (resolve, reject) {
		vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title).then((res) => {
			resolve();
		})
	});
};


function get_diff(lp_username: string, mp: MergeProposal): string[]
/*
Get a list of files changed in the merge proposal, and generate a patch to apply later
*/ {
	// add the relevant branches
	cp.execSync("git remote add " + TARGET_REMOTE + " git+ssh://" + lp_username + "@git.launchpad.net/" + mp.target_repo + " && git remote update " + TARGET_REMOTE);
	cp.execSync("git remote add " + SOURCE_REMOTE + " git+ssh://" + lp_username + "@git.launchpad.net/" + mp.source_repo + " && git remote update " + SOURCE_REMOTE);
	cp.execSync("git checkout " + SOURCE_REMOTE + "/" + mp.source_branch);

	// retrieve a list of files that changed
	var paths = cp.execSync("git diff " + TARGET_REMOTE + "/" + mp.target_branch + " --name-only").toString().split("\n");
	paths = paths.filter((path: string) => path != "")

	// boo submodules
	var files: string[] = paths.filter((path: string) => !(fs.lstatSync(path).isDirectory()));

	// generate a patch to use later
	cp.execSync("git diff " + TARGET_REMOTE + "/" + mp.target_branch + " > diff.patch");
	return files;
}


function insert_orig(fp: string): string
/*
Prepend "orig_" to the filename
*/ {
	var filename: string = "orig_" + path.basename(fp);
	var dir: string = path.dirname(fp);
	return path.join(dir, filename);
}

function make_tmp_files_and_patch(files: string[], mp: MergeProposal): void
/*
Make temporary files for the diff. Apply the patch.
*/ {
	cp.execSync("git checkout " + TARGET_REMOTE + "/" + mp.target_branch);
	files.forEach(f => {
		// check if this a new file being added
		if (fs.existsSync(f)) {
			cp.execSync("cp " + f + " " + insert_orig(f));
		}
		else {
			// make an empty file
			cp.execSync("touch " + insert_orig(f));
		}
	});
	cp.execSync("git apply diff.patch");
}

function cleanup(lp_username: string, mp: MergeProposal, files: string[]): void
/*
Get rid of files, remotes, etc that were used.
*/ {
	try {
		cp.execSync("git remote remove " + SOURCE_REMOTE);
		cp.execSync("git remote remove " + TARGET_REMOTE);
		cp.execSync("rm diff.patch");
		files.forEach(f => {
			cp.execSync("rm " + insert_orig(f))
		})
	}
	catch {
		console.log("Failed to cleanup");
	}
}

async function get_repository_urls(lp_mp_url: string): Promise<MergeProposal>
/*
Parse the MP webpage for the repositories and branches
*/ {
	return new Promise<MergeProposal>(function (resolve, reject) {
		got(lp_mp_url).then((response: any) => {
			var mp: MergeProposal;
			const dom = new JSDOM(response.body);
			var src: string = dom.window.document.getElementById("summary-row-8-source-branch").cells[1].children[0].innerHTML;
			var target: string = dom.window.document.getElementById("summary-row-9-target-branch").cells[1].children[0].innerHTML;
			var src_splt = src.split(":")
			var target_splt = target.split(":")
			mp = { target_branch: target_splt[1], source_branch: src_splt[1], source_repo: src_splt[0], target_repo: target_splt[0] };
			resolve(mp);
		}).catch((err: any) => {
			reject("Could not get Merge Proposal, err: " + String(err))
		})
	});

}

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

const diff_lp = async (): Promise<void> => {
	// TODO: should probably just parse this from "git remote"
	const lp_username = await vscode.window.showInputBox({ placeHolder: "Enter your Launchpad username" })
	const lp_url = await vscode.window.showInputBox({ placeHolder: "URL for LP Merge Proposal" });
	if (lp_username == undefined || lp_url == undefined) {
		return;
	}
	var mp: MergeProposal;
	mp = await get_repository_urls(lp_url);
	var files_changed: string[] = [];
	try {
		files_changed = get_diff(lp_username, mp);
		make_tmp_files_and_patch(files_changed, mp);

		for (const f of files_changed) {
			await openInDiffEditor(insert_orig(f), f, path.basename(f));

			await sleep(200);
			while (vscode.window.tabGroups.activeTabGroup.tabs.length != 0) {
				await sleep(100);
			}
		}
	}
	finally {
		console.log("Done");
		cleanup(lp_username, mp, files_changed);
	}
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('lp-diff.lpDiff', diff_lp);

	context.subscriptions.push(disposable);
}

export function deactivate() { }
