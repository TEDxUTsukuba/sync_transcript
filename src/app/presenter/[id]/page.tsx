"use client";

import { useState, useEffect } from "react";
import { db } from "../../../../firebase/database";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

interface PresentationData {
  title: string;
  sync_id: string;
}

interface transcriptData {
  id: string;
  order: number;
  transcript: string;
  voice_path: string;
}

export default function Presenter({ params }: { params: { id: string } }) {
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [transcriptsData, setTranscriptsData] = useState<transcriptData[]>([]);

  useEffect(() => {
    var unsubscribe: any = null;
    function subscribe() {
      console.log("params.id", params.id);
      unsubscribe = onSnapshot(
        doc(db, "presentation", params.id || "presentationId"),
        (doc) => {
          const data: any = doc.data();
          console.log("data", data);
          const serializedData = {
            title: data.title || "",
            sync_id: data.sync_id || "",
          };
          setPresentationData(serializedData);
        }
      );
    }

    async function getAllTranscripts() {
      const presentationRef = doc(db, "presentation", params.id);
      const transcriptRef = collection(presentationRef, "transcripts");
      const sortedByOrderTranscriptRef = query(transcriptRef, orderBy("order"));
      await getDocs(sortedByOrderTranscriptRef).then((querySnapshot) => {
        const data: any = [];
        querySnapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            order: doc.data().order,
            transcript: doc.data().transcript,
            voice_path: doc.data().voice_path,
          });
        });
        console.log("data", data);
        setTranscriptsData(data);
      });
    }

    subscribe();
    getAllTranscripts();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [params.id]);

  const handleOnClickTranscript = (transcriptId: string) => {
    // sync_idを更新する
    const presentationRef = doc(db, "presentation", params.id);
    updateDoc(presentationRef, {
      sync_id: transcriptId,
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center">
      <p>プレゼンター（管理者）</p>
      <div>{presentationData.title}</div>
      <div>{presentationData.sync_id}</div>
      <div className="py-6 flex flex-col gap-3 px-6">
        {transcriptsData.map((transcript) => (
          <div
            className={`flex flex-col gap-2 px-3 py-1 rounded-lg border  ${
              presentationData.sync_id == transcript.id
                ? " border-green-500 border-2"
                : "border-gray-300"
            }`}
            key={transcript.id}
            onClick={() => handleOnClickTranscript(transcript.id)}
          >
            <div className="flex gap-2 text-sm text-gray-400">
              <span>{transcript.order}</span>
              <span>{transcript.voice_path}</span>
            </div>
            <p
              className={` ${
                presentationData.sync_id == transcript.id ? "font-bold" : ""
              }`}
            >
              {transcript.transcript}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
