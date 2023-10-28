"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../../../../firebase/database";
import storage from "../../../../firebase/storage";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";

interface PresentationData {
  title: string;
  sync_id: string;
}

interface transcriptData {
  id: string;
  order: number;
  transcript: string;
  voice_url: string;
}

interface audioData {
  id: string;
  audio: HTMLAudioElement;
}

export default function Audience({ params }: { params: { id: string } }) {
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [transcriptsData, setTranscriptsData] = useState<transcriptData[]>([]);
  const [showTranscriptData, setShowTranscriptData] = useState<transcriptData>(
    {} as transcriptData
  );
  const [firstTouch, setFirstTouch] = useState<boolean>(false);
  const [playAudio, setPlayAudio] = useState<HTMLAudioElement>();

  useEffect(() => {
    var unsubscribe: any = null;
    function subscribe() {
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
        querySnapshot.forEach(async (doc) => {
          const voice_path = doc.data().voice_path;
          const voice_path_ref = ref(storage, voice_path);
          const url = await getDownloadURL(voice_path_ref);

          data.push({
            id: doc.id,
            order: doc.data().order,
            transcript: doc.data().transcript,
            voice_url: url,
          });
        });
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

  useEffect(() => {
    async function playTranscriptAudio() {
      const modifiedSyncId = presentationData.sync_id;
      const targetTranscript = transcriptsData.find(
        (transcript) => transcript.id == modifiedSyncId
      );

      if (targetTranscript) {
        if (playAudio) {
          playAudio.pause();
        }
        setShowTranscriptData(targetTranscript);

        const audio = await new Audio(targetTranscript.voice_url);
        setPlayAudio(audio);
        audio.play();
      }
    }

    playTranscriptAudio();
  }, [presentationData.sync_id, transcriptsData, firstTouch]);

  const handleFirstAudioPlay = async () => {
    const url = showTranscriptData.voice_url;
    const audio = new Audio(url);
    setPlayAudio(audio);
    audio.play();
    setFirstTouch(true);
  };

  return (
    <main className="flex min-h-screen flex-col items-center">
      <p className="p-3 text-gray-500">観客側</p>
      {showTranscriptData.id && (
        <>
          <div
            className={`fixed top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 container`}
          >
            <p className="text-center text-3xl font-bold leading-loose">
              {showTranscriptData.transcript}
            </p>
          </div>
          <div className="fixed p-3 text-gray-400 top-0 left-0 text-xs">
            <span>{presentationData.title}</span>
          </div>
          <div className="fixed p-3 text-gray-400 top-0 right-0 text-xs">
            <span>{showTranscriptData.order}</span>
          </div>
          <div className="fixed p-3 text-gray-400 bottom-0 left-0 text-xs">
            <span>ID : {presentationData.sync_id}</span>
          </div>
        </>
      )}
      {!firstTouch && (
        <div className="bg-white fixed z-10 left-0 top-0 w-full h-full flex justify-center items-center">
          <button
            onClick={handleFirstAudioPlay}
            className="bg-blue-500 text-white px-3 py-2 rounded-lg"
          >
            クリックしてください
          </button>
        </div>
      )}
    </main>
  );
}
