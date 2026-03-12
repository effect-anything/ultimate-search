import { BunRuntime } from "@effect/platform-bun";
import { cliProgram } from "./cli/program.ts";

BunRuntime.runMain(cliProgram);
