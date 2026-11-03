import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { buttonVariants } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { cn } from "../lib/utils.js";

export default function NotFound() {
  return (
    <div className="narrow mx-auto max-w-[480px] py-12 text-center">
      <Card className="border-border/80 shadow-sm p-8 space-y-5">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground mx-auto">
          <FileQuestion className="size-7 text-primary" />
        </div>

        <div>
          <p className="eyebrow text-xs font-semibold text-muted-foreground uppercase tracking-widest justify-center">
            404
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Page not found
          </h1>
          <p className="muted text-sm text-muted-foreground mt-2">
            The page you are looking for does not exist.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: "default" }), "gap-2 shadow-xs cursor-pointer")}
          >
            <ArrowLeft className="size-4" />
            <span>Back to all posts</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
