import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Search,
  Sparkles,
  Terminal,
  X,
  Layers,
  Cpu,
} from "lucide-react";
import StatusMessage from "../components/StatusMessage.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card } from "../components/ui/card.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";

function getReadingTime(content = "") {
  if (!content) return 3;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

const CATEGORIES = [
  { id: "all", label: "All Posts" },
  { id: "containers", label: "Docker & Compose", query: "docker" },
  { id: "ci-cd", label: "CI/CD & GHCR", query: "ci" },
  { id: "production", label: "Production & VPS", query: "production" },
  { id: "deployments", label: "Coolify & CD", query: "coolify" },
];

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    let active = true;

    api
      .getPublishedPosts()
      .then((data) => {
        if (active) setPosts(data.posts);
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
  }, []);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        post.title.toLowerCase().includes(query) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(query)) ||
        post.slug.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (activeCategory === "all") return true;
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      if (!cat || !cat.query) return true;

      const catQuery = cat.query.toLowerCase();
      return (
        post.title.toLowerCase().includes(catQuery) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(catQuery)) ||
        post.slug.toLowerCase().includes(catQuery)
      );
    });
  }, [posts, searchQuery, activeCategory]);

  return (
    <div className="space-y-10">
      {/* Hero section */}
      <section className="hero relative overflow-hidden rounded-2xl border border-border/80 bg-card p-8 sm:p-10 shadow-xs">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 size-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/60 text-xs font-mono text-muted-foreground mb-4">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <Terminal className="size-3.5 text-primary" />
            <span className="eyebrow mt-2.5 text-[11px] font-semibold text-foreground tracking-normal uppercase">
              Notes from the journey
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15] mb-3">
            Learning DevOps in public.
          </h1>

          <p className="lede text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mb-6">
            Short, practical write-ups about shipping, operating and
            understanding software.
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/50">
              <Layers className="size-3 text-primary" />
              Docker Compose
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/50">
              <Sparkles className="size-3 text-amber-500" />
              GHCR &amp; Actions
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/50">
              <Cpu className="size-3 text-emerald-500" />
              Coolify PaaS
            </span>
          </div>
        </div>
      </section>

      {/* Main content list */}
      <section aria-labelledby="posts-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <h2
              id="posts-heading"
              className="section-title text-base font-semibold tracking-tight text-foreground m-0"
            >
              Latest posts
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!loading &&
                `${filteredPosts.length} ${filteredPosts.length === 1 ? "article" : "articles"} published`}
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts..."
              aria-label="Search posts"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category filters */}
        {posts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <p className="muted text-sm text-muted-foreground">
              Loading posts...
            </p>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/4" />
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && <StatusMessage tone="error">{error}</StatusMessage>}

        {/* Empty states */}
        {!loading && !error && posts.length === 0 && (
          <StatusMessage tone="info">
            No posts have been published yet. Check back soon.
          </StatusMessage>
        )}

        {!loading &&
          !error &&
          posts.length > 0 &&
          filteredPosts.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-xl p-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No posts matched your search for &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                className="text-xs font-semibold text-primary underline underline-offset-4"
              >
                Reset search &amp; filters
              </button>
            </div>
          )}

        {/* Post cards list */}
        <div className="post-list grid gap-4">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="post-card group rounded-xl border border-border bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="post-meta m-0 text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                  <CalendarDays
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>
                    {formatDate(post.publishedAt || post.createdAt)}
                    {post.author?.name ? ` · ${post.author.name}` : ""}
                  </span>
                </p>
                <Badge
                  variant="secondary"
                  className="text-[11px] font-normal text-muted-foreground gap-1"
                >
                  <Clock3 className="size-3" aria-hidden="true" />
                  {getReadingTime(post.content || post.excerpt)} min read
                </Badge>
              </div>

              <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 text-foreground group-hover:text-primary transition-colors">
                <Link to={`/posts/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h3>

              {post.excerpt && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
              )}

              <div className="pt-2 flex items-center justify-between">
                <Link
                  to={`/posts/${post.slug}`}
                  className="read-more inline-flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors"
                >
                  <span>Read post</span>
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
