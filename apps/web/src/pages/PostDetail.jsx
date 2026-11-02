import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusMessage from "../components/StatusMessage.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";

export default function PostDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) return <p className="muted">Loading post...</p>;
  if (error) {
    return (
      <div>
        <StatusMessage tone="error">{error}</StatusMessage>
        <p>
          <Link to="/">Back to all posts</Link>
        </p>
      </div>
    );
  }
  if (!post) return null;

  return (
    <article className="article">
      <p className="eyebrow">
        {formatDate(post.publishedAt || post.createdAt)}
        {post.author?.name ? ` · ${post.author.name}` : ""}
      </p>
      <h1>{post.title}</h1>
      {post.excerpt && <p className="lede">{post.excerpt}</p>}
      <div className="article-body">{post.content}</div>
      <p className="back-link">
        <Link to="/">Back to all posts</Link>
      </p>
    </article>
  );
}
