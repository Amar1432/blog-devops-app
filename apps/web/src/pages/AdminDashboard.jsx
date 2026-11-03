import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ExternalLink,
  FileEdit,
  FileText,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import StatusMessage from "../components/StatusMessage.jsx";
import { buttonVariants } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.jsx";
import { api } from "../lib/api.js";
import { clearSession, getToken } from "../lib/auth.js";
import { formatDate } from "../lib/format.js";
import { cn } from "../lib/utils.js";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchFilter, setSearchFilter] = useState("");

  const loadPosts = useCallback(() => {
    setLoading(true);
    setError("");

    api
      .getAdminPosts(getToken())
      .then((data) => setPosts(data.posts))
      .catch((err) => {
        if (err.status === 401) {
          clearSession();
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleDelete(post) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    setDeletingId(post.id);
    setError("");

    try {
      await api.deletePost(getToken(), post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const liveCount = useMemo(() => posts.filter((p) => p.published).length, [posts]);
  const draftsCount = posts.length - liveCount;

  const filteredPosts = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [posts, searchFilter]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-muted-foreground m-0">
            Admin
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Manage posts
          </h1>
        </div>

        <Link
          to="/admin/posts/new"
          className={cn(buttonVariants({ variant: "default" }), "button gap-2 shadow-xs cursor-pointer")}
        >
          <Plus className="size-4" />
          <span>New post</span>
        </Link>
      </div>

      {/* Metric Cards Summary */}
      {!loading && posts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center justify-between border-border/80 shadow-xs">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Articles
              </p>
              <p className="text-2xl font-bold text-foreground">{posts.length}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
              <FileText className="size-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between border-border/80 shadow-xs">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Live on Site
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {liveCount}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between border-border/80 shadow-xs">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unpublished
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {draftsCount}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
          </Card>
        </div>
      )}

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {loading && <p className="muted text-sm text-muted-foreground">Loading posts...</p>}

      {!loading && !error && posts.length === 0 && (
        <StatusMessage tone="info">
          No posts yet. Create your first post to get started.
        </StatusMessage>
      )}

      {/* Table section */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by title or slug..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Showing {filteredPosts.length} of {posts.length}
            </p>
          </div>

          <div className="table-wrapper rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
                  <TableHead className="font-semibold text-foreground py-3.5">Title</TableHead>
                  <TableHead className="font-semibold text-foreground py-3.5 w-[140px]">Status</TableHead>
                  <TableHead className="font-semibold text-foreground py-3.5 w-[180px]">Updated</TableHead>
                  <TableHead className="actions-column font-semibold text-foreground py-3.5 text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow
                    key={post.id}
                    className="border-b border-border/80 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-3.5">
                      <span className="table-title font-medium text-foreground text-sm block">
                        {post.title}
                      </span>
                      <span className="table-slug font-mono text-xs text-muted-foreground mt-0.5 block">
                        /{post.slug}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5">
                      <span
                        className={cn(
                          "badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          post.published
                            ? "badge-live bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "badge-draft bg-secondary text-muted-foreground border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            post.published ? "bg-emerald-500" : "bg-muted-foreground"
                          )}
                        />
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        {formatDate(post.updatedAt)}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 pr-6 text-right">
                      <div className="row-actions inline-flex items-center justify-end gap-1.5">
                        {post.published && (
                          <Link
                            to={`/posts/${post.slug}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                              "link-button h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                            )}
                            title="View published article"
                          >
                            <ExternalLink className="size-3.5" />
                            <span>View</span>
                          </Link>
                        )}

                        <Link
                          to={`/admin/posts/${post.id}/edit`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "link-button h-8 px-2.5 text-xs text-foreground gap-1 shadow-2xs"
                          )}
                          title="Edit article"
                        >
                          <FileEdit className="size-3.5" />
                          <span>Edit</span>
                        </Link>

                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "link-button danger h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                          )}
                          onClick={() => handleDelete(post)}
                          disabled={deletingId === post.id}
                          title="Delete article"
                        >
                          <Trash2 className="size-3.5" />
                          <span>{deletingId === post.id ? "Deleting..." : "Delete"}</span>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
