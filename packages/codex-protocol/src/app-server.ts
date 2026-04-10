import { z } from "zod";
import { ProtocolValidationError } from "./errors.js";
import {
  CollaborationModeSchema,
  ThreadConversationStateSchema,
  ThreadTurnSchema,
  TurnItemSchema
} from "./thread.js";
import {
  APP_SERVER_CLIENT_NOTIFICATION_METHODS,
  APP_SERVER_CLIENT_REQUEST_METHODS,
  APP_SERVER_SERVER_NOTIFICATION_METHODS,
  APP_SERVER_SERVER_REQUEST_METHODS,
  type AppServerClientNotificationMethod,
  type AppServerClientRequestMethod,
  type AppServerServerNotificationMethod,
  type AppServerServerRequestMethod,
  CollaborationModeListResponseSchema as GeneratedCollaborationModeListResponseSchema,
  ExperimentalServerRequestSchema as GeneratedExperimentalServerRequestSchema,
  GetAccountRateLimitsResponseSchema as GeneratedGetAccountRateLimitsResponseSchema,
  ModelListResponseSchema as GeneratedModelListResponseSchema,
  StableServerRequestSchema as GeneratedStableServerRequestSchema,
  ThreadListResponseSchema as GeneratedThreadListResponseSchema,
  ThreadReadResponseSchema as GeneratedThreadReadResponseSchema,
  ThreadStartParamsSchema as GeneratedThreadStartParamsSchema
} from "./generated/app-server/index.js";

const AppServerThreadListResponseBaseSchema = GeneratedThreadListResponseSchema.passthrough();
const AppServerThreadReadResponseBaseSchema = GeneratedThreadReadResponseSchema.passthrough();
const AppServerModelListResponseBaseSchema = GeneratedModelListResponseSchema.passthrough();
const AppServerCollaborationModeListResponseBaseSchema =
  GeneratedCollaborationModeListResponseSchema.passthrough();
const AppServerGetAccountRateLimitsResponseBaseSchema =
  GeneratedGetAccountRateLimitsResponseSchema.passthrough();
const AppServerStartThreadRequestBaseSchema = GeneratedThreadStartParamsSchema.passthrough();
const AppServerServerRequestBaseSchema = z.union([
  GeneratedStableServerRequestSchema,
  GeneratedExperimentalServerRequestSchema
]);

const ThreadTitleSchema = z.union([z.string(), z.null()]).optional();
const ThreadIsGeneratingSchema = z.boolean().optional();

const AppServerGeneratedThreadListItemSchema = AppServerThreadListResponseBaseSchema.shape.data.element.extend({
  title: ThreadTitleSchema,
  isGenerating: ThreadIsGeneratingSchema
});

const OpenCodeThreadListItemSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    title: ThreadTitleSchema,
    isGenerating: ThreadIsGeneratingSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    source: z.literal("opencode")
  })
  .passthrough();

export const AppServerThreadListItemSchema = z.union([
  AppServerGeneratedThreadListItemSchema,
  OpenCodeThreadListItemSchema
]);

export const AppServerListThreadsResponseSchema = z
  .object({
    data: z.array(AppServerThreadListItemSchema),
    nextCursor: z.union([z.string(), z.null()]).optional(),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional()
  })
  .passthrough();

export const AppServerReadThreadResponseSchema: z.ZodObject<
  {
    thread: typeof ThreadConversationStateSchema;
  },
  "passthrough"
> = z
  .object({
    thread: ThreadConversationStateSchema
  })
  .passthrough();

export const AppServerModelSchema = AppServerModelListResponseBaseSchema.shape.data.element;

export const AppServerModelReasoningEffortSchema =
  AppServerModelSchema.shape.supportedReasoningEfforts.element;

export const AppServerListModelsResponseSchema = AppServerModelListResponseBaseSchema;

export const AppServerCollaborationModeListItemSchema =
  AppServerCollaborationModeListResponseBaseSchema.shape.data.element;

export const AppServerCollaborationModeListResponseSchema =
  AppServerCollaborationModeListResponseBaseSchema;

export const AppServerStartThreadRequestSchema = AppServerStartThreadRequestBaseSchema;

