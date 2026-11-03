import { forwardRef } from "react";
import { cn } from "../../lib/utils.js";

const Avatar = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground",
      className
    )}
    {...props}
  />
));
Avatar.displayName = "Avatar";

function AvatarFallback({ className, ...props }) {
  return <span className={cn("uppercase", className)} {...props} />;
}

export { Avatar, AvatarFallback };
