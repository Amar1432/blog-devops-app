# API Reference

Base URL for local development: `http://localhost:4000/api`

All requests and responses use JSON. Send `Content-Type: application/json` for requests with a body.

## Authentication

Administrative endpoints require a JWT sent as a Bearer token:

```
Authorization: Bearer <token>
```

Obtain a token from `POST /auth/login`. Tokens expire according to `JWT_EXPIRES_IN` (default `1d`).

## Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { "...": "optional context" }
  }
}
```

| Status | When                                                             |
| ------ | ---------------------------------------------------------------- |
| 200    | Successful read/update                                            |
| 201    | Resource created                                                  |
| 204    | Resource deleted (empty body)                                     |
| 400    | Malformed JSON                                                    |
| 401    | Missing, invalid or expired token; bad login credentials          |
| 404    | Unknown route or resource                                         |
| 409    | Unique constraint conflict (for example, duplicate explicit slug) |
| 422    | Zod validation failure                                            |
| 500    | Unexpected server error                                           |
| 503    | Health check cannot reach the database                            |

---

## Health

### `GET /health`

Public. Checks API process and database connectivity.

**200**

```json
{
  "status": "ok",
  "database": "up",
  "uptime": 42,
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

**503**

```json
{
  "status": "error",
  "database": "down",
  "uptime": 42,
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

---

## Auth

### `POST /auth/login`

Public.

```json
{
  "email": "admin@example.com",
  "password": "change-me-please"
}
```

**200**

```json
{
  "token": "<jwt>",
  "user": { "id": "cuid", "email": "admin@example.com", "name": "Site Admin" }
}
```

**401** — invalid email or password (deliberately ambiguous).

### `GET /auth/me`

Requires JWT.

**200**

```json
{ "user": { "id": "cuid", "email": "admin@example.com", "name": "Site Admin" } }
```

---

## Public posts

### `GET /posts`

Public. Returns published posts only, newest published first. Does not include full content.

**200**

```json
{
  "posts": [
    {
      "id": "cuid",
      "title": "Hello DevOps",
      "slug": "hello-devops",
      "excerpt": "A short summary",
      "published": true,
      "publishedAt": "2026-01-01T12:00:00.000Z",
      "createdAt": "2026-01-01T12:00:00.000Z",
      "updatedAt": "2026-01-01T12:00:00.000Z",
      "author": { "id": "cuid", "name": "Site Admin" }
    }
  ]
}
```

### `GET /posts/:slug`

Public. Returns one published post including `content`.

**200**

```json
{ "post": { "id": "cuid", "title": "Hello DevOps", "slug": "hello-devops", "excerpt": "...", "content": "...", "published": true, "publishedAt": "...", "createdAt": "...", "updatedAt": "...", "author": { "id": "cuid", "name": "Site Admin" } } }
```

**404** — missing or unpublished.

### `POST /posts`

Requires JWT. Creates a post owned by the authenticated user.

```json
{
  "title": "Hello DevOps",
  "slug": "hello-devops",
  "excerpt": "Optional summary",
  "content": "Post body",
  "published": true
}
```

| Field       | Type    | Required | Rules                                                |
| ----------- | ------- | -------- | ---------------------------------------------------- |
| `title`     | string  | yes      | 1–200 characters                                      |
| `slug`      | string  | no       | Lowercase alphanumeric segments joined by hyphens     |
| `excerpt`   | string  | no       | Up to 500 characters; `null` allowed                  |
| `content`   | string  | yes      | Non-empty                                             |
| `published` | boolean | no       | Defaults to `false`                                   |

If `slug` is omitted, one is generated from the title. Generated duplicates become `slug-2`, `slug-3`, etc. An explicitly supplied duplicate slug returns **409**.

**201** — `{ "post": { ... } }` including `content`.

### `PUT /posts/:id`

Requires JWT. Partial update — send only the fields to change.

```json
{ "title": "Updated title", "published": true }
```

Rules match creation. Changing the title does **not** change an existing slug; send `slug` explicitly to change it. Drafts that have never been published receive `publishedAt` when first published. Unpublishing keeps the existing `publishedAt`.

**200** — `{ "post": { ... } }`

**404** — unknown id.

### `DELETE /posts/:id`

Requires JWT.

**204** — empty body.

**404** — unknown id.

---

## Admin posts

Both routes require JWT and include drafts.

### `GET /admin/posts`

Returns all posts ordered by `updatedAt` descending (no `content`).

**200** — `{ "posts": [ ... ] }`

### `GET /admin/posts/:id`

Returns any post by id, including `content`.

**200** — `{ "post": { ... } }`

**404** — unknown id.

---

## Quick cURL flow

```bash
BASE=http://localhost:4000/api

TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-please"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

ID=$(curl -s -X POST $BASE/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello DevOps","content":"First post","published":true}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).post.id))")

curl -s $BASE/posts
curl -s $BASE/posts/hello-devops
curl -s -X DELETE $BASE/posts/$ID -H "Authorization: Bearer $TOKEN"
```

## Data model (public shape)

```text
User   id, email, name, createdAt, updatedAt        (passwordHash never returned)
Post   id, title, slug, excerpt, content, published, publishedAt,
       createdAt, updatedAt, author { id, name }
```