export const AppServerStartThreadResponseSchema = z
  .object({
    thread: AppServerThreadListItemSchema,
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    cwd: z.string().optional(),
    approvalPolicy: z.string().optional(),
    sandbox: z.any().optional(),
    reasoningEffort: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const AppServerServerRequestSchema = AppServerServerRequestBaseSchema;

export const AppServerGetAccountRateLimitsResponseSchema =
  AppServerGetAccountRateLimitsResponseBaseSchema;

export const AppServerLoadedThreadListResponseSchema = z
  .object({
    data: z.array(z.string().min(1)),
    nextCursor: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const AppServerSetModeRequestSchema = z
  .object({
    conversationId: z.string().min(1),
    collaborationMode: CollaborationModeSchema
  })
  .passthrough();

const AppServerNotificationTurnPlanStepSchema = z
  .object({
    step: z.string(),
    status: z.string().min(1)
  })
  .strict();

const AppServerNotificationTokenUsageBreakdownSchema = z
  .object({
    cachedInputTokens: z.number().int(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    reasoningOutputTokens: z.number().int(),
    totalTokens: z.number().int()
  })
  .strict();

const AppServerNotificationThreadTokenUsageSchema = z
  .object({
    last: AppServerNotificationTokenUsageBreakdownSchema,
    total: AppServerNotificationTokenUsageBreakdownSchema,
    modelContextWindow: z.union([z.number().int(), z.null()]).optional()
  })
  .strict();

const AppServerThreadStartedNotificationParamsSchema = z
  .object({
    thread: ThreadConversationStateSchema
  })
  .strict();

const AppServerThreadNameUpdatedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    threadName: z.union([z.string(), z.null()]).optional()
  })
  .strict();

const AppServerThreadTokenUsageUpdatedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    tokenUsage: AppServerNotificationThreadTokenUsageSchema
  })
  .strict();

const AppServerTurnStartedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turn: ThreadTurnSchema
  })
  .strict();

const AppServerTurnCompletedNotificationParamsSchema =
  AppServerTurnStartedNotificationParamsSchema;

const AppServerTurnDiffUpdatedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    diff: z.string()
  })
  .strict();

const AppServerTurnPlanUpdatedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    explanation: z.union([z.string(), z.null()]).optional(),
    plan: z.array(AppServerNotificationTurnPlanStepSchema)
  })
  .strict();

const AppServerItemStartedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    item: TurnItemSchema
  })
  .strict();

const AppServerItemCompletedNotificationParamsSchema =
  AppServerItemStartedNotificationParamsSchema;

const AppServerItemAgentMessageDeltaNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    delta: z.string()
  })
  .strict();

const AppServerItemCommandExecutionOutputDeltaNotificationParamsSchema =
  AppServerItemAgentMessageDeltaNotificationParamsSchema;

const AppServerItemFileChangeOutputDeltaNotificationParamsSchema =
  AppServerItemAgentMessageDeltaNotificationParamsSchema;

const AppServerItemPlanDeltaNotificationParamsSchema =
  AppServerItemAgentMessageDeltaNotificationParamsSchema;

const AppServerItemReasoningSummaryPartAddedNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    summaryIndex: z.number().int()
  })
  .strict();

const AppServerItemReasoningSummaryTextDeltaNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    summaryIndex: z.number().int(),
    delta: z.string()
  })
  .strict();

const AppServerItemReasoningTextDeltaNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    contentIndex: z.number().int(),
    delta: z.string()
  })
  .strict();

const AppServerItemMcpToolCallProgressNotificationParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    message: z.string()
  })
  .strict();

export type AppServerSupportedServerNotification =
  | {
      method: "thread/started";
      params: z.infer<typeof AppServerThreadStartedNotificationParamsSchema>;
    }
  | {
      method: "thread/name/updated";
      params: z.infer<typeof AppServerThreadNameUpdatedNotificationParamsSchema>;
    }
  | {
      method: "thread/tokenUsage/updated";
      params: z.infer<
        typeof AppServerThreadTokenUsageUpdatedNotificationParamsSchema
      >;
    }
  | {
      method: "turn/started";
      params: z.infer<typeof AppServerTurnStartedNotificationParamsSchema>;
    }
  | {
      method: "turn/completed";
      params: z.infer<typeof AppServerTurnCompletedNotificationParamsSchema>;
    }
  | {
      method: "turn/diff/updated";
      params: z.infer<typeof AppServerTurnDiffUpdatedNotificationParamsSchema>;
    }
  | {
      method: "turn/plan/updated";
      params: z.infer<typeof AppServerTurnPlanUpdatedNotificationParamsSchema>;
    }
  | {
      method: "item/started";
      params: z.infer<typeof AppServerItemStartedNotificationParamsSchema>;
    }
  | {
      method: "item/completed";
      params: z.infer<typeof AppServerItemCompletedNotificationParamsSchema>;
    }
  | {
      method: "item/agentMessage/delta";
      params: z.infer<
        typeof AppServerItemAgentMessageDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/commandExecution/outputDelta";
      params: z.infer<
        typeof AppServerItemCommandExecutionOutputDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/fileChange/outputDelta";
      params: z.infer<
        typeof AppServerItemFileChangeOutputDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/plan/delta";
      params: z.infer<typeof AppServerItemPlanDeltaNotificationParamsSchema>;
    }
  | {
      method: "item/reasoning/summaryPartAdded";
      params: z.infer<
        typeof AppServerItemReasoningSummaryPartAddedNotificationParamsSchema
      >;
    }
  | {
      method: "item/reasoning/summaryTextDelta";
      params: z.infer<
        typeof AppServerItemReasoningSummaryTextDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/reasoning/textDelta";
      params: z.infer<typeof AppServerItemReasoningTextDeltaNotificationParamsSchema>;
    }
  | {
      method: "item/mcpToolCall/progress";
      params: z.infer<
        typeof AppServerItemMcpToolCallProgressNotificationParamsSchema
      >;
    };

