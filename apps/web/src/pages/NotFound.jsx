import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="narrow">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <p>
        <Link to="/">Back to all posts</Link>
      </p>
    </div>
  );
}
