import { once } from "node:events";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { Schema } from "effect";
import PackageJson from "../package.json" with { type: "json" };
import { readOnlyMcpToolNames } from "../src/services/read-only-mcp";
import { afterEach, expect, it } from "vitest";

const expectedSearchTavilyText =
  '{"query":"FastAPI releases","answer":"Mocked Tavily answer","response_time":0.42,"results":[{"title":"FastAPI release notes","url":"https://fastapi.tiangolo.com/release-notes/","content":"Latest FastAPI release notes","score":0.98,"raw_content":null}]}';

const decodeUnknownJson = (text: string): unknown =>
  Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(text);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseNdjson = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const value = decodeUnknownJson(line);

      if (!isRecord(value)) {
        throw new Error("Expected an MCP JSON-RPC object response.");
      }

      return value;
    });

const startMockTavilyServer = async () => {
  const requests: Array<{
    readonly url: string;
    readonly body: unknown;
  }> = [];

  const server = createServer((req, res) => {
    const chunks: Array<Buffer> = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      const url = req.url ?? "";
      const bodyText = Buffer.concat(chunks).toString("utf8");

      requests.push({
        url,
        body: decodeUnknownJson(bodyText),
      });

      if (req.method !== "POST" || url !== "/search") {
        res.writeHead(404, {
          "content-type": "application/json",
        });
        res.end('{"error":"not found"}');
        return;
      }

      res.writeHead(200, {
        "content-type": "application/json",
      });
      res.end(
        JSON.stringify({
          query: "FastAPI releases",
          answer: "Mocked Tavily answer",
          response_time: 0.42,
          results: [
            {
              title: "FastAPI release notes",
              url: "https://fastapi.tiangolo.com/release-notes/",
              content: "Latest FastAPI release notes",
              score: 0.98,
              raw_content: null,
            },
          ],
        }),
      );
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("Mock Tavily server did not expose a TCP port.");
  }

  return {
    requests,
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
};

const runMcpProcess = async (options: {
  readonly requests: ReadonlyArray<unknown>;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly waitForOutput?: ((stdoutText: string) => boolean) | undefined;
}) => {
  const child = spawn("bun", ["run", "./src/cli.ts", "mcp", "stdio"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutText = "";
  let stderrText = "";

  child.stdout.on("data", (chunk) => {
    stdoutText += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  });

  child.stderr.on("data", (chunk) => {
    stderrText += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  });

  for (const request of options.requests) {
    child.stdin.write(`${JSON.stringify(request)}\n`);
  }

  if (options.waitForOutput != null) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for MCP stdout."));
      }, 5_000);

      const check = () => {
        if (!options.waitForOutput?.(stdoutText)) {
          return;
        }

        clearTimeout(timeout);
        child.stdout.off("data", check);
        resolve();
      };

      child.stdout.on("data", check);
      check();
    });
  }

  child.stdin.end();

  const [exitCode] = await once(child, "close");

  return {
    exitCode: exitCode ?? -1,
    stdoutText,
    stderrText,
  };
};

afterEach(async () => {
  // no-op placeholder to keep the file's cleanup flow explicit
});

it("serves initialize, tools/list, representative tool calls, and exits with interrupt code when stdin closes", async () => {
  const mockTavily = await startMockTavilyServer();

  try {
    const result = await runMcpProcess({
      env: {
        TAVILY_API_URL: mockTavily.url,
        TAVILY_API_KEY: "tavily-secret",
      },
      waitForOutput: (stdoutText) => stdoutText.includes('"id":3'),
      requests: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: {
              name: "vitest-client",
              version: "1.0.0",
            },
          },
        },
        {
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "search_tavily",
            arguments: {
              query: "FastAPI releases",
              depth: "advanced",
              maxResults: 3,
              topic: "news",
              timeRange: "week",
              includeAnswer: true,
            },
          },
        },
      ],
    });

    expect(result.exitCode).toBe(130);
    expect(result.stderrText).toBe("");
    expect(mockTavily.requests).toEqual([
      {
        url: "/search",
        body: {
          query: "FastAPI releases",
          search_depth: "advanced",
          max_results: 3,
          topic: "news",
          time_range: "week",
          include_answer: true,
        },
      },
    ]);

    const responses = parseNdjson(result.stdoutText);
    const initialize = responses.find((response) => response["id"] === 1);
    const listTools = responses.find((response) => response["id"] === 2);
    const callTool = responses.find((response) => response["id"] === 3);

    expect(initialize).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: 1,
        result: expect.objectContaining({
          protocolVersion: "2025-06-18",
          serverInfo: {
            name: "ultimate-search",
            version: PackageJson.version,
          },
          capabilities: expect.objectContaining({
            tools: {
              listChanged: true,
            },
          }),
        }),
      }),
    );

    expect(listTools).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: 2,
        result: {
          tools: expect.arrayContaining(
            readOnlyMcpToolNames.map((name) =>
              expect.objectContaining({
                name,
                annotations: expect.objectContaining({
                  readOnlyHint: true,
                  destructiveHint: false,
                  idempotentHint: true,
                }),
              }),
            ),
          ),
        },
      }),
    );

    expect(callTool).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: 3,
        result: {
          isError: false,
          structuredContent: {
            query: "FastAPI releases",
            answer: "Mocked Tavily answer",
            response_time: 0.42,
            results: [
              {
                title: "FastAPI release notes",
                url: "https://fastapi.tiangolo.com/release-notes/",
                content: "Latest FastAPI release notes",
                score: 0.98,
                raw_content: null,
              },
            ],
          },
          content: [
            {
              type: "text",
              text: expectedSearchTavilyText,
            },
          ],
        },
      }),
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      mockTavily.server.close((error) => {
        if (error != null) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

it("returns exit code 130 when stdin closes without any MCP requests", async () => {
  const result = await runMcpProcess({
    requests: [],
  });

  expect(result.exitCode).toBe(130);
  expect(result.stdoutText).toBe("");
  expect(result.stderrText).toBe("");
});
