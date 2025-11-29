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
  const [subFontSize, setSubFontSize] = useState(0.9);

  const mainFontSizeRef = useRef<HTMLInputElement>(null);
  const subFontSizeRef = useRef<HTMLInputElement>(null);
  const activeScriptRef = useRef<HTMLDivElement>(null);

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

  // 表示するスクリプトの範囲を計算（前後3件ずつ）
  const visibleScripts = useMemo(() => {
    if (!showTranscriptData.order && showTranscriptData.order !== 0) {
      return transcriptsData.slice(0, 7); // 初期状態では最初の7件
    }

    const currentOrder = showTranscriptData.order;
    const beforeCount = 3;
    const afterCount = 3;

    return transcriptsData.filter((item) => {
      return (
        item.order >= currentOrder - beforeCount &&
        item.order <= currentOrder + afterCount
      );
    });
  }, [showTranscriptData.order, transcriptsData]);

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

  // アクティブなスクリプトが変わったら自動スクロール
  useEffect(() => {
    if (activeScriptRef.current) {
      activeScriptRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  }, [showTranscriptData.id]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-black">
      <div className="text-center">
        <p className="p-3 text-gray-500">スピーカー</p>
      </div>
      <div className="fixed top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-full h-screen overflow-hidden">
        <div
          className="h-full overflow-y-auto overflow-x-hidden flex flex-col items-center py-[50vh] px-2"
          style={{ gap: `${1 * subFontSize}rem` }}
        >
          {visibleScripts.length > 0 ? (
            visibleScripts.map((script) => {
              const isActive = script.id === showTranscriptData.id;
              const fontSize = mainFontSize;
              const textColor = isActive ? "text-white" : "text-gray-500";
              const fontWeight = "font-bold";
              // 選択時は拡大なし(scale: 1)、非選択時はsubFontSizeで縮小
              const scale = isActive ? 1 : subFontSize;
              const opacity = isActive ? "opacity-100" : "opacity-60";

              return (
                <div
                  key={script.id}
                  ref={isActive ? activeScriptRef : null}
                  className={`text-center leading-relaxed transition-all duration-300 ${textColor} ${fontWeight} ${opacity}`}
                  style={{
                    fontSize: `${fontSize}rem`,
                    maxWidth: "90vw",
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    wordBreak: "keep-all",
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {script.script || "スクリプトがありません"}
                </div>
              );
            })
          ) : (
            <p className="text-center text-3xl font-bold text-gray-500">
              スクリプトを読み込んでいます...
            </p>
          )}
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
