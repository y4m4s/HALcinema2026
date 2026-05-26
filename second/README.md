# HAL Cinema Second

React/Vite frontend and Gin backend scaffold for migrating the static mock in `../mock`.

## Structure

- `frontend/` - React + TypeScript + Vite
- `backend/` - Go + Gin API server

## Development

Run the backend:

```powershell
cd backend
go run ./cmd/server
```

Run the frontend in another terminal:

```powershell
cd frontend
npm.cmd run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to the Gin server on `http://localhost:8080`.

## Verification

```powershell
cd backend
go test ./...

cd ../frontend
npm.cmd run build
```
