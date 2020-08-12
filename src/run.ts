import { CURRENT_VERSION, GITHUB_REPO_NAME } from "./const.ts";

import * as consolex from "./utils/consolex.ts";
import {
  ScriptNotFoundError,
  WorkspaceMissingFileOrCommand,
  WorkspaceFileAndCommandSpecified,
} from "./utils/DenoXErrors.ts";

import { upgradeVersionMessage } from "./lib/upgrade_version.ts";

import { loadDenoWorkspace } from "./parser/deno_workspace.ts";
import { parseDenoOptions } from "./deno_options/parse.ts";
import { CLIArgument } from "./deno_options/build_cli_arguments.ts";
import {
  WorkspaceOptions,
  WorkspaceScript,
  WorkspaceScriptFile,
  WorkspaceScriptCommand,
} from "./interfaces.ts";

async function run(scriptName: string): Promise<void> {
  try {
    const { code } = await _runScript(scriptName);

    await upgradeVersionMessage(CURRENT_VERSION, GITHUB_REPO_NAME);

    Deno.exit(code);
  } catch (e) {
    if (e instanceof Deno.errors.PermissionDenied) {
      consolex.error(`
        Please reinstall denox with the correct permissions
        deno install -Af -n denox https://denopkg.com/BentoumiTech/denox/denox.ts
      `);
    } else {
      consolex.error(e.message);
    }
  }
}

async function _runScript(
  scriptName: string,
): Promise<{ code: number }> {
  const workspace = await loadDenoWorkspace();

  const workspaceScript = workspace.scripts[scriptName];
  const workspaceGlobal = workspace?.globals || {};

  if (workspaceScript === undefined) {
    throw new ScriptNotFoundError(scriptName);
  }

  const env = {};
  const args = Deno.args.slice(2);

  return await _runDenoFileOrCommand(
    { scriptName, workspaceScript, workspaceGlobal, args, env },
  );
}

type DenoRunParams = {
  scriptName: string;
  workspaceScript: WorkspaceScript;
  workspaceGlobal: WorkspaceOptions;
  args: string[];
  env?: { [key: string]: string };
};

async function _runDenoFileOrCommand(
  { scriptName, workspaceScript, workspaceGlobal, args, env }: DenoRunParams,
): Promise<{ code: number }> {
  const workspaceCommand = (workspaceScript as WorkspaceScriptCommand);
  const workspaceFile = (workspaceScript as WorkspaceScriptFile);
  if (workspaceFile.file && workspaceCommand.command) {
    throw new WorkspaceFileAndCommandSpecified(scriptName);
  } else if (typeof workspaceFile.file !== undefined) {
    return await _runDenoFile({ workspaceFile, workspaceGlobal, args, env });
  } else if (typeof workspaceCommand.command !== undefined) {
    return await _runCommand({ workspaceScript: workspaceCommand, args, env });
  }
  throw new WorkspaceMissingFileOrCommand(scriptName);
}

type DenoRunFileParams = {
  workspaceFile: WorkspaceScriptFile;
  workspaceGlobal: WorkspaceOptions;
  args: string[];
  env?: { [key: string]: string };
};

async function _runDenoFile({
  workspaceFile,
  workspaceGlobal,
  args,
  env,
}: DenoRunFileParams): Promise<{ code: number }> {
  const denoOptions = _getDenoOptions(workspaceFile, workspaceGlobal);
  const process = Deno.run({
    // ToDO: remove '@ts-ignore' (and eslint directive) when vscode_deno is fixed to work with @deno_types; ref: <https://github.com/cacjs/cac/issues/75> , <https://github.com/denoland/vscode_deno/issues/21>
    /* eslint @typescript-eslint/ban-ts-comment: "off" */
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    cmd: [
      "deno",
      "run",
      ...denoOptions,
      workspaceFile.file,
      ...args,
    ],
    env: env,
  });
  const { code } = await process.status();
  return { code };
}

type DenoRunCommandParams = {
  workspaceScript: WorkspaceScriptCommand;
  args: string[];
  env?: { [key: string]: string };
};

async function _runCommand({
  workspaceScript,
  args,
  env,
}: DenoRunCommandParams): Promise<{ code: number }> {
  const process = Deno.run({
    cmd: [
      workspaceScript.command,
      ...args,
    ],
    env: env,
  });
  const { code } = await process.status();
  return { code };
}

// get Env call parse env properties
function _getDenoOptions(
  workspaceFile: WorkspaceScriptFile,
  workspaceGlobal: WorkspaceOptions,
): CLIArgument[] {
  return parseDenoOptions(
    workspaceGlobal,
    workspaceFile,
  );
}

export default run;
