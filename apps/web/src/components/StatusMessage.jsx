export default function StatusMessage({ tone = "info", children }) {
  return <div className={`status status-${tone}`}>{children}</div>;
}
