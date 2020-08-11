import { CURRENT_VERSION, GITHUB_REPO_NAME } from "./const.ts";

import * as consolex from "./utils/consolex.ts";
import { ScriptNotFoundError } from "./utils/DenoXErrors.ts";

import { upgradeVersionMessage } from "./lib/upgrade_version.ts";

import { loadDenoWorkspace } from "./parser/deno_workspace.ts";
import { parseDenoOptions } from "./deno_options/parse.ts";
import { CLIArgument } from "./deno_options/build_cli_arguments.ts";
import { WorkspaceOptions, WorkspaceScript, WorkspaceScriptFile } from "./interfaces.ts";

async function run(scriptName: string): Promise<void> {
  try {
    const { code } = await _runScript(scriptName);

    await upgradeVersionMessage(CURRENT_VERSION, GITHUB_REPO_NAME);

    Deno.exit(code);
  } catch (e) {
    if (e instanceof Deno.errors.PermissionDenied) {
      consolex.error(`
        Please reinstall denox with the correct pemissions
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

  return await _runDenoFileOrCommand({ workspaceScript, workspaceGlobal, args, env });
}

type DenoRunParams = {
  workspaceScript: WorkspaceScript;
  workspaceGlobal: WorkspaceOptions;
  args: string[];
  env?: { [key: string]: string };
};

async function _runDenoFileOrCommand({ workspaceScript, workspaceGlobal, args, env }: DenoRunParams): Promise<{ code: number }> {
  workspaceScript as WorkspaceScriptFile
  const command = workspaceScript.command;
  const file = (workspaceScript  as WorkspaceScriptFile).file;
  if (file && command) {
    // throw cannot have file and command specified only one
  } else if(file) {
    return await _runDenoFile({ workspaceScript, workspaceGlobal, args, env });
  } else if(typeof workspaceScript.command !== undefined) {
    return await _runCommand({ workspaceScript.command, args, env });
  }
  // throw error file or command do not exist
}

async function _runDenoFile({
  workspaceScript,
  workspaceGlobal,
  args,
  env
}: DenoRunParams): Promise<{ code: number }> {
  const denoOptions = _getDenoOptions(workspaceScript, workspaceGlobal);
  const process = Deno.run({
    // @ts-ignore
    cmd: [
      "deno",
      "run",
      ...denoOptions,
      workspaceScript.file,
      ...args,
    ],
    env: env,
  });
  const { code } = await process.status();
  return { code };
}

type DenoRunCommandParams = {
  command: string;
  args: string[];
  env?: { [key: string]: string };
};

async function _runCommand({
  command,
  args,
  env
}: DenoRunCommandParams): Promise<{ code: number }> {
  const process = Deno.run({
    cmd: [
      command,
      ...args,
    ],
    env: env,
  });
  const { code } = await process.status();
  return { code };
}

// get Env call parse env properties
function _getDenoOptions(
  workspaceScript: WorkspaceScript,
  workspaceGlobal: WorkspaceOptions,
): CLIArgument[] {
  return parseDenoOptions(
    workspaceGlobal,
    workspaceScript,
  );
}

export default run;