type AppServerSupportedServerNotificationInput =
  | {
      method: "thread/started";
      params: z.input<typeof AppServerThreadStartedNotificationParamsSchema>;
    }
  | {
      method: "thread/name/updated";
      params: z.input<typeof AppServerThreadNameUpdatedNotificationParamsSchema>;
    }
  | {
      method: "thread/tokenUsage/updated";
      params: z.input<
        typeof AppServerThreadTokenUsageUpdatedNotificationParamsSchema
      >;
    }
  | {
      method: "turn/started";
      params: z.input<typeof AppServerTurnStartedNotificationParamsSchema>;
    }
  | {
      method: "turn/completed";
      params: z.input<typeof AppServerTurnCompletedNotificationParamsSchema>;
    }
  | {
      method: "turn/diff/updated";
      params: z.input<typeof AppServerTurnDiffUpdatedNotificationParamsSchema>;
    }
  | {
      method: "turn/plan/updated";
      params: z.input<typeof AppServerTurnPlanUpdatedNotificationParamsSchema>;
    }
  | {
      method: "item/started";
      params: z.input<typeof AppServerItemStartedNotificationParamsSchema>;
    }
  | {
      method: "item/completed";
      params: z.input<typeof AppServerItemCompletedNotificationParamsSchema>;
    }
  | {
      method: "item/agentMessage/delta";
      params: z.input<
        typeof AppServerItemAgentMessageDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/commandExecution/outputDelta";
      params: z.input<
        typeof AppServerItemCommandExecutionOutputDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/fileChange/outputDelta";
      params: z.input<
        typeof AppServerItemFileChangeOutputDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/plan/delta";
      params: z.input<typeof AppServerItemPlanDeltaNotificationParamsSchema>;
    }
  | {
      method: "item/reasoning/summaryPartAdded";
      params: z.input<
        typeof AppServerItemReasoningSummaryPartAddedNotificationParamsSchema
      >;
    }
  | {
      method: "item/reasoning/summaryTextDelta";
      params: z.input<
        typeof AppServerItemReasoningSummaryTextDeltaNotificationParamsSchema
      >;
    }
  | {
      method: "item/reasoning/textDelta";
      params: z.input<typeof AppServerItemReasoningTextDeltaNotificationParamsSchema>;
    }
  | {
      method: "item/mcpToolCall/progress";
      params: z.input<
        typeof AppServerItemMcpToolCallProgressNotificationParamsSchema
      >;
    };

export const AppServerSupportedServerNotificationSchema: z.ZodType<
  AppServerSupportedServerNotification,
  z.ZodTypeDef,
  AppServerSupportedServerNotificationInput
