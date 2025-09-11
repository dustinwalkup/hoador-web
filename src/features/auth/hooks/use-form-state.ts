"use client";

import { useState, useCallback, useMemo } from "react";
import { z } from "zod";

/**
 * Generic form state management hook
 * Provides form data management, validation, and error handling
 */
export function useFormState<T extends Record<string, unknown>>(
  initialData: T,
  schema?: z.ZodSchema<T>,
) {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Update form data
   */
  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear error for this field when user starts typing
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors],
  );

  /**
   * Update multiple fields at once
   */
  const updateFields = useCallback(
    (updates: Partial<T>) => {
      setFormData((prev) => ({ ...prev, ...updates }));

      // Clear errors for updated fields
      const clearedErrors = { ...errors };
      Object.keys(updates).forEach((key) => {
        delete clearedErrors[key as keyof T];
      });
      setErrors(clearedErrors);
    },
    [errors],
  );

  /**
   * Mark field as touched
   */
  const touchField = useCallback(<K extends keyof T>(field: K) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  /**
   * Mark multiple fields as touched
   */
  const touchFields = useCallback((fields: (keyof T)[]) => {
    setTouched((prev) => {
      const newTouched = { ...prev };
      fields.forEach((field) => {
        newTouched[field] = true;
      });
      return newTouched;
    });
  }, []);

  /**
   * Set field error
   */
  const setFieldError = useCallback(
    <K extends keyof T>(field: K, error: string) => {
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [],
  );

  /**
   * Set multiple field errors
   */
  const setFieldErrors = useCallback(
    (errors: Partial<Record<keyof T, string>>) => {
      setErrors((prev) => ({ ...prev, ...errors }));
    },
    [],
  );

  /**
   * Clear field error
   */
  const clearFieldError = useCallback(<K extends keyof T>(field: K) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Validate form data with schema
   */
  const validate = useCallback(() => {
    if (!schema) return { isValid: true, errors: {} };

    try {
      schema.parse(formData);
      setErrors({});
      return { isValid: true, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof T, string>> = {};

        error.issues.forEach((err) => {
          const field = err.path[0] as keyof T;
          if (field) {
            fieldErrors[field] = err.message;
          }
        });

        setErrors(fieldErrors);
        return { isValid: false, errors: fieldErrors };
      }

      return { isValid: false, errors: {} };
    }
  }, [formData, schema]);

  /**
   * Validate specific field
   */
  const validateField = useCallback(
    <K extends keyof T>(field: K) => {
      if (!schema) return { isValid: true, error: undefined };

      try {
        // Validate the entire form and extract field-specific error
        schema.parse(formData);
        clearFieldError(field);
        return { isValid: true, error: undefined };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.issues.find((err) => err.path[0] === field);
          if (fieldError) {
            const errorMessage = fieldError.message;
            setFieldError(field, errorMessage);
            return { isValid: false, error: errorMessage };
          }
        }

        return { isValid: false, error: "Validation error" };
      }
    },
    [formData, schema, clearFieldError, setFieldError],
  );

  /**
   * Reset form to initial data
   */
  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialData]);

  /**
   * Set submitting state
   */
  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmitting(submitting);
  }, []);

  /**
   * Check if form has errors
   */
  const hasErrors = useMemo(() => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    if (!schema) return true;

    try {
      schema.parse(formData);
      return true;
    } catch {
      return false;
    }
  }, [formData, schema]);

  /**
   * Check if form has been modified
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  /**
   * Get field error (only if touched)
   */
  const getFieldError = useCallback(
    <K extends keyof T>(field: K) => {
      return touched[field] ? errors[field] : undefined;
    },
    [errors, touched],
  );

  /**
   * Check if field has error
   */
  const hasFieldError = useCallback(
    <K extends keyof T>(field: K) => {
      return !!(touched[field] && errors[field]);
    },
    [errors, touched],
  );

  return {
    // Form data
    formData,
    setFormData,

    // Field updates
    updateField,
    updateFields,

    // Touch state
    touched,
    touchField,
    touchFields,

    // Errors
    errors,
    setFieldError,
    setFieldErrors,
    clearFieldError,
    clearErrors,
    getFieldError,
    hasFieldError,

    // Validation
    validate,
    validateField,

    // State
    isSubmitting,
    setSubmitting,
    hasErrors,
    isValid,
    isDirty,

    // Actions
    reset,
  };
}

/**
 * Hook for managing multi-step form state
 * Extends useFormState with step management
 */
export function useMultiStepForm<T extends Record<string, unknown>>(
  initialData: T,
  steps: string[],
  schema?: z.ZodSchema<T>,
) {
  const formState = useFormState(initialData, schema);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  /**
   * Go to next step
   */
  const nextStep = useCallback(() => {
    if (!isLastStep) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [isLastStep]);

  /**
   * Go to previous step
   */
  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isFirstStep]);

  /**
   * Go to specific step
   */
  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < steps.length) {
        setCurrentStepIndex(stepIndex);
      }
    },
    [steps.length],
  );

  /**
   * Reset form and go to first step
   */
  const reset = useCallback(() => {
    formState.reset();
    setCurrentStepIndex(0);
  }, [formState]);

  return {
    ...formState,

    // Step management
    currentStep,
    currentStepIndex,
    steps,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
    goToStep,

    // Override reset to include step reset
    reset,
  };
}

/**
 * Hook for managing form submission with loading states
 */
export function useFormSubmission<T extends Record<string, unknown>>(
  formState: ReturnType<typeof useFormState<T>>,
  onSubmit: (data: T) => Promise<{ success: boolean; error?: string }>,
) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Validate form
      const validation = formState.validate();
      if (!validation.isValid) {
        formState.touchFields(Object.keys(formState.formData) as (keyof T)[]);
        return;
      }

      // Clear previous errors
      setSubmitError(null);
      formState.setSubmitting(true);

      try {
        const result = await onSubmit(formState.formData);

        if (result.success) {
          formState.clearErrors();
          setSubmitError(null);
        } else {
          setSubmitError(result.error || "Submission failed");
        }
      } catch (error) {
        console.error("Form submission error:", error);
        setSubmitError(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        );
      } finally {
        formState.setSubmitting(false);
      }
    },
    [formState, onSubmit],
  );

  return {
    handleSubmit,
    submitError,
    setSubmitError,
    clearSubmitError: () => setSubmitError(null),
  };
}
