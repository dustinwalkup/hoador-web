"use client";

import { type ReactNode, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  hoaInquirySchema,
  type HoaInquiryFormData,
} from "../schema/hoa-inquiry.schema";
import { US_STATES } from "@/constants/profile";
import { formatPhoneNumber } from "@/lib/utils";
import { useHoaInquiryMutation } from "../hooks/use-hoa-inquiry-mutation";

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const successVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

interface RequestHoadorModalProps {
  trigger: ReactNode;
}

export function RequestHoadorModal({ trigger }: RequestHoadorModalProps) {
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const mutation = useHoaInquiryMutation();

  const form = useForm<HoaInquiryFormData>({
    resolver: zodResolver(hoaInquirySchema),
    mode: "onTouched",
    defaultValues: {
      hoaName: "",
      city: "",
      state: "",
      name: "",
      email: "",
      phone: "",
      hoaContactName: "",
      hoaContactEmail: "",
      hoaContactPhone: "",
    },
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        // Reset after close animation completes
        setTimeout(() => {
          form.reset();
          setShowSuccess(false);
          mutation.reset();
        }, 200);
      }
    },
    [form, mutation],
  );

  const onSubmit = async (data: HoaInquiryFormData) => {
    try {
      await mutation.mutateAsync(data);
      setShowSuccess(true);
    } catch {
      // Error handled by mutation hook via toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger}
      </span>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              variants={successVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center gap-4 py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.2,
                }}
              >
                <CheckCircle2 className="text-primary h-16 w-16" />
              </motion.div>
              <h3 className="text-2xl font-bold">Thank You!</h3>
              <p className="text-muted-foreground max-w-sm">
                We&apos;ve received your request to bring Hoador to your
                community. Our team will be in touch soon!
              </p>
              <Button
                onClick={() => handleOpenChange(false)}
                className="mt-4 rounded-full"
              >
                Close
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Request Hoador for Your Community
                </DialogTitle>
                <DialogDescription>
                  Tell us about your HOA and we&apos;ll work to bring Hoador to
                  your neighborhood.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="mt-4 space-y-4"
                >
                  {/* HOA Info */}
                  <motion.div variants={fieldVariants}>
                    <FormField
                      control={form.control}
                      name="hoaName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HOA Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Sunset Ridge HOA"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    variants={fieldVariants}
                    className="grid grid-cols-2 gap-3"
                  >
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem
                                  key={state.value}
                                  value={state.value}
                                >
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  {/* Your Info */}
                  <motion.div variants={fieldVariants}>
                    <p className="text-muted-foreground mt-2 mb-2 text-xs font-medium tracking-wide uppercase">
                      Your Information
                    </p>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    variants={fieldVariants}
                    className="grid grid-cols-2 gap-3"
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="(optional)"
                              {...field}
                              value={
                                field.value
                                  ? formatPhoneNumber(field.value)
                                  : ""
                              }
                              onChange={(e) => {
                                const digits = e.target.value.replace(
                                  /\D/g,
                                  "",
                                );
                                field.onChange(digits);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  {/* HOA Contact (Optional) */}
                  <motion.div variants={fieldVariants}>
                    <p className="text-muted-foreground mt-2 mb-2 text-xs font-medium tracking-wide uppercase">
                      HOA Contact{" "}
                      <span className="normal-case">(optional)</span>
                    </p>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <FormField
                      control={form.control}
                      name="hoaContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="HOA board member or manager"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    variants={fieldVariants}
                    className="grid grid-cols-2 gap-3"
                  >
                    <FormField
                      control={form.control}
                      name="hoaContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="(optional)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hoaContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="(optional)"
                              {...field}
                              value={
                                field.value
                                  ? formatPhoneNumber(field.value)
                                  : ""
                              }
                              onChange={(e) => {
                                const digits = e.target.value.replace(
                                  /\D/g,
                                  "",
                                );
                                field.onChange(digits);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div variants={fieldVariants} className="pt-2">
                    <Button
                      type="submit"
                      className="w-full rounded-full"
                      size="lg"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Request"
                      )}
                    </Button>
                  </motion.div>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
