import argparse
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import List

import firebase_admin
from firebase_admin import firestore, storage
from google.cloud import texttospeech

firebase_admin.initialize_app(options={"storageBucket": "sync-transcript.appspot.com"})


_tts_client = None


def get_tts_client():
    global _tts_client
    if _tts_client is None:
        _tts_client = texttospeech.TextToSpeechClient()
    return _tts_client


def synthesize_text(text, language_code, gender):
    """Synthesizes speech from the input string of text or ssml.

    Args:
        text (str): text to synthesize
        language_code (str): : "en-US" or "ja-JP"
        gender (str): MALE or FEMALE or NEUTRAL
    """
    client = get_tts_client()

    # Set the text input to be synthesized
    synthesis_input = texttospeech.SynthesisInput(text=text)

    if language_code == "en-US":
        if gender == "MALE":
            voice_name = "en-US-Wavenet-D"
        else:
            voice_name = "en-US-Wavenet-C"
    else:
        if gender == "MALE":
            voice_name = "ja-JP-Neural2-C"
        else:
            voice_name = "ja-JP-Neural2-B"

    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code, name=voice_name
    )

    # Select the type of audio file you want returned
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # Perform the text-to-speech request on the text input with the selected
    # voice parameters and audio file type
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    return response.audio_content


def upload_data_to_storage(file_path, data):
    bucket = storage.bucket()
    blob = bucket.blob(file_path)
    blob.upload_from_string(data, content_type="audio/mp3")


