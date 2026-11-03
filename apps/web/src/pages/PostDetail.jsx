import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Share2,
  Terminal,
  UserRound,
} from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button, buttonVariants } from "../components/ui/button.jsx";
import { Separator } from "../components/ui/separator.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { cn } from "../lib/utils.js";

function getReadingTime(content) {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function getAuthorInitials(name) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function PostSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[760px] space-y-6">
      <span className="sr-only">Loading post...</span>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-12 w-full max-w-[620px]" />
      <Skeleton className="h-6 w-3/4" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton className="size-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Separator className="my-8" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>{message}</AlertTitle>
        <AlertDescription>
          The post may have been unpublished or the link is incorrect.
        </AlertDescription>
      </Alert>
      <Link
        to="/"
        className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer inline-flex items-center gap-2")}
      >
        <ArrowLeft className="size-4" />
        <span>Back to all posts</span>
      </Link>
    </div>
  );
}

export default function PostDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api
      .getPublishedPost(slug)
      .then((data) => {
        if (active) setPost(data.post);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyLink = async () => {
    if (typeof window !== "undefined" && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        // clipboard might fail in restricted environments
      }
    }
  };

  if (loading) return <PostSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!post) return null;

  const publishedAt = post.publishedAt || post.createdAt;
  const authorName = post.author?.name || "DevOps Blog";

  return (
    <>
      {/* Scroll progress bar */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-primary z-50 transition-all duration-75"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin="0"
        aria-valuemax="100"
      />

      <article className="article mx-auto max-w-[760px]">
        {/* Navigation breadcrumbs */}
        <div className="flex items-center justify-between gap-2 mb-6 text-xs text-muted-foreground font-mono">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Posts</span>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Share article link"
          >
            {copiedLink ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="size-3.5" />
                <span>Share</span>
              </>
            )}
          </Button>
        </div>

        {/* Post header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="outline" className="font-mono text-xs gap-1.5 px-2.5 py-0.5">
              <Terminal className="size-3 text-primary" />
              DevOps
            </Badge>

            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
              {formatDate(publishedAt)}
            </span>

            <Badge variant="secondary" className="text-xs text-muted-foreground gap-1 px-2.5 py-0.5">
              <Clock3 className="size-3" aria-hidden="true" />
              {getReadingTime(post.content)} min read
            </Badge>
          </div>

          <h1 className="article-title text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-[1.2]">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="lede text-base sm:text-lg text-muted-foreground leading-relaxed pt-1">
              {post.excerpt}
            </p>
          )}

          {/* Author info card */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 border border-border">
                <AvatarFallback className="font-semibold text-xs bg-muted text-foreground">
                  {getAuthorInitials(authorName) || <UserRound className="size-4" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm leading-tight text-foreground">
                  {authorName}
                </p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  DevOps Blog
                </p>
              </div>
            </div>
          </div>
        </header>

        <Separator className="my-8" />

        {/* Article content */}
        <div className="article-body">
          <MarkdownRenderer content={post.content} />
        </div>

        <Separator className="my-10" />

        {/* Bottom actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-xl border border-border bg-card shadow-xs">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-sm font-semibold text-foreground m-0">
              Enjoyed this write-up?
            </p>
            <p className="text-xs text-muted-foreground m-0">
              Check out more milestones and architecture guides.
            </p>
          </div>

          <Link
            to="/"
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-2 shrink-0")}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Back to all posts</span>
          </Link>
        </div>
      </article>
    </>
  );
}
