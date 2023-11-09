
import csv
import firebase_admin
from firebase_admin import firestore, storage
from google.cloud import texttospeech

firebase_admin.initialize_app(options={
    "storageBucket": "sync-transcript.appspot.com"
})


def synthesize_text(text, language_code, gender):
    """Synthesizes speech from the input string of text or ssml.

    Args:
        text (str): text to synthesize
        language_code (str): : "en-US" or "ja-JP"
        gender (str): MALE or FEMALE or NEUTRAL
    """
    client = texttospeech.TextToSpeechClient()

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
    blob.upload_from_string(data, content_type='audio/mp3')


def read_scripts_csv_file(file_path):
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        data = []
        for row in reader:
            data.append({'script': row['script'], 'transcript': row['transcript']})
        return data


def append_presentation(file_path, title):
    # file_pathからファイル名を取得
    file_name = file_path.split('/')[-1]
    
    # name_{lang}_{gender}という形式でファイル名が作成されていると仮定
    name, lang, gender = file_name.split('_')
    
    if 'EN' in lang:
        translate_language_code = 'ja-JP'
    elif 'JP' in lang:
        translate_language_code = 'en-US'
    else:
        # エラー処理
        return Exception('言語が判定できませんでした')

    if 'M' in gender:
        translate_voice_actor = "MALE"
    elif 'F' in gender:
        translate_voice_actor = "FEMALE"
    else:
        # エラー処理
        return Exception('声優が判定できませんでした')
    
    db = firestore.client()
    presentations_ref = db.collection('presentation')
    presentation_doc_ref = presentations_ref.document()
    
    presentation_doc_ref.set({
        'sync_id': '',
        'title': title,
    })
    
    data = read_scripts_csv_file(file_path)
    
    transcripts_ref = presentation_doc_ref.collection('transcripts')
    
    presentation_doc_id = presentation_doc_ref.id
    
    
    for index, row in enumerate(data):
        transcript_voice = synthesize_text(row['transcript'], translate_language_code, translate_voice_actor)
        
        voice_file_path = f'presentation/{presentation_doc_id}/{index}.mp3'
        
        upload_data_to_storage(voice_file_path, transcript_voice)
        
        transcripts_ref.add({
            'order': index,
            'script': row['script'],
            'transcript': row['transcript'],
            'voice_path': voice_file_path,
        })


if __name__ == "__main__":
    file_path = input('ファイルパスを入力してください: ')
    title = input('タイトルを入力してください: ')
    append_presentation(file_path, title)