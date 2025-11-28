This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## プレゼン資料バッチ登録ツール

`make_contents/make_contents.py` で CSV を Firestore / Storage / Google Cloud TTS に登録できます。サービスアカウント鍵を取得して `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` を設定し、`pip install -r make_contents/pyproject.toml` 相当の依存関係（`firebase-admin`, `google-cloud-texttospeech` など）をインストールしてください。

### ファイル命名規則

CSV ファイル名は `name_lang_gender.csv` を前提にしており、`lang` に `EN` または `JA`、`gender` に `M` / `F` を含めることで翻訳先言語と声質を自動判定します。`name` 部分は Firestore のタイトルとして利用され、バッチ処理開始時に一覧確認されます。

### 使い方

```bash
cd make_contents

# 単一 CSV を登録
python make_contents.py --file examples/final/ラウラさん_EN_F.csv --group main

# ディレクトリ内の CSV を並列登録（デフォルト 4 並列）
python make_contents.py --dir examples/final --group main --max-workers 6

# Dry-run で内容を検証
python make_contents.py --dir examples/final --group main --dry-run

# タイトル確認プロンプトをスキップ
python make_contents.py --dir examples/final --group main --yes
```

- `--file` と `--dir` は排他指定です。
- グループ名はすべてのファイルで共通な `--group` によって指定します。
- `--dry-run` は CSV の中身・行数だけを検証し、Firestore/TTS/Storage にはアクセスしません。
- 並列数は `--max-workers` で制御できます。Google Cloud のクォータに合わせて調整してください。
