import { z } from "zod";

export const SignalSchema = z.object({
  from: z.string(),

  to: z.string().optional(),

  type: z.enum([
    "offer",
    "answer",
    "ice",
    "ice-candidate",
    "camera-off",
    "kick",
  ]),

  description: z.any().optional(),
  candidate: z.any().optional(),
  sdp: z.any().optional(),
});

export type SignalMessage = z.infer<typeof SignalSchema>;