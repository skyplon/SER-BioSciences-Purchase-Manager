import { Loader2, CheckCircle2, XCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiProgressStepsProps {
  title: string;
  steps: string[];
  currentStep: number;
  done: boolean;
  error: boolean;
  doneLabel: string;
  errorLabel: string;
}

export function AiProgressSteps({
  title,
  steps,
  currentStep,
  done,
  error,
  doneLabel,
  errorLabel,
}: AiProgressStepsProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 pt-3 pb-4 transition-colors duration-500",
        done
          ? "border-green-200 bg-green-50/70 dark:border-green-800 dark:bg-green-950/20"
          : error
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/20 bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        ) : error ? (
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
        ) : (
          <Bot className="h-4 w-4 text-primary flex-shrink-0" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            done
              ? "text-green-700 dark:text-green-400"
              : error
              ? "text-destructive"
              : "text-primary"
          )}
        >
          {done ? doneLabel : error ? errorLabel : title}
        </span>
        {!done && !error && (
          <Loader2 className="h-3.5 w-3.5 text-primary/60 animate-spin ml-auto flex-shrink-0" />
        )}
      </div>

      {/* Step track */}
      {!error && (
        <div className="flex items-start">
          {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = done || stepNum < currentStep;
            const isActive = !done && stepNum === currentStep;
            const isLast = idx === steps.length - 1;

            return (
              <div key={idx} className="flex items-center flex-1 min-w-0">
                {/* Node + label */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="flex items-center justify-center w-6 h-6">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
                    ) : isActive ? (
                      <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border bg-background" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] leading-tight text-center w-[68px]",
                      isCompleted
                        ? "text-green-600 dark:text-green-400"
                        : isActive
                        ? "text-primary font-medium"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {label}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "flex-1 h-px mx-1 mb-5 transition-colors duration-700",
                      isCompleted || done
                        ? "bg-green-400 dark:bg-green-700"
                        : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