> =
  z.discriminatedUnion("method", [
    z.object({
      method: z.literal("thread/started"),
      params: AppServerThreadStartedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("thread/name/updated"),
      params: AppServerThreadNameUpdatedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("thread/tokenUsage/updated"),
      params: AppServerThreadTokenUsageUpdatedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("turn/started"),
      params: AppServerTurnStartedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("turn/completed"),
      params: AppServerTurnCompletedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("turn/diff/updated"),
      params: AppServerTurnDiffUpdatedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("turn/plan/updated"),
      params: AppServerTurnPlanUpdatedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/started"),
      params: AppServerItemStartedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/completed"),
      params: AppServerItemCompletedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/agentMessage/delta"),
      params: AppServerItemAgentMessageDeltaNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/commandExecution/outputDelta"),
      params: AppServerItemCommandExecutionOutputDeltaNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/fileChange/outputDelta"),
      params: AppServerItemFileChangeOutputDeltaNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/plan/delta"),
      params: AppServerItemPlanDeltaNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/reasoning/summaryPartAdded"),
      params: AppServerItemReasoningSummaryPartAddedNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/reasoning/summaryTextDelta"),
      params: AppServerItemReasoningSummaryTextDeltaNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/reasoning/textDelta"),
      params: AppServerItemReasoningTextDeltaNotificationParamsSchema
    }).strict(),
    z.object({
      method: z.literal("item/mcpToolCall/progress"),
      params: AppServerItemMcpToolCallProgressNotificationParamsSchema
    }).strict()
  ]);

export type AppServerListThreadsResponse = z.infer<typeof AppServerListThreadsResponseSchema>;
export type AppServerReadThreadResponse = z.infer<typeof AppServerReadThreadResponseSchema>;
export type AppServerListModelsResponse = z.infer<typeof AppServerListModelsResponseSchema>;
export type AppServerServerRequest = z.infer<typeof AppServerServerRequestSchema>;
export type AppServerCollaborationModeListResponse = z.infer<
  typeof AppServerCollaborationModeListResponseSchema
>;
export type AppServerStartThreadResponse = z.infer<typeof AppServerStartThreadResponseSchema>;
export type AppServerLoadedThreadListResponse = z.infer<typeof AppServerLoadedThreadListResponseSchema>;
export type AppServerGetAccountRateLimitsResponse = z.infer<
  typeof AppServerGetAccountRateLimitsResponseSchema
>;
export {
  APP_SERVER_CLIENT_REQUEST_METHODS,
  APP_SERVER_CLIENT_NOTIFICATION_METHODS,
  APP_SERVER_SERVER_REQUEST_METHODS,
  APP_SERVER_SERVER_NOTIFICATION_METHODS
};
export type {
  AppServerClientRequestMethod,
  AppServerClientNotificationMethod,
  AppServerServerRequestMethod,
  AppServerServerNotificationMethod
};

function parseWithSchema<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: z.input<Schema>,
  context: string
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod(context, result.error);
  }
  return result.data;
}

export function parseAppServerListThreadsResponse(
  value: z.input<typeof AppServerListThreadsResponseSchema>
): AppServerListThreadsResponse {
  return parseWithSchema(AppServerListThreadsResponseSchema, value, "AppServerListThreadsResponse");
}

export function parseAppServerReadThreadResponse(
  value: z.input<typeof AppServerThreadReadResponseBaseSchema>
): AppServerReadThreadResponse {
  const parsed = parseWithSchema(
    AppServerThreadReadResponseBaseSchema,
    value,
    "GeneratedAppServerReadThreadResponse"
  );
  return {
    thread: parseWithSchema(
      ThreadConversationStateSchema,
      parsed.thread,
      "AppServerReadThreadResponse.thread"
    )
  };
}

export function parseAppServerListModelsResponse(
  value: z.input<typeof AppServerListModelsResponseSchema>
): AppServerListModelsResponse {
  return parseWithSchema(AppServerListModelsResponseSchema, value, "AppServerListModelsResponse");
}

export function parseAppServerCollaborationModeListResponse(
  value: z.input<typeof AppServerCollaborationModeListResponseSchema>
): AppServerCollaborationModeListResponse {
  return parseWithSchema(
    AppServerCollaborationModeListResponseSchema,
    value,
    "AppServerCollaborationModeListResponse"
  );
}

export function parseAppServerStartThreadResponse(
  value: z.input<typeof AppServerStartThreadResponseSchema>
): AppServerStartThreadResponse {
  return parseWithSchema(AppServerStartThreadResponseSchema, value, "AppServerStartThreadResponse");
}

export function parseAppServerGetAccountRateLimitsResponse(
  value: z.input<typeof AppServerGetAccountRateLimitsResponseSchema>
): AppServerGetAccountRateLimitsResponse {
  return parseWithSchema(
    AppServerGetAccountRateLimitsResponseSchema,
    value,
    "AppServerGetAccountRateLimitsResponse"
  );
}

export function parseAppServerSupportedServerNotification(
  value: z.input<typeof AppServerSupportedServerNotificationSchema>
): AppServerSupportedServerNotification {
  return parseWithSchema(
    AppServerSupportedServerNotificationSchema,
    value,
    "AppServerSupportedServerNotification"
  );
}
