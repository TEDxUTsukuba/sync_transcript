## make_contents の使い方

### 概要

- `make_contents.py` は CSV で管理しているスクリプトと翻訳テキストを Firestore に書き込み、翻訳テキストを Google Cloud Text-to-Speech で音声化して Firebase Storage に保存するスクリプトです。
- 1 行が 1 セクションに対応し、`presentation/{docId}/transcripts` に順番どおりで登録されます。

### 前提条件

- Python 3.11 以上（`pyproject.toml` 参照）
- Google Cloud Text-to-Speech API が有効化されたプロジェクトとサービスアカウント鍵
  - 環境変数 `GOOGLE_APPLICATION_CREDENTIALS` で JSON キーへのパスを指定してください。
- Firebase プロジェクト `sync-transcript`（Firestore と Storage）へのアクセス権
- CSV ファイル名: `Name_LANG_GENDER.csv` 形式（例: `Sakura_JA_F.csv`）。拡張子前の 3 つの要素で言語と性別を推定します。

### セットアップ

```bash
cd make_contents
python3 -m venv .venv
source .venv/bin/activate
pip install .
```

- 既存の仮想環境がある場合は `pip install -e .` でも構いません。

### CSV フォーマット

- UTF-8 / カンマ区切り / ヘッダ行あり。
- 必須列: `script`, `transcript`。
  - `script`: 現地語の台本。
  - `transcript`: 反対言語の台本（例: EN -> JA あるいは JA -> EN）。
- 空行は無視されますが、列名のスペルミスがあるとエラーになります。

### 実行方法

1. `python make_contents.py` を実行。
2. コンソール入力に従って CSV パスとタイトル（デフォルトはファイル名の先頭部分）、グループ名を入力。
3. スクリプトが CSV の各行を Firestore に保存し、`presentation/{docId}/{index}.mp3` の音声ファイルを Firebase Storage にアップロードします。

#### 実行例

```text
$ python make_contents.py
ファイルパスを入力してください: examples/1125/Sakura_JA_F.csv
タイトルを入力してください(default: Sakura):
グループを入力してください: demo-group
```

- タイトルを空 Enter するとファイル名の `Name` 部分が使用されます。

### 注意点

- 言語コードは `EN` -> `ja-JP`, `JA` -> `en-US` に固定で変換されます。その他の言語・性別は現状サポートしていません。
- 実行中に音声合成を大量に行うため、Google Cloud の課金に注意してください。
- Firestore/Storage への書き込み権限を持つサービスアカウントを使用してください。
