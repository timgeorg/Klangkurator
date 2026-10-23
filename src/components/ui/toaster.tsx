import type { ReactNode } from "react";

import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

interface ToasterProps {
  /**
   * Extra toasts inside this provider. They must live here: Radix portals
   * every `<Toast>` into the nearest provider's viewport, so a controlled
   * toast rendered outside would have nowhere to appear (issue #46).
   */
  children?: ReactNode;
}

export function Toaster({ children }: ToasterProps) {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}
