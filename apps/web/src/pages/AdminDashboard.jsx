import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatusMessage from "../components/StatusMessage.jsx";
import { api } from "../lib/api.js";
import { clearSession, getToken } from "../lib/auth.js";
import { formatDate } from "../lib/format.js";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

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

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Manage posts</h1>
        </div>
        <Link to="/admin/posts/new" className="button">
          New post
        </Link>
      </div>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {loading && <p className="muted">Loading posts...</p>}

      {!loading && !error && posts.length === 0 && (
        <StatusMessage tone="info">
          No posts yet. Create your first post to get started.
        </StatusMessage>
      )}

      {posts.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <span className="table-title">{post.title}</span>
                    <span className="table-slug">/{post.slug}</span>
                  </td>
                  <td>
                    <span className={`badge ${post.published ? "badge-live" : "badge-draft"}`}>
                      {post.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>{formatDate(post.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      {post.published && (
                        <Link to={`/posts/${post.slug}`} className="link-button">
                          View
                        </Link>
                      )}
                      <Link to={`/admin/posts/${post.id}/edit`} className="link-button">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="link-button danger"
                        onClick={() => handleDelete(post)}
                        disabled={deletingId === post.id}
                      >
                        {deletingId === post.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
