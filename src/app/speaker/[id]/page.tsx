"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import { BsFillVolumeMuteFill, BsFillVolumeUpFill } from "react-icons/bs";
import { useRouter } from "next/navigation";

interface PresentationData {
  title: string;
  sync_id: string;
  group: string;
}

interface GroupData {
  name: string;
  presentation_sync_id: string;
}

interface transcriptData {
  id: string;
  order: number;
  script: string;
  voice_url: string;
}

interface audioData {
  id: string;
  audio: HTMLAudioElement;
}

export default function Audience({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [groupData, setGroupData] = useState<GroupData>({} as GroupData);
  const [transcriptsData, setTranscriptsData] = useState<transcriptData[]>([]);
  const [showTranscriptData, setShowTranscriptData] = useState<transcriptData>(
    {} as transcriptData
  );
  const [mainFontSize, setMainFontSize] = useState(1.8);
  const [subFontSize, setSubFontSize] = useState(1);

  useEffect(() => {
    var unsubscribe: any = null;
    var groupUnsubscribe: any = null;
    function subscribe() {
      unsubscribe = onSnapshot(
        doc(db, "presentation", params.id || "presentationId"),
        (doc) => {
          const data: any = doc.data();
          console.log("data", data);
          const serializedData = {
            title: data.title || "",
            sync_id: data.sync_id || "",
            group: data.group || "",
          };
          setPresentationData(serializedData);
          if (serializedData.group && !groupUnsubscribe) {
            subscribeGroup(serializedData.group);
          }
        }
      );
    }

    function subscribeGroup(group_id: string) {
      groupUnsubscribe = onSnapshot(doc(db, "groups", group_id), (doc) => {
        const data: any = doc.data();
        const serializedData = {
          name: data.name || "",
          presentation_sync_id: data.presentation_sync_id || "",
        };
        if (
          serializedData.presentation_sync_id &&
          serializedData.presentation_sync_id !== presentationData.sync_id
        ) {
          router.push(`/speaker/${serializedData.presentation_sync_id}`);
        }
        setGroupData(serializedData);
      });
    }

    async function getAllTranscripts() {
      console.log("execute getAllTranscripts");
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
            script: doc.data().script,
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
      if (groupUnsubscribe) {
        groupUnsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    async function playTranscriptAudio() {
      const modifiedSyncId = presentationData.sync_id;
      if (!modifiedSyncId) {
        setShowTranscriptData({} as transcriptData);
        return;
      }
      const targetTranscript = transcriptsData.find(
        (transcript) => transcript.id == modifiedSyncId
      );

      if (targetTranscript) {
        setShowTranscriptData(targetTranscript);
      }
    }

    playTranscriptAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationData.sync_id, transcriptsData]);

  const previousTranscriptData = useMemo(() => {
    const order = showTranscriptData.order - 1;
    if (order < 0) {
      return {} as transcriptData;
    }

    const targetTranscript = transcriptsData.find(
      (item) => item.order == order
    );

    if (targetTranscript) {
      return targetTranscript;
    } else {
      return {} as transcriptData;
    }
  }, [showTranscriptData.order, transcriptsData]);

  const nextTranscriptData = useMemo(() => {
    const order = showTranscriptData.order + 1;
    const targetTranscript = transcriptsData.find(
      (item) => item.order == order
    );

    if (targetTranscript) {
      return targetTranscript;
    } else {
      return {} as transcriptData;
    }
  }, [showTranscriptData.order, transcriptsData]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-black">
      <div className="text-center">
        <p className="p-3 text-gray-500">スピーカー</p>
      </div>
      <p
        style={{ fontSize: `${subFontSize}rem` }}
        className="fixed top-12 left-1/2 text-gray-400 -translate-x-1/2 container text-center text-xl leading-loose"
      >
        {previousTranscriptData.script}
      </p>
      <div
        className={`fixed top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 container`}
      >
        {showTranscriptData.script ? (
          <p
            className="text-center font-bold leading-loose text-white"
            style={{ fontSize: `${mainFontSize}rem` }}
          >
            {showTranscriptData.script}
          </p>
        ) : (
          <p className="text-center text-3xl font-bold text-gray-500">
            しばらくお待ちください
          </p>
        )}
      </div>
      <p
        style={{ fontSize: `${subFontSize}rem` }}
        className="fixed bottom-12 left-1/2 text-gray-400 -translate-x-1/2 container text-center text-xl leading-loose"
      >
        {nextTranscriptData.script}
      </p>
      <div className="fixed p-3 text-gray-400 top-0 left-0 text-xs">
        <span>{presentationData.title}</span>
      </div>
      <div className="fixed p-3 text-gray-400 top-0 right-0 text-xs">
        <span>{showTranscriptData.order}</span>
      </div>
      <div className="fixed p-3 text-gray-400 bottom-0 left-0 text-xs">
        <span>ID : {presentationData.sync_id}</span>
      </div>
      <div className="fixed p-3 bottom-0 right-0 flex gap-2">
        <input
          type="number"
          defaultValue={mainFontSize}
          onChange={(e) => setMainFontSize(parseFloat(e.target.value))}
          className="border-2 rounded-lg h-6 w-16 text-xs bg-black text-white"
        />
        <input
          type="number"
          defaultValue={subFontSize}
          onChange={(e) => setSubFontSize(parseFloat(e.target.value))}
          className="border-2 rounded-lg h-6 w-16 text-xs bg-black text-white p-2"
        />
      </div>
    </main>
  );
}
