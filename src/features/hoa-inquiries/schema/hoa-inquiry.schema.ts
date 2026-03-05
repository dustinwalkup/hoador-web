import { z } from "zod";
import { US_STATES } from "@/constants/profile";

const stateValues = US_STATES.map((s) => s.value);

export const hoaInquirySchema = z.object({
  hoaName: z.string().min(1, "HOA name is required").max(255),
  city: z.string().min(1, "City is required").max(255),
  state: z
    .string()
    .min(1, "State is required")
    .refine(
      (val) => stateValues.includes(val as (typeof stateValues)[number]),
      {
        message: "Please select a valid US state",
      },
    ),
  name: z.string().min(1, "Your name is required").max(255),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  phone: z.string().optional(),
  hoaContactName: z.string().optional(),
  hoaContactEmail: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().email().safeParse(val).success,
      { message: "Please enter a valid email address" },
    ),
  hoaContactPhone: z.string().optional(),
});

export type HoaInquiryFormData = z.infer<typeof hoaInquirySchema>;
