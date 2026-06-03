# YouTube Analytics SaaS

YouTube特化のSNS分析・運用管理SaaS。コムニコ マーケティングスイートの機能セットをYouTube向けにアレンジし、CSVインポート型で提供する。

## 機能（Phase別）

| Phase | 機能 |
|---|---|
| Phase 0 | プロジェクトひな型（Django+React）|
| Phase 1 (MVP) | ログイン / テナント / 自社チャンネル分析 / CSVインポート / Excelレポート |
| Phase 2 | 競合分析 / リリースカレンダー / コメント管理（CSV） |
| Phase 3 | キーワード分析 / Stripe課金 / 承認フロー / 月次自動メール |
| Phase 4 | YouTube Data API連携（競合・コメント自動取得）✅ |

## YouTube Data API のセットアップ (Phase 4)

1. [Google Cloud Console](https://console.cloud.google.com/) で新しいプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」で **YouTube Data API v3** を検索して有効化
3. 「認証情報」→「認証情報を作成」→「APIキー」でキーを発行
4. キー制限で **YouTube Data API v3** のみに絞る（推奨）
5. `backend/.env` に `YOUTUBE_API_KEY=AIza...` を設定して Django を再起動

無料枠は1日 10,000 ユニット（channels.list = 1単位、commentThreads.list = 1単位）。100チャンネルを毎日同期しても余裕。

### 同期方法
- 画面から: 競合一覧で「APIから更新」、チャンネル詳細の動画別ランキングで「コメント取得」
- CLI: `python manage.py sync_competitors` / `python manage.py sync_comments --channel 1`

## 技術スタック

- **バックエンド:** Django 5.2 LTS + Django REST Framework + SimpleJWT
- **フロントエンド:** React 18 + Vite + TypeScript
- **DB:** PostgreSQL（本番）/ SQLite（ローカル開発）
- **非同期処理:** Celery + Redis（CSV取り込み・レポート生成）
- **ファイルストレージ:** S3 / MinIO（CSV・生成Excel）
- **課金:** Stripe

## ディレクトリ構成

```
analytics/
├── backend/        Django プロジェクト
│   ├── config/     Django設定（settings, urls, wsgi）
│   ├── apps/       業務アプリ
│   │   ├── accounts/   ユーザー認証
│   │   ├── tenants/    マルチテナント
│   │   ├── channels/   YouTubeチャンネル
│   │   ├── analytics/  分析・レポート
│   │   ├── imports/    CSVインポート
│   │   └── billing/    プラン・課金
│   └── requirements.txt
├── frontend/       React SPA
└── README.md
```

## セットアップ手順

### 前提
- Python 3.12+
- Node.js 20+
- (任意) PostgreSQL, Redis

### バックエンド

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

→ http://localhost:8000

### フロントエンド

```powershell
cd frontend
npm install
npm run dev
```

→ http://localhost:5173
