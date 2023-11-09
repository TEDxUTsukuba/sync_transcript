
import csv
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# 初期化と認証
# cred = credentials.Certificate("path/to/serviceAccountKey.json")
firebase_admin.initialize_app()

def read_csv_file(file_path):
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        data = []
        for row in reader:
            data.append({'english': row['english'], 'japanese': row['japanese']})
        return data

def save_to_firestore(english, japanese):
    # Firestoreのコレクションを参照
    db = firestore.client()
    scripts_ref = db.collection('scripts')

    # ドキュメントを作成し、Firestoreに保存
    doc_ref = scripts_ref.document()
    doc_ref.set({
        'english': english,
        'japanese': japanese
    })


if __name__ == "__main__":
    data = read_csv_file('example_scripts.csv')
    for row in data:
        save_to_firestore(row['english'], row['japanese'])