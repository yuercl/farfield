import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import {
  AppServerThreadListItemSchema,
  ThreadConversationStateSchema,
  parseThreadConversationState,
  type ThreadConversationState,
} from "@farfield/protocol";
import { z } from "zod";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
} from "../types.js";

const QwenJsonEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("result"),
      session_id: z.string().min(1),
      result: z.string(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("assistant"),
      session_id: z.string().min(1),
      message: z
        .object({
          content: z.array(
            z
              .object({
                type: z.string(),
                text: z.string().optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("system"),
      session_id: z.string().min(1),
    })
    .passthrough(),
]);

const QwenThreadStoreSchema = z
  .object({
    version: z.literal(1),
    threads: z.array(ThreadConversationStateSchema),
  })
  .strict();

type QwenThreadStore = z.infer<typeof QwenThreadStoreSchema>;

interface RunningQwenProcess {
  child: ChildProcessWithoutNullStreams;
  interrupted: boolean;
}

export interface QwenCodeAgentOptions {
  executablePath: string;
  workspaceDir: string;
  approvalMode?: string;
}

export class QwenCodeAgentAdapter implements AgentAdapter {
  public readonly id = "qwen";
  public readonly label = "Qwen Code";
  public readonly capabilities: AgentCapabilities = {
    canListModels: false,
    canListCollaborationModes: false,
    canSetCollaborationMode: false,
    canSubmitUserInput: false,
    canReadLiveState: false,
    canReadStreamEvents: false,
    canReadRateLimits: false,
  };

  private readonly executablePath: string;
  private readonly workspaceDir: string;
  private readonly approvalMode: string;
  private readonly storePath: string;
  private readonly threadById = new Map<string, ThreadConversationState>();
  private readonly runningProcessByThreadId = new Map<string, RunningQwenProcess>();
  private connected = false;
  private lastError: string | null = null;

  public constructor(options: QwenCodeAgentOptions) {
    this.executablePath = options.executablePath;
    this.workspaceDir = options.workspaceDir;
    this.approvalMode = options.approvalMode ?? "yolo";
    this.storePath = path.join(
      this.workspaceDir,
      ".farfield",
      "qwen-code-threads.json",
    );
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public isEnabled(): boolean {
    return true;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async start(): Promise<void> {
    this.loadStore();
    this.verifyExecutable();
  }

  public async stop(): Promise<void> {
    for (const running of this.runningProcessByThreadId.values()) {
      running.interrupted = true;
      running.child.kill("SIGTERM");
    }
    this.runningProcessByThreadId.clear();
    this.connected = false;
  }

  public async listThreads(
    input: AgentListThreadsInput,
  ): Promise<AgentListThreadsResult> {
    this.ensureConnected();

    const offset = parseCursorOffset(input.cursor);
    const sortedThreads = Array.from(this.threadById.values()).sort(
      compareThreadsByUpdatedAtDescending,
    );
    const page = sortedThreads.slice(offset, offset + input.limit);
    const nextOffset = offset + page.length;
    const nextCursor =
      nextOffset < sortedThreads.length ? String(nextOffset) : null;

    return {
      data: page.map((thread) =>
        AppServerThreadListItemSchema.parse(buildThreadListItem(thread)),
      ),
      nextCursor,
    };
  }

  public async createThread(
    input: AgentCreateThreadInput,
  ): Promise<AgentCreateThreadResult> {
    this.ensureConnected();

    const now = nowSeconds();
    const threadId = randomUUID();
    const thread = parseThreadConversationState({
      id: threadId,
      turns: [],
      requests: [],
      createdAt: now,
      updatedAt: now,
      title: null,
      ...(input.model ? { latestModel: input.model } : {}),
      ...(input.cwd ? { cwd: normalizeDirectoryInput(input.cwd) } : {}),
      source: "qwen",
    });

    this.threadById.set(threadId, thread);
    this.persistStore();

    const threadListItem = AppServerThreadListItemSchema.parse(
      buildThreadListItem(thread),
    );

    return {
      threadId,
      thread: threadListItem,
      ...(thread.cwd ? { cwd: thread.cwd } : {}),
      ...(thread.latestModel ? { model: thread.latestModel } : {}),
    };
  }

  public async readThread(
    input: AgentReadThreadInput,
  ): Promise<AgentReadThreadResult> {
    this.ensureConnected();
    return {
      thread: this.getThread(input.threadId),
    };
  }

  public async sendMessage(input: AgentSendMessageInput): Promise<void> {
    this.ensureConnected();
    if (input.parts.some((part) => part.type === "image")) {
      throw new Error("Qwen Code does not support image messages");
    }
    if (this.runningProcessByThreadId.has(input.threadId)) {
      throw new Error(`Qwen Code thread ${input.threadId} is already running`);
    }

    const thread = this.getThread(input.threadId);
    const text = input.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text.length === 0) {
      throw new Error("Message text is required");
    }

    const cwd = input.cwd
      ? normalizeDirectoryInput(input.cwd)
      : thread.cwd
        ? normalizeDirectoryInput(thread.cwd)
        : this.workspaceDir;
    const startedAtMs = Date.now();
    const turnId = randomUUID();
    const updatedThread = parseThreadConversationState({
      ...thread,
      cwd,
      updatedAt: Math.floor(startedAtMs / 1000),
      title: thread.title ?? summarizeText(text),
      turns: [
        ...thread.turns,
        {
          id: turnId,
          turnId,
          status: "in-progress",
          turnStartedAtMs: startedAtMs,
          items: [
            input.isSteering
              ? {
                  id: randomUUID(),
                  type: "steeringUserMessage",
                  content: input.parts
                    .filter((part) => part.type === "text")
                    .map((part) => ({
                      type: "text" as const,
                      text: part.text,
                    })),
                }
              : {
                  id: randomUUID(),
                  type: "userMessage",
                  content: input.parts
                    .filter((part) => part.type === "text")
                    .map((part) => ({
                      type: "text" as const,
                      text: part.text,
                    })),
                },
          ],
          ...(thread.latestModel
            ? {
                params: {
                  threadId: thread.id,
                  input: input.parts,
                  model: thread.latestModel,
                },
              }
            : { params: { threadId: thread.id, input: input.parts } }),
        },
      ],
      source: "qwen",
    });

    this.threadById.set(thread.id, updatedThread);
    this.persistStore();

    try {
      const output = await this.runQwenCommand({
        threadId: thread.id,
        text,
        cwd,
        model: thread.latestModel ?? null,
        hasPriorTurns: thread.turns.length > 0,
      });
      const completedAtMs = Date.now();
      this.updateThreadTurn(thread.id, turnId, (currentTurn) => ({
        ...currentTurn,
        status: "completed",
        finalAssistantStartedAtMs: completedAtMs,
        items: [
          ...currentTurn.items,
          {
            id: randomUUID(),
            type: "agentMessage",
            text: output.result,
          },
        ],
      }));
      this.updateThreadMetadata(thread.id, {
        updatedAt: Math.floor(completedAtMs / 1000),
        resumeState: output.sessionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAtMs = Date.now();
      this.updateThreadTurn(thread.id, turnId, (currentTurn) => ({
        ...currentTurn,
        status: "failed",
        items: [
          ...currentTurn.items,
          {
            id: randomUUID(),
            type: "error",
            message,
          },
        ],
      }));
      this.updateThreadMetadata(thread.id, {
        updatedAt: Math.floor(failedAtMs / 1000),
      });
      throw error;
    }
  }

  public async interrupt(input: AgentInterruptInput): Promise<void> {
    this.ensureConnected();
    const running = this.runningProcessByThreadId.get(input.threadId) ?? null;
    if (!running) {
      return;
    }
    running.interrupted = true;
    running.child.kill("SIGTERM");
  }

  private verifyExecutable(): void {
    const result = spawnSync(this.executablePath, ["--version"], {
      cwd: this.workspaceDir,
      encoding: "utf8",
    });

    if (result.error) {
      this.connected = false;
      this.lastError = result.error.message;
      throw result.error;
    }

    if (result.status !== 0) {
      this.connected = false;
      this.lastError = result.stderr.trim() || "Qwen Code CLI is unavailable";
      throw new Error(this.lastError);
    }

    this.connected = true;
    this.lastError = null;
  }

  private loadStore(): void {
    const directory = path.dirname(this.storePath);
    fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(this.storePath)) {
      this.persistStore();
      return;
    }

    const raw = fs.readFileSync(this.storePath, "utf8");
    if (raw.trim().length === 0) {
      this.persistStore();
      return;
    }

    const parsed = QwenThreadStoreSchema.parse(JSON.parse(raw));
    this.threadById.clear();
    for (const thread of parsed.threads) {
      this.threadById.set(thread.id, thread);
    }
  }

  private persistStore(): void {
    const store: QwenThreadStore = {
      version: 1,
      threads: Array.from(this.threadById.values()).map((thread) =>
        parseThreadConversationState(thread),
      ),
    };
    fs.writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(this.lastError ?? "Qwen Code CLI is not connected");
    }
  }

  private getThread(threadId: string): ThreadConversationState {
    const thread = this.threadById.get(threadId) ?? null;
    if (!thread) {
      throw new Error(`Qwen Code thread ${threadId} was not found`);
    }
    return thread;
  }

  private updateThreadTurn(
    threadId: string,
    turnId: string,
    update: (
      turn: ThreadConversationState["turns"][number],
    ) => ThreadConversationState["turns"][number],
  ): void {
    const thread = this.getThread(threadId);
    const nextTurns = thread.turns.map((turn) =>
      turn.id === turnId ? update(turn) : turn,
    );
    const nextThread = parseThreadConversationState({
      ...thread,
      turns: nextTurns,
    });
    this.threadById.set(threadId, nextThread);
    this.persistStore();
  }

  private updateThreadMetadata(
    threadId: string,
    input: {
      updatedAt: number;
      resumeState?: string;
    },
  ): void {
    const thread = this.getThread(threadId);
    const nextThread = parseThreadConversationState({
      ...thread,
      updatedAt: input.updatedAt,
      ...(input.resumeState ? { resumeState: input.resumeState } : {}),
    });
    this.threadById.set(threadId, nextThread);
    this.persistStore();
  }

  private async runQwenCommand(input: {
    threadId: string;
    text: string;
    cwd: string;
    model: string | null;
    hasPriorTurns: boolean;
  }): Promise<{ sessionId: string; result: string }> {
    const args = [
      "-p",
      input.text,
      "-o",
      "json",
      "--approval-mode",
      this.approvalMode,
      ...(input.hasPriorTurns
        ? ["--resume", input.threadId]
        : ["--session-id", input.threadId]),
      ...(input.model ? ["--model", input.model] : []),
    ];

    const child = spawn(this.executablePath, args, {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const running: RunningQwenProcess = {
      child,
      interrupted: false,
    };
    this.runningProcessByThreadId.set(input.threadId, running);

    return await new Promise((resolve, reject) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      child.stdin.end();

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdoutChunks.push(chunk);
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderrChunks.push(chunk);
      });

      child.on("error", (error) => {
        this.runningProcessByThreadId.delete(input.threadId);
        this.lastError = error.message;
        reject(error);
      });

      child.on("close", (code, signal) => {
        this.runningProcessByThreadId.delete(input.threadId);

        if (running.interrupted) {
          reject(new Error(`Qwen Code thread ${input.threadId} was interrupted`));
          return;
        }

        if (code !== 0) {
          const stderr = stderrChunks.join("").trim();
          const signalText = signal ? ` (signal ${signal})` : "";
          const message =
            stderr.length > 0
              ? stderr
              : `Qwen Code exited with status ${String(code)}${signalText}`;
          this.lastError = message;
          reject(new Error(message));
          return;
        }

        try {
          const events = z.array(QwenJsonEventSchema).parse(
            JSON.parse(stdoutChunks.join("").trim()),
          );
          const resultEvent =
            [...events].reverse().find((event) => event.type === "result") ??
            null;
          if (!resultEvent) {
            throw new Error("Qwen Code result event was missing");
          }
          this.lastError = null;
          resolve({
            sessionId: resultEvent.session_id,
            result: resultEvent.result,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

function buildThreadListItem(
  thread: ThreadConversationState,
): {
  id: string;
  preview: string;
  title?: string | null;
  isGenerating?: boolean;
  createdAt: number;
  updatedAt: number;
  cwd?: string;
  source: "qwen";
} {
  return {
    id: thread.id,
    preview: buildThreadPreview(thread),
    ...(thread.title !== undefined ? { title: thread.title } : {}),
    isGenerating: isThreadGenerating(thread),
    createdAt: thread.createdAt ?? nowSeconds(),
    updatedAt: thread.updatedAt ?? thread.createdAt ?? nowSeconds(),
    ...(thread.cwd ? { cwd: thread.cwd } : {}),
    source: "qwen",
  };
}

function buildThreadPreview(thread: ThreadConversationState): string {
  const lastTurn = thread.turns[thread.turns.length - 1] ?? null;
  if (!lastTurn) {
    return "New Qwen thread";
  }

  const lastAgentMessage = [...lastTurn.items]
    .reverse()
    .find((item) => item.type === "agentMessage");
  if (lastAgentMessage) {
    return summarizeText(lastAgentMessage.text);
  }

  const lastUserMessage = [...lastTurn.items]
    .reverse()
    .find(
      (item) =>
        item.type === "userMessage" || item.type === "steeringUserMessage",
    );
  if (!lastUserMessage) {
    return "New Qwen thread";
  }

  return summarizeText(
    lastUserMessage.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
  );
}

function isThreadGenerating(thread: ThreadConversationState): boolean {
  const lastTurn = thread.turns[thread.turns.length - 1] ?? null;
  return lastTurn?.status === "in-progress";
}

function summarizeText(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 80) {
    return compact;
  }
  return `${compact.slice(0, 77).trimEnd()}...`;
}

function parseCursorOffset(cursor: string | null): number {
  if (!cursor) {
    return 0;
  }
  const parsed = Number(cursor);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid Qwen cursor: ${cursor}`);
  }
  return parsed;
}

function compareThreadsByUpdatedAtDescending(
  left: ThreadConversationState,
  right: ThreadConversationState,
): number {
  const leftUpdatedAt = left.updatedAt ?? left.createdAt ?? 0;
  const rightUpdatedAt = right.updatedAt ?? right.createdAt ?? 0;
  return rightUpdatedAt - leftUpdatedAt;
}

function normalizeDirectoryInput(value: string): string {
  return path.resolve(value);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
