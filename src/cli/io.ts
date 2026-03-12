import { Effect, Stdio, Stream } from "effect";

const withTrailingNewline = (text: string) =>
  text.endsWith("\n") ? text : `${text}\n`;

const write = (
  text: string,
  sink: (stdio: Stdio.Stdio) => ReturnType<Stdio.Stdio["stdout"]>,
) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio;

    yield* Stream.make(withTrailingNewline(text)).pipe(
      Stream.run(sink(stdio)),
    );
  });

export const writeStdout = (text: string) =>
  write(text, (stdio) => stdio.stdout({ endOnDone: false }));

export const writeStderr = (text: string) =>
  write(text, (stdio) => stdio.stderr({ endOnDone: false }));
