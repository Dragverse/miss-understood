import { z } from "zod";

/**
 * Schema for creating a stream
 */
export const createStreamSchema = z.object({
  name: z
    .string()
    .min(1, "Stream name is required")
    .max(100, "Stream name must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      "Stream name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),
});

/**
 * Schema for requesting an upload URL
 */
export const uploadRequestSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name must be less than 255 characters"),
});

/**
 * Schema for creating a video
 */
export const createVideoSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  thumbnail: z.string().url("Invalid thumbnail URL").optional(),
  livepeerAssetId: z.string().min(1, "Livepeer asset ID is required"),
  playbackId: z.string().optional(),
  playbackUrl: z.string().url("Invalid playback URL").optional(),
  duration: z.number().positive("Duration must be positive").optional(),
  contentType: z.enum(["short", "long", "podcast", "music", "live"], {
    message: "Content type must be one of: short, long, podcast, music, live",
  }),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).max(10, "Maximum 10 tags allowed").optional(),
});

/**
 * Schema for crypto tips
 */
export const cryptoTipSchema = z.object({
  fromDID: z
    .string()
    .regex(/^did:/, "Invalid DID format")
    .optional(),
  toDID: z.string().regex(/^did:/, "Invalid DID format"),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.enum(["ETH", "USDC"], {
    message: "Currency must be ETH or USDC",
  }),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format"),
  videoId: z.string().optional(),
  message: z
    .string()
    .max(500, "Message must be less than 500 characters")
    .optional(),
});

/**
 * Validate request body against a schema
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Zod 4 uses 'issues' instead of 'errors'
    const errors = result.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}

export type CreateStreamInput = z.infer<typeof createStreamSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type CryptoTipInput = z.infer<typeof cryptoTipSchema>;
