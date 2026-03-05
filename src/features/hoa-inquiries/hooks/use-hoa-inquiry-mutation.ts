import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { HoaInquiryFormData } from "../schema/hoa-inquiry.schema";

export function useHoaInquiryMutation() {
  return useCreateMutation<{ success: boolean }, HoaInquiryFormData>({
    mutationFn: async (data: HoaInquiryFormData) => {
      const response = await fetch("/api/hoa-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      return response.json();
    },
    successMessage: "Your request has been submitted!",
  });
}
