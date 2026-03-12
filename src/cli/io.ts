import { Console } from "effect";

export const writeStdout = (text: string) => Console.log(text);

export const writeStderr = (text: string) => Console.error(text);
