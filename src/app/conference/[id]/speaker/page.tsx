"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { db } from "../../../../../firebase/database";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";

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
}

export default function Audience({ params }: { params: { id: string } }) {
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [transcriptsData, setTranscriptsData] = useState<transcriptData[]>([]);
  const [showTranscriptData, setShowTranscriptData] = useState<transcriptData>(
    {} as transcriptData
  );
  const [mainFontSize, setMainFontSize] = useState(3);
  const [subFontSize, setSubFontSize] = useState(3);

  const mainFontSizeRef = useRef<HTMLInputElement>(null);
  const subFontSizeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unsubscribePresentation: any = null;
    let unsubscribeGroup: any = null;
    let currentPresentationId: string | null = null;

    async function subscribeGroup() {
      if (!params.id) return;

      unsubscribeGroup = onSnapshot(
        doc(db, "groups", params.id),
        async (doc) => {
          const groupData: any = doc.data();
          const presentationSyncId = groupData.presentation_sync_id;

          if (presentationSyncId) {
            if (currentPresentationId !== presentationSyncId) {
              currentPresentationId = presentationSyncId;
              await subscribePresentation(presentationSyncId);
              await getAllTranscripts(presentationSyncId);
            }
          }
        }
      );
    }

    async function subscribePresentation(presentationId: string) {
      if (unsubscribePresentation) unsubscribePresentation();

      unsubscribePresentation = onSnapshot(
        doc(db, "presentation", presentationId),
        (doc) => {
          const data: any = doc.data();
          const serializedData = {
            title: data.title || "",
            sync_id: data.sync_id || "",
            group: data.group || "",
          };
          setPresentationData(serializedData);
        }
      );
    }

    async function getAllTranscripts(presentationId: string) {
      const presentationRef = doc(db, "presentation", presentationId);
      const transcriptRef = collection(presentationRef, "transcripts");
      const sortedByOrderTranscriptRef = query(transcriptRef, orderBy("order"));
      await getDocs(sortedByOrderTranscriptRef).then((querySnapshot) => {
        const data: transcriptData[] = [];
        querySnapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            order: doc.data().order,
            script: doc.data().script,
          });
        });
        setTranscriptsData(data);
      });
    }

    subscribeGroup();

    return () => {
      if (unsubscribePresentation) unsubscribePresentation();
      if (unsubscribeGroup) unsubscribeGroup();
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
    if (showTranscriptData.order === undefined) {
      setTimeout(() => {
        const targetTranscript = transcriptsData.find(
          (item) => item.order == 0
        );
        if (targetTranscript) {
          return targetTranscript;
        } else {
          return {} as transcriptData;
        }
      }, 1000);
    }

    const order = showTranscriptData.order + 1;
    const targetTranscript = transcriptsData.find(
      (item) => item.order == order
    );

    if (targetTranscript) {
      return targetTranscript;
    } else {
      return {} as transcriptData;
    }
  }, [transcriptsData, showTranscriptData.order]);

  useEffect(() => {
    const defaultMainFontSize = localStorage.getItem("mainFontSize");
    if (defaultMainFontSize) {
      setMainFontSize(parseFloat(defaultMainFontSize));
    }

    const defaultSubFontSize = localStorage.getItem("subFontSize");
    if (defaultSubFontSize) {
      setSubFontSize(parseFloat(defaultSubFontSize));
    }
    console.log(defaultMainFontSize, defaultSubFontSize);
  }, []);

  const saveFontSize = () => {
    console.log("save font size");
    localStorage.setItem("mainFontSize", mainFontSize.toString());
    localStorage.setItem("subFontSize", subFontSize.toString());
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-black">
      <div className="text-center">
        <p className="p-3 text-gray-500">スピーカー</p>
      </div>
      <div
        className={`fixed top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-full h-screen p-6 flex flex-col justify-center items-center gap-6`}
      >
        <div className="flex flex-col gap-6">
          <p
            className="text-center leading-loose text-white"
            style={{ fontSize: `${mainFontSize}rem` }}
          >
            {showTranscriptData.script}
          </p>
          <p className="text-center text-2xl">👇</p>
          <p
            style={{ fontSize: `${subFontSize}rem` }}
            className="text-center font-bold  text-xl leading-loose text-gray-500"
          >
            {nextTranscriptData.script}
          </p>
        </div>
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
      <div className="fixed p-3 bottom-0 right-0 flex gap-2">
        <button
          onClick={() => saveFontSize()}
          className="text-xs text-white border-white border rounded-md px-2 py-1"
        >
          保存
        </button>
        <Input
          type="number"
          ref={mainFontSizeRef}
          defaultValue={mainFontSize}
          onChange={(e) => setMainFontSize(parseFloat(e.target.value))}
          className="border-2 rounded-lg h-6 w-16 text-xs bg-black text-white"
        />
        <Input
          type="number"
          ref={subFontSizeRef}
          defaultValue={subFontSize}
          onChange={(e) => setSubFontSize(parseFloat(e.target.value))}
          className="border-2 rounded-lg h-6 w-16 text-xs bg-black text-white p-2"
        />
      </div>
    </main>
  );
}
