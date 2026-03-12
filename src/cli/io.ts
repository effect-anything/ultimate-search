import { Console } from "effect";

export const writeStdout = (text: string) => Console.log(text);
