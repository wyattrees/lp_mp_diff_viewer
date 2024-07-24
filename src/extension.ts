// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const cp = require("child_process");

const got = require('got');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const TARGET_REMOTE = "lp-diff-target"
const SOURCE_REMOTE = "lp-diff-src"

type MergeProposal = {
	target_branch: string;
	source_branch: string;
	source_repo: string;
	target_repo: string;
}

const openInDiffEditor = (leftFilePath: string, rightFilePath: string, title: string) => {
	const leftUri = vscode.Uri.file(leftFilePath);
	const rightUri = vscode.Uri.file(rightFilePath);
	vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
};


function get_diff(lp_username: string, mp: MergeProposal): string[] {
	cp.execSync("git remote add " + TARGET_REMOTE + " git+ssh://" + lp_username + "@git.launchpad.net/" + mp.target_repo + " && git remote update " + TARGET_REMOTE);
	cp.execSync("git remote add " + SOURCE_REMOTE + " git+ssh://" + lp_username + "@git.launchpad.net/" + mp.source_repo + " && git remote update " + SOURCE_REMOTE);
	cp.execSync("git checkout " + SOURCE_REMOTE + "/" + mp.source_branch);
	var files: string[] = cp.execSync("git diff " + TARGET_REMOTE + "/" + mp.target_branch + " --name-only").split("\n");
	cp.execSync("git diff " + TARGET_REMOTE + "/" + mp.target_branch + " > diff.patch");
	return files
}


function make_tmp_files_and_patch(files: string[]): void {
	files.forEach(f => {
		cp.execSync("cp " + f + " " + f + ".orig");
	});
	cp.execSync("git apply diff.patch");
}

function cleanup(lp_username: string, mp: MergeProposal, files: string[]): void {
	files.forEach(f => {
		cp.execSync("rm " + f + ".orig")
	})

}

async function get_repository_urls(lp_mp_url: string): Promise<MergeProposal> {
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

const diff_lp = async (): Promise<void> => {
	const lp_username = await vscode.window.showInputBox({ placeHolder: "Enter your Launchpad username" })
	const lp_url = await vscode.window.showInputBox({ placeHolder: "URL for LP Merge Proposal" });
	if (lp_username == undefined || lp_url == undefined) {
		return;
	}
	var mp: MergeProposal;
	mp = await get_repository_urls(lp_url);
	console.log(mp)
	var files_changed: string[] = get_diff(lp_username, mp);
	console.log(files_changed)
	make_tmp_files_and_patch(files_changed);
	openInDiffEditor(files_changed[0], files_changed[0] + ".orig", "test");
	// cleanup(lp_username, mp, files_changed);
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "lp-diff" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('lp-diff.lpDiff', diff_lp);

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
