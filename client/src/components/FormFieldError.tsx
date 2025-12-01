/**
 * Form Field Error Component
 * Provides consistent error display for form fields
 */

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFieldErrorProps {
  error?: string;
  message?: string;
  className?: string;
}

export function FormFieldError({ error, message, className }: FormFieldErrorProps) {
  const displayMessage = message || error;
  if (!displayMessage) return null;

  return (
    <div className={cn("flex items-center gap-1.5 text-sm text-destructive mt-1", className)}>
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{displayMessage}</span>
    </div>
  );
}

