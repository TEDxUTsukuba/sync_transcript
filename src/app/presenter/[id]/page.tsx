"use client";

import { useState, useEffect } from "react";
import { db } from "../../../../firebase/database";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import Link from "next/link";

interface PresentationData {
  id: string;
  title: string;
  sync_id: string;
  group: string;
}

interface transcriptData {
  id: string;
  order: number;
  transcript: string;
  script: string;
  voice_path: string;
}

interface groupData {
  id: string;
  name: string;
  presentation_sync_id: string;
}

export default function Presenter({ params }: { params: { id: string } }) {
  const [groupData, setGroupData] = useState<groupData>({} as groupData);
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [transcriptsData, setTranscriptsData] = useState<transcriptData[]>([]);
  const [groupOtherPresentationData, setGroupOtherPresentationData] = useState<
    PresentationData[]
  >([]);

  useEffect(() => {
    // 選択している要素が画面に表示されるようにスクロールする
    const element = document.getElementById(presentationData.sync_id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  }, [presentationData.sync_id]);

  useEffect(() => {
    var unsubscribe: any = null;
    var groupUnsubscribe: any = null;
    function subscribe() {
      unsubscribe = onSnapshot(
        doc(db, "presentation", params.id || "presentationId"),
        (doc) => {
          const data: any = doc.data();
          const serializedData = {
            id: doc.id,
            title: data.title || "",
            sync_id: data.sync_id || "",
            group: data.group || "",
          };

          if (serializedData.group && !groupUnsubscribe) {
            subscribeGroup(serializedData.group);
            getGroupOtherPresentation(serializedData.group);
          }

          setPresentationData(serializedData);
        }
      );
    }

    function subscribeGroup(group_id: string) {
      groupUnsubscribe = onSnapshot(doc(db, "groups", group_id), (doc) => {
        console.log("serializedData", doc.data());
        const data: any = doc.data();
        const serializedData = {
          id: doc.id,
          name: data.name || "",
          presentation_sync_id: data.presentation_sync_id || "",
        };
        setGroupData(serializedData);
      });
    }

    async function getGroupOtherPresentation(group_id: string) {
      const presentationRef = collection(db, "presentation");
      const groupOtherPresentationRef = query(
        presentationRef,
        where("group", "==", group_id)
      );
      await getDocs(groupOtherPresentationRef).then((querySnapshot) => {
        const data: any = [];
        querySnapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            title: doc.data().title,
            sync_id: doc.data().sync_id,
          });
        });
        setGroupOtherPresentationData(data);
      });
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
            script: doc.data().script,
            voice_path: doc.data().voice_path,
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
  }, [params.id, presentationData.group]);

  const handleOnClickTranscript = (transcriptId: string) => {
    // sync_idを更新する
    const presentationRef = doc(db, "presentation", params.id);
    updateDoc(presentationRef, {
      sync_id: transcriptId,
    });
  };

  const clearSyncID = () => {
    const presentationRef = doc(db, "presentation", params.id);
    updateDoc(presentationRef, {
      sync_id: "",
    });
  };

  // 上下のキーでsync_idを更新する
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        const currentIndex = transcriptsData.findIndex(
          (transcript) => transcript.id == presentationData.sync_id
        );
        const nextIndex = currentIndex - 1;
        if (nextIndex >= 0) {
          const nextTranscriptId = transcriptsData[nextIndex].id;
          handleOnClickTranscript(nextTranscriptId);
        }
      }
      if (event.key === "ArrowDown") {
        const currentIndex = transcriptsData.findIndex(
          (transcript) => transcript.id == presentationData.sync_id
        );
        const nextIndex = currentIndex + 1;
        if (nextIndex < transcriptsData.length) {
          const nextTranscriptId = transcriptsData[nextIndex].id;
          handleOnClickTranscript(nextTranscriptId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationData.sync_id, transcriptsData]);

  const setPresentationDataSyncId = () => {
    console.log(groupData);
    const groupRef = doc(db, "groups", groupData.id);
    updateDoc(groupRef, {
      presentation_sync_id: presentationData.id,
    });
  };

  return (
    <main className="flex min-h-screen flex-col gap-6 container mx-auto items-center">
      <div className="py-2">
        <p>
          プレゼンター（管理者）- {presentationData.title} -{" "}
          {presentationData.sync_id}
        </p>
        <p className="text-xs text-center text-gray-400">
          上下キーでsync_idを更新できます。(クリックでも可)
        </p>
        <p className="text-xs text-center text-gray-400">
          太文字の文章が観客に表示されます。
        </p>
      </div>
      {groupData.presentation_sync_id !== presentationData.id && (
        <div className="text-center">
          <button
            onClick={setPresentationDataSyncId}
            className="bg-red-500 text-white px-6 py-2 rounded-lg"
          >
            <span>観客をこのプレゼンに遷移させる</span>
          </button>
          <p className="text-center text-red-500">
            このボタンを押すと観客のページがこのプレゼンに切り替わります。注意してください。
          </p>
        </div>
      )}
      {groupOtherPresentationData.length > 0 && (
        <div>
          <div className="grid grid-cols-3 gap-3">
            {groupOtherPresentationData.map((presentation) => (
              <Link
                href={`/presenter/${presentation.id}`}
                key={presentation.id}
                className={`${
                  presentation.id == params.id
                    ? " pointer-events-none cursor-default"
                    : ""
                }}`}
              >
                <div
                  className={`flex flex-col gap-2 px-3 py-1 rounded-lg  ${
                    presentation.id == params.id
                      ? " bg-gray-200"
                      : "hover:underline"
                  } ${
                    groupData.presentation_sync_id == presentation.id
                      ? "border-green-300 border-2"
                      : "border-gray-300 border"
                  }`}
                >
                  <p className="text-sm text-center">{presentation.title}</p>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-center text-gray-400">
            緑の枠線が観客が見ているプレゼンです。
          </p>
        </div>
      )}
      <button
        onClick={clearSyncID}
        className="bg-blue-500 text-white px-6 py-2 rounded-lg"
      >
        <span>初期化</span>
        <span className="text-xs">（観客には何も表示されないようにする）</span>
      </button>
      <div className="py-6 flex flex-col w-full gap-3 px-6">
        {transcriptsData.map((transcript) => (
          <div
            id={transcript.id}
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
            <p className="text-sm text-gray-400">
              {transcript.script || "スクリプトがありません"}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
