# Frontend Notes

## Runtime

- The frontend runs on the Linux cluster, typically at port `5173`.
- The backend runs on the Linux cluster, typically at port `4000`.
- Local Windows edits in `C:\Users\10553\WebstormProjects` are nearly real-time synced to the Linux cluster.

## Default verification workflow

- Do not start local Windows frontend or backend dev servers by default.
- Prefer Linux-side read-only verification over SSH:
  - frontend: `curl -I http://127.0.0.1:5173`
  - backend: call a real API route such as `curl http://127.0.0.1:4000/api/programs/info`
- Do not use backend `GET /` as the only health signal. `404 Cannot GET /` can be normal for this Express app.

## Local-only commands

- `npm run lint`
- `npm run build`

Use local `npm run dev` only when the user explicitly asks for a local startup workflow.
