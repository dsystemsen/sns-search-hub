# デプロイ手順 (Render)

React(フロント) + Django(API) + PostgreSQL を Render に Blueprint (`render.yaml`) で一括デプロイします。

## 構成 (MVP)
- **yt-analytics-api** … Django REST API (gunicorn)
- **yt-analytics-db** … PostgreSQL (マネージド)
- **yt-analytics-web** … React/Vite 静的サイト
- Celery/Redis は不使用 (同期実行)。裏処理を本格運用するときに Redis + Worker を追加。

---

## 手順

### 1. GitHub にリポジトリを作成して push
ローカルは Git 初期化＋初回コミット済みです。GitHub で空のリポジトリ (例: `yt-analytics`) を作り、表示される URL を使って:

```powershell
cd "C:\Users\spha3\OneDrive\デスクトップ\管理\00_D-SYSTEMS-EN\23_youtube検索サイト\00_SNS分析サイト\analytics"
git remote add origin https://github.com/<あなた>/<リポジトリ>.git
git branch -M main
git push -u origin main
```

### 2. Render で Blueprint を作成
1. https://dashboard.render.com → **New +** → **Blueprint**
2. 上記 GitHub リポジトリを接続 → `render.yaml` が自動検出される → **Apply**
3. API・DB・静的サイトの3つが作成されます (初回ビルドが走ります)

### 3. 環境変数を設定 (Render ダッシュボード)
`sync: false` の項目は手動入力が必要です。

**yt-analytics-api** サービス → Environment:
| キー | 値 (例) |
|---|---|
| `APP_BASE_URL` | `https://yt-analytics-web.onrender.com` (フロントのURL) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 のキー |
| `ANTHROPIC_API_KEY` | (AI機能を使う場合) |
| `STRIPE_SECRET_KEY` | (決済を使う場合) |
| `STRIPE_WEBHOOK_SECRET` | (決済を使う場合) |

**yt-analytics-web** サービス → Environment:
| キー | 値 |
|---|---|
| `VITE_API_BASE_URL` | `https://yt-analytics-api.onrender.com/api` (APIのURL + `/api`) |

※ `VITE_API_BASE_URL` を変更したら、フロントは **Manual Deploy → Clear build cache & deploy** で再ビルドしてください (ビルド時に値が埋め込まれるため)。

### 4. 動作確認
- API: `https://yt-analytics-api.onrender.com/admin/` が開けるか
- フロント: `https://yt-analytics-web.onrender.com/` で新規登録→ログイン

### 5. 管理者ユーザー作成 (任意)
API サービスの **Shell** タブから:
```
python manage.py createsuperuser
```

---

## 本番運用での推奨 (成長時)
- **プラン**: API=Starter / DB=Basic 以上へ (free DB は約30日で失効、free web はスリープあり)
- **独自ドメイン**: 各サービスに割当 → `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` / `CORS_ALLOWED_ORIGINS` に追加
- **裏処理 (Celery)**: Render に Key Value(Redis) と Background Worker を追加し、API の `CELERY_TASK_ALWAYS_EAGER=False`、`REDIS_URL` を設定。Worker の start: `celery -A config worker -l info` / 定期実行は `celery -A config beat -l info`
- **メール**: `EMAIL_*` を SMTP 設定に (現状は console バックエンド)

## ローカル開発
変更なし。バックエンドは SQLite のまま動きます。
```
# API
cd backend; .\.venv\Scripts\python.exe manage.py runserver 8001
# フロント (別ウィンドウ)
cd frontend; npm run dev
```
