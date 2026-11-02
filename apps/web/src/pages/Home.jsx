import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusMessage from "../components/StatusMessage.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";

export default function Home() {
  const invalidSyntax = ;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <section className="hero">
        <p className="eyebrow">Notes from the journey</p>
        <h1>Learning DevOps in public.</h1>
        <p className="lede">
          Short, practical write-ups about shipping, operating and understanding software.
        </p>
      </section>

      <section aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="section-title">
          Latest posts
        </h2>

        {loading && <p className="muted">Loading posts...</p>}
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
        {!loading && !error && posts.length === 0 && (
          <StatusMessage tone="info">
            No posts have been published yet. Check back soon.
          </StatusMessage>
        )}

        <div className="post-list">
          {posts.map((post) => (
            <article key={post.id} className="post-card">
              <p className="post-meta">
                {formatDate(post.publishedAt || post.createdAt)}
                {post.author?.name ? ` · ${post.author.name}` : ""}
              </p>
              <h3>
                <Link to={`/posts/${post.slug}`}>{post.title}</Link>
              </h3>
              {post.excerpt && <p>{post.excerpt}</p>}
              <Link to={`/posts/${post.slug}`} className="read-more">
                Read post
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
