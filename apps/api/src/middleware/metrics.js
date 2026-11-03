import {
  httpActiveRequests,
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from "../lib/metrics.js";

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  httpActiveRequests.inc();

  res.on("finish", () => {
    httpActiveRequests.dec();
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    let route = "unmatched";
    if (req.route?.path) {
      if (req.route.path === "/") {
        route = req.baseUrl || "/";
      } else {
        route = `${req.baseUrl || ""}${req.route.path}`;
      }
    } else if (res.statusCode === 404) {
      route = "not_found";
    }

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationInSeconds);
  });

  next();
}
