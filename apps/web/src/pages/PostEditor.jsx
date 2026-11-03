import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import MarkdownEditor from "../components/MarkdownEditor.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { Button, buttonVariants } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { api } from "../lib/api.js";
import { clearSession, getToken } from "../lib/auth.js";
import { cn } from "../lib/utils.js";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  published: false,
};

function estimateReadingTime(text) {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (!isEditing) return;

    let active = true;

    api
      .getAdminPost(getToken(), id)
      .then((data) => {
        if (!active) return;
        const post = data.post;
        setForm({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || "",
          content: post.content,
          published: post.published,
        });
      })
      .catch((err) => {
        if (err.status === 401) {
          clearSession();
          navigate("/login", { replace: true });
          return;
        }
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEditing, navigate]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      title: form.title,
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      published: form.published,
    };

    if (form.slug.trim()) payload.slug = form.slug.trim();

    try {
      const data = isEditing
        ? await api.updatePost(getToken(), id, payload)
        : await api.createPost(getToken(), payload);

      setSavedAt(new Date());
      if (!isEditing) {
        navigate(`/admin/posts/${data.post.id}/edit`, { replace: true });
      }
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const wordCount = useMemo(() => {
    if (!form.content) return 0;
    return form.content.trim().split(/\s+/).filter(Boolean).length;
  }, [form.content]);

  if (loading) return <p className="muted text-sm text-muted-foreground">Loading post...</p>;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <p className="eyebrow text-xs font-semibold uppercase tracking-wider text-muted-foreground m-0">
            Admin
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            {isEditing ? "Edit post" : "New post"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "link-button gap-1.5 text-xs text-muted-foreground hover:text-foreground")}
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to posts</span>
          </Link>
        </div>
      </div>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      {savedAt && (
        <StatusMessage tone="success">
          Saved at {savedAt.toLocaleTimeString()}
        </StatusMessage>
      )}

      <form className="form grid grid-cols-1 lg:grid-cols-3 gap-6" onSubmit={handleSubmit}>
        {/* Main form column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border-border/80 shadow-xs space-y-5">
            <div className="grid gap-2">
              <label htmlFor="post-title" className="text-xs font-semibold text-foreground">
                Title
              </label>
              <Input
                id="post-title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Milestone 12: Zero-Downtime Blue/Green Deployments"
                required
                className="font-medium text-base"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="post-slug" className="text-xs font-semibold text-foreground">
                  Slug (optional for new posts, auto-generated from title)
                </label>
              </div>
              <Input
                id="post-slug"
                name="slug"
                type="text"
                value={form.slug}
                onChange={handleChange}
                placeholder="milestone-12-zero-downtime"
                className="font-mono text-xs"
              />
              <span className="field-hint text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only.
              </span>
            </div>

            <div className="grid gap-2">
              <label htmlFor="post-excerpt" className="text-xs font-semibold text-foreground">
                Excerpt
              </label>
              <Textarea
                id="post-excerpt"
                name="excerpt"
                rows={3}
                value={form.excerpt}
                onChange={handleChange}
                placeholder="Brief summary shown on post listing cards..."
                className="resize-y"
              />
            </div>
          </Card>

          {/* Content editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="post-content" className="text-xs font-semibold text-foreground">
                Content
              </label>
              <span className="text-xs text-muted-foreground font-mono">
                Markdown supported
              </span>
            </div>

            <MarkdownEditor
              id="post-content"
              name="content"
              value={form.content}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Sidebar settings column */}
        <div className="space-y-6">
          <Card className="p-5 border-border/80 shadow-xs space-y-5 sticky top-20">
            <CardHeader className="p-0 pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold text-foreground">
                Publishing Settings
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 space-y-4">
              {/* Publication toggle */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                <label className="checkbox-label flex items-center gap-2.5 cursor-pointer text-sm font-medium text-foreground select-none">
                  <input
                    type="checkbox"
                    name="published"
                    checked={form.published}
                    onChange={handleChange}
                    className="size-4 rounded accent-primary cursor-pointer"
                  />
                  <span>Published</span>
                </label>
                <p className="text-xs text-muted-foreground m-0">
                  {form.published
                    ? "Visible to all public readers"
                    : "Draft only, visible only to admins"}
                </p>
              </div>

              {/* View published link */}
              {isEditing && form.published && (
                <Link
                  to={`/posts/${form.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye className="size-3.5" />
                  <span>View published post</span>
                  <ExternalLink className="size-3 ml-auto opacity-70" />
                </Link>
              )}

              {/* Stats */}
              <div className="pt-2 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    Words:
                  </span>
                  <span className="font-mono text-foreground font-medium">{wordCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    Reading time:
                  </span>
                  <span className="font-mono text-foreground font-medium">
                    ~{estimateReadingTime(form.content)} min
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-border/60 space-y-2">
                <Button
                  type="submit"
                  className="button w-full h-10 gap-2 font-medium"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : isEditing ? (
                    <>
                      <Save className="size-4" />
                      <span>Save changes</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      <span>Create post</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
