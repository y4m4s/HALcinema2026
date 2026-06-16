# HAL Cinema Second

`../mock` にある静的モックを React/Vite のフロントエンドと Go/Gin のバックエンドへ移行するためのプロジェクトです。

## 構成

- `frontend/` - React + TypeScript + Vite のフロントエンド
- `frontend/src/pages/` - `../mock/*.html` から移行した TSX ページ定義
- `frontend/src/page-scripts/` - `../mock/js/*.js` から移行した TypeScript のページ処理
- `frontend/public/css/` - `../mock/css` から移行したスタイルシート
- `frontend/public/assets/` - `../mock/assets` から移行した画像・フォントなどの静的ファイル
- `backend/` - Go + Gin の API サーバー

## データベースのセットアップ

実DBファイル `second/halcinema_members.sqlite3` は Git 管理対象外（`.gitignore`）です。クローン直後はDBが存在しないため、先に初期化スクリプトを一度実行してください。実行しないとバックエンドが `reservation schema missing` で起動に失敗します。

DBは `db/schema.sql`（テーブル定義）と `db/seed.sql`（初期データ）から再生成します。**Go さえあれば動作し、外部の `sqlite3` CLI は不要**です。

```powershell
# Windows (PowerShell)
./second/db/init.ps1
```

```bash
# macOS / Linux
./second/db/init.sh
```

スクリプトは内部で `go run ./cmd/dbinit` を呼び出し、`schema.sql` → `seed.sql` の順に適用します。`schema.sql` は各テーブルを `DROP TABLE IF EXISTS` してから作り直すため、**何度実行しても安全**です（毎回まっさらな初期データ状態に戻るので、DBをリセットしたいときにも使えます）。

スクリプトを使わず直接実行することもできます。

```powershell
cd second/backend
go run ./cmd/dbinit
```

## 開発

バックエンドは `second/backend` から起動します。

```powershell
cd second/backend
go run ./cmd/server
```

別のターミナルで、フロントエンドを `second/frontend` から起動します。

```powershell
cd second/frontend
npm.cmd run dev
```

フロントエンドは `http://localhost:5173` で起動します。`/api` へのリクエストは `http://localhost:8080` の Gin サーバーへプロキシされます。

主なページは、React のルートとして次の URL から確認できます。

- `http://localhost:5173/`
- `http://localhost:5173/works`
- `http://localhost:5173/schedule`
- `http://localhost:5173/theater`
- `http://localhost:5173/detail?id=1`

`npm.cmd run build` 後は、Gin からビルド済みの React アプリを配信できます。

```powershell
cd second/backend
go run ./cmd/server
```

その後、`http://localhost:8080` を開いて確認します。

## 動作確認

```powershell
cd second/backend
go test ./...

cd ../frontend
npm.cmd run lint
npm.cmd run build
```