def read_scripts_csv_file(file_path):
    with open(file_path, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        data = []
        for row in reader:
            # 空白行は無視
            if row["script"] != "" and row["transcript"] != "":
                print(row["script"], row["transcript"])
                data.append({"script": row["script"], "transcript": row["transcript"]})
        return data


@dataclass
class FileTask:
    file_path: str
    title: str
    group: str
    language_code: str
    voice_gender: str


def append_presentation(task: FileTask):
    file_path = task.file_path
    title = task.title
    group = task.group
    language_code = task.language_code
    voice_gender = task.voice_gender

    print(f"[{title}] creating firestore document...")
    db = firestore.client()
    presentations_ref = db.collection("presentation")
    presentation_doc_ref = presentations_ref.document()

    presentation_doc_ref.set(
        {
            "sync_id": "",
            "title": title,
            "group": group,
        }
    )

    presentation_doc_id = presentation_doc_ref.id

    print(f"[{title}] updating group document...")
    group_ref = db.collection("groups").document(group)
    group_ref.set({"presentation_sync_id": presentation_doc_id}, merge=True)

    print("reading csv file...")
    data = read_scripts_csv_file(file_path)

    transcripts_ref = presentation_doc_ref.collection("transcripts")

    print("synthesizing text...")
    for index, row in enumerate(data):
        print(f"synthesizing {index}...")
        transcript_voice = synthesize_text(
            row["transcript"], language_code, voice_gender
        )

        voice_file_path = f"presentation/{presentation_doc_id}/{index}.mp3"

        upload_data_to_storage(voice_file_path, transcript_voice)

        transcripts_ref.add(
            {
                "order": index,
                "script": row["script"],
                "transcript": row["transcript"],
                "voice_path": voice_file_path,
            }
        )


def parse_file_metadata(file_path: str):
    stem = Path(file_path).stem
    parts = stem.split("_")
    if len(parts) < 3:
        raise ValueError("ファイル名は name_lang_gender の形式である必要があります")
    name = "_".join(parts[:-2])
    lang = parts[-2]
    gender = parts[-1]
    return name, lang, gender


def resolve_language_and_voice(lang_token: str, gender_token: str):
    lang_token_upper = lang_token.upper()
    if "EN" in lang_token_upper:
        target_language = "ja-JP"
    elif "JA" in lang_token_upper:
        target_language = "en-US"
    else:
        raise ValueError("言語が判定できませんでした")

    gender_upper = gender_token.upper()
    if "M" in gender_upper:
        voice = "MALE"
    elif "F" in gender_upper:
        voice = "FEMALE"
    else:
        raise ValueError("声優が判定できませんでした")

    return target_language, voice


def build_task(file_path: str, group: str) -> FileTask:
    name, lang, gender = parse_file_metadata(file_path)
    language_code, voice_gender = resolve_language_and_voice(lang, gender)
    title = name
    return FileTask(
        file_path=file_path,
        title=title,
        group=group,
        language_code=language_code,
        voice_gender=voice_gender,
    )


def confirm_task_titles(tasks: List[FileTask]) -> bool:
    print("以下のタイトルで登録します:")
    for task in tasks:
        print(f"- {Path(task.file_path).name} -> {task.title}")
    answer = input("続行しますか？ (y/N): ").strip().lower()
    return answer in ("y", "yes")


def process_task(task: FileTask, dry_run: bool = False):
    file_label = Path(task.file_path).name
    try:
        if dry_run:
            data = read_scripts_csv_file(task.file_path)
            message = f"[DRY RUN] {file_label}: {len(data)} 行が検出されました"
            print(message)
            return {"file": file_label, "success": True, "message": message}
        append_presentation(task)
        message = f"[DONE] {file_label}"
        print(message)
        return {"file": file_label, "success": True, "message": message}
    except Exception as exc:
        message = f"[ERROR] {file_label}: {exc}"
        print(message)
        return {"file": file_label, "success": False, "message": message}


def run_single_mode(file_path: str, group: str, skip_confirm: bool, dry_run: bool):
    task = build_task(file_path, group)
    if not skip_confirm:
        if not confirm_task_titles([task]):
            print("処理をキャンセルしました")
            return
    process_task(task, dry_run=dry_run)


def run_batch_mode(
    directory: str, group: str, skip_confirm: bool, dry_run: bool, max_workers: int
):
    csv_paths = sorted(Path(directory).glob("*.csv"))
    if not csv_paths:
        print("CSVファイルが見つかりませんでした")
        return

    tasks = []
    for csv_path in csv_paths:
        try:
            tasks.append(build_task(str(csv_path), group))
        except ValueError as exc:
            print(f"[SKIP] {csv_path.name}: {exc}")

    if not tasks:
        print("実行可能なタスクがありませんでした")
        return

    if not skip_confirm and not confirm_task_titles(tasks):
        print("処理をキャンセルしました")
        return

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_task = {
            executor.submit(process_task, task, dry_run): task for task in tasks
        }
        for future in as_completed(future_to_task):
            result = future.result()
            results.append(result)

    success_count = sum(1 for r in results if r["success"])
    failure_count = len(results) - success_count
    print("--- バッチ完了 ---")
    print(f"成功: {success_count} / 失敗: {failure_count}")
    if failure_count:
        print("失敗したファイル:")
        for result in results:
            if not result["success"]:
                print(f"- {result['file']}: {result['message']}")


def create_parser():
    parser = argparse.ArgumentParser(
        description="CSVからFirestore/Storageへプレゼン資料を登録します"
    )
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--file", help="単一CSVファイルを指定")
    mode_group.add_argument("--dir", help="CSVファイルを含むディレクトリを指定")
    parser.add_argument(
        "--group", required=True, help="Firestoreに登録するグループ名（全ファイル共通）"
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=4,
        help="並列処理するワーカー数（デフォルト: 4）",
    )
    parser.add_argument("--yes", action="store_true", help="タイトル確認をスキップ")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Firestore/Storage/TTSを実行せず検証のみ行う",
    )
    return parser


def main():
    parser = create_parser()
    args = parser.parse_args()

    if args.file:
        run_single_mode(
            args.file, args.group, skip_confirm=args.yes, dry_run=args.dry_run
        )
    else:
        run_batch_mode(
            directory=args.dir,
            group=args.group,
            skip_confirm=args.yes,
            dry_run=args.dry_run,
            max_workers=args.max_workers,
        )


if __name__ == "__main__":
    main()
