import { z } from "zod";
import { NonEmptyStringSchema, NonNegativeIntSchema } from "./common.js";
import { ProtocolValidationError } from "./errors.js";
import { ThreadStreamStateChangedParamsSchema } from "./thread.js";

export const ClientEventRequestIdSchema = NonEmptyStringSchema;

export const ClientRequestEnvelopeSchema = z
  .object({
    type: z.literal("request"),
    requestId: ClientEventRequestIdSchema,
    method: NonEmptyStringSchema,
    params: z.unknown().optional(),
    targetClientId: NonEmptyStringSchema.optional(),
    sourceClientId: NonEmptyStringSchema.optional(),
    version: NonNegativeIntSchema.optional()
  })
  .passthrough();

export const ClientResponseEnvelopeSchema = z
  .object({
    type: z.literal("response"),
    requestId: ClientEventRequestIdSchema,
    method: NonEmptyStringSchema.optional(),
    handledByClientId: NonEmptyStringSchema.optional(),
    resultType: z.enum(["success", "error"]),
    result: z.unknown().optional(),
    error: z.unknown().optional()
  })
  .passthrough();

export const ClientBroadcastEnvelopeSchema = z
  .object({
    type: z.literal("broadcast"),
    method: NonEmptyStringSchema,
    params: z.unknown().optional(),
    sourceClientId: NonEmptyStringSchema.optional(),
    targetClientId: NonEmptyStringSchema.optional(),
    version: NonNegativeIntSchema.optional()
  })
  .passthrough();

export const ClientDiscoveryRequestEnvelopeSchema = z
  .object({
    type: z.literal("client-discovery-request"),
    requestId: ClientEventRequestIdSchema,
    request: ClientRequestEnvelopeSchema
  })
  .passthrough();

export const ClientDiscoveryResponseEnvelopeSchema = z
  .object({
    type: z.literal("client-discovery-response"),
    requestId: ClientEventRequestIdSchema,
    response: z
      .object({
        canHandle: z.boolean()
      })
      .passthrough()
  })
  .passthrough();

export const ClientEventEnvelopeSchema = z.union([
  ClientRequestEnvelopeSchema,
  ClientResponseEnvelopeSchema,
  ClientBroadcastEnvelopeSchema,
  ClientDiscoveryRequestEnvelopeSchema,
  ClientDiscoveryResponseEnvelopeSchema
]);

export const ThreadStreamEventSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"broadcast">;
    method: z.ZodLiteral<"thread-stream-state-changed">;
    sourceClientId: typeof NonEmptyStringSchema;
    params: typeof ThreadStreamStateChangedParamsSchema;
    version: typeof NonNegativeIntSchema;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("broadcast"),
    method: z.literal("thread-stream-state-changed"),
    sourceClientId: NonEmptyStringSchema,
    params: ThreadStreamStateChangedParamsSchema,
    version: NonNegativeIntSchema
  })
  .passthrough();

export type ClientEventEnvelope = z.infer<typeof ClientEventEnvelopeSchema>;
export type ClientRequestEnvelope = z.infer<typeof ClientRequestEnvelopeSchema>;
export type ClientResponseEnvelope = z.infer<typeof ClientResponseEnvelopeSchema>;
export type ClientBroadcastEnvelope = z.infer<typeof ClientBroadcastEnvelopeSchema>;
export type ClientDiscoveryRequestEnvelope = z.infer<
  typeof ClientDiscoveryRequestEnvelopeSchema
>;
export type ClientDiscoveryResponseEnvelope = z.infer<
  typeof ClientDiscoveryResponseEnvelopeSchema
>;
export type ThreadStreamEvent = z.infer<
  typeof ThreadStreamEventSchema
>;

export function parseClientEventEnvelope(value: unknown): ClientEventEnvelope {
  const result = ClientEventEnvelopeSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ClientEventEnvelope", result.error);
  }
  return result.data;
}

export function parseThreadStreamEvent(
  value: unknown
): ThreadStreamEvent {
  const result = ThreadStreamEventSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ThreadStreamEvent", result.error);
  }
  return result.data;
}
