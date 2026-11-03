import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MarkdownEditor from "../components/MarkdownEditor.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { api } from "../lib/api.js";
import { clearSession, getToken } from "../lib/auth.js";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  published: false,
};

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

  if (loading) return <p className="muted">Loading post...</p>;

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>{isEditing ? "Edit post" : "New post"}</h1>
        </div>
        <Link to="/admin" className="link-button">
          Back to posts
        </Link>
      </div>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {savedAt && (
        <StatusMessage tone="success">Saved at {savedAt.toLocaleTimeString()}.</StatusMessage>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            maxLength={200}
            required
          />
        </label>

        <label>
          Slug
          <input
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="auto-generated-from-title"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Lowercase letters, numbers and single hyphens"
          />
          <span className="field-hint">
            Optional. Leave blank to generate one from the title.
          </span>
        </label>

        <label>
          Excerpt
          <textarea
            name="excerpt"
            value={form.excerpt}
            onChange={handleChange}
            rows={2}
            maxLength={500}
          />
        </label>

        <div className="form-field">
          <label htmlFor="post-content">Content</label>
          <MarkdownEditor
            id="post-content"
            name="content"
            value={form.content}
            onChange={handleChange}
            rows={16}
            required
          />
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            name="published"
            checked={form.published}
            onChange={handleChange}
          />
          Published
        </label>

        <div className="form-actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Save changes" : "Create post"}
          </button>
          {isEditing && form.published && (
            <Link to={`/posts/${form.slug}`} className="link-button">
              View published post
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
