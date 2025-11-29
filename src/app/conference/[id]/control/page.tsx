"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "../../../../../firebase/database";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

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
  const [selectPresentationId, setSelectPresentationId] = useState<string>("");
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [transcriptsData, setTranscriptsData] = useState<transcriptData[]>([]);
  const [groupOtherPresentationData, setGroupOtherPresentationData] = useState<
    PresentationData[]
  >([]);
  const [copiedLabel, setCopiedLabel] = useState<string>("");

  const shareableUrls = useMemo(() => {
    const baseUrl = "https://script.tedxutsukuba.com";
    const conferencePath = `/conference/${params.id}`;
    return [
      {
        label: "翻訳操作側",
        url: `${baseUrl}${conferencePath}/control`,
      },
      {
        label: "ユーザ端末",
        url: `${baseUrl}${conferencePath}`,
      },
      {
        label: "スクリーン用",
        url: `${baseUrl}${conferencePath}/transcript`,
      },
      {
        label: "スピーカー字幕用",
        url: `${baseUrl}${conferencePath}/speaker`,
      },
    ];
  }, [params.id]);

  const audiencePresentation = useMemo(() => {
    if (!groupData.presentation_sync_id) return null;
    if (groupData.presentation_sync_id === presentationData.id) {
      return presentationData;
    }
    return (
      groupOtherPresentationData.find(
        (item) => item.id === groupData.presentation_sync_id
      ) || null
    );
  }, [
    groupData.presentation_sync_id,
    presentationData,
    groupOtherPresentationData,
  ]);

  const viewingPresentation = presentationData.id ? presentationData : null;
  const isViewingSameAsAudience =
    audiencePresentation && viewingPresentation
      ? audiencePresentation.id === viewingPresentation.id
      : false;

  const handleCopyUrl = async (label: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(""), 2000);
    } catch (error) {
      console.error("Failed to copy url", error);
    }
  };

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
    let unsubscribePresentation: any = null;
    let unsubscribeGroup: any = null;

    async function subscribeGroup() {
      unsubscribeGroup = onSnapshot(
        doc(db, "groups", params.id),
        async (doc) => {
          const data = doc.data();
          const serializedGroupData = {
            id: doc.id,
            name: data?.name || "",
            presentation_sync_id: data?.presentation_sync_id || "",
          };
          setGroupData(serializedGroupData);

          const targetPresentationId =
            selectPresentationId || serializedGroupData.presentation_sync_id;

          if (
            serializedGroupData.presentation_sync_id &&
            !unsubscribePresentation
          ) {
            await subscribePresentation(targetPresentationId);
            getGroupOtherPresentation(params.id);
          }
        }
      );
    }

    async function subscribePresentation(presentationId: string) {
      unsubscribePresentation = onSnapshot(
        doc(db, "presentation", presentationId),
        (doc) => {
          const data = doc.data();
          const serializedPresentationData = {
            id: doc.id,
            title: data?.title || "",
            sync_id: data?.sync_id || "",
            group: data?.group || "",
          };
          setPresentationData(serializedPresentationData);
        }
      );
      getAllTranscripts(presentationId);
    }

    async function getGroupOtherPresentation(groupId: string) {
      const presentationRef = collection(db, "presentation");
      const groupOtherPresentationRef = query(
        presentationRef,
        where("group", "==", groupId)
      );
      const querySnapshot = await getDocs(groupOtherPresentationRef);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        sync_id: doc.data().sync_id,
      }));
      setGroupOtherPresentationData(data as PresentationData[]);
    }

    async function getAllTranscripts(presentationId: string) {
      const presentationRef = doc(db, "presentation", presentationId);
      const transcriptRef = collection(presentationRef, "transcripts");
      const sortedByOrderTranscriptRef = query(transcriptRef, orderBy("order"));
      const querySnapshot = await getDocs(sortedByOrderTranscriptRef);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        order: doc.data().order,
        transcript: doc.data().transcript,
        script: doc.data().script,
        voice_path: doc.data().voice_path,
      }));
      setTranscriptsData(data);
    }

    subscribeGroup();

    return () => {
      if (unsubscribePresentation) unsubscribePresentation();
      if (unsubscribeGroup) unsubscribeGroup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, selectPresentationId]);

  const handleOnClickTranscript = (transcriptId: string) => {
    if (!presentationData.id) return;
    const presentationRef = doc(db, "presentation", presentationData.id);
    updateDoc(presentationRef, {
      sync_id: transcriptId,
    });
  };

  const clearSyncID = () => {
    if (!presentationData.id) return;
    const presentationRef = doc(db, "presentation", presentationData.id);
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
    const groupRef = doc(db, "groups", groupData.id);
    updateDoc(groupRef, {
      presentation_sync_id: presentationData.id,
    });
  };

  return (
    <main className="flex min-h-screen flex-col text-white bg-black gap-6 container mx-auto items-center">
      <div className="py-2">
        <p className="text-white">
          プレゼンター（管理者） - {presentationData.title} -{" "}
          {presentationData.sync_id}
        </p>
        <p className="text-xs text-center text-gray-300">
          グループ:{" "}
          {groupData.name ? (
            <span className="font-semibold text-white">{groupData.name}</span>
          ) : (
            "取得中..."
          )}{" "}
          <span className="text-gray-500">(ID: {groupData.id || "-"})</span>
        </p>
        <p className="text-xs text-center text-gray-200">
          上下キーでsync_idを更新できます。(クリックでも可)
        </p>
        <p className="text-xs text-center text-gray-200">
          緑 = 観客に投影中 / 青 = 管理画面のみで閲覧中
        </p>
      </div>
      <div className="w-full max-w-4xl grid gap-4 px-6 md:grid-cols-2">
        <div className="rounded-2xl border border-green-400/80 bg-green-500/5 px-5 py-4 shadow-inner">
          <p className="text-xs font-semibold tracking-widest text-green-300">
            観客に投影中
          </p>
          {audiencePresentation ? (
            <>
              <p className="text-lg font-bold text-white">
                {audiencePresentation.title}
              </p>
              <p className="text-xs text-gray-400">
                Presentation ID: {audiencePresentation.id}
              </p>
              <p className="text-xs text-gray-300 mt-2">
                観客の端末とスクリーンはこのプレゼンが表示されています。
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              まだ観客に表示されているプレゼンがありません。
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-sky-400/80 bg-sky-500/5 px-5 py-4 shadow-inner">
          <p className="text-xs font-semibold tracking-widest text-sky-300">
            管理画面で閲覧中
          </p>
          {viewingPresentation ? (
            <>
              <p className="text-lg font-bold text-white">
                {viewingPresentation.title}
              </p>
              <p className="text-xs text-gray-400">
                Presentation ID: {viewingPresentation.id}
              </p>
              <p className="text-xs text-gray-300 mt-2">
                この画面で表示・操作しているプレゼンです。
                {isViewingSameAsAudience
                  ? "（観客と同期中）"
                  : "（観客とは別）"}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              閲覧中のプレゼンを選択してください。
            </p>
          )}
        </div>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupOtherPresentationData.map((presentation) => {
              const isAudiencePresentation =
                presentation.id === groupData.presentation_sync_id;
              const isViewingPresentation =
                presentation.id === presentationData.id;
              return (
                <button
                  key={presentation.id}
                  onClick={() => setSelectPresentationId(presentation.id)}
                  aria-pressed={isViewingPresentation}
                  className={`flex flex-col text-white gap-2 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                    isAudiencePresentation
                      ? "border-green-400 bg-green-500/10"
                      : isViewingPresentation
                      ? "border-sky-400 bg-sky-500/10"
                      : "border-gray-700 bg-gray-900/30 hover:bg-gray-800/40"
                  }`}
                >
                  <p className="text-sm text-center">{presentation.title}</p>
                  <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
                    {isAudiencePresentation && (
                      <span className="rounded-full bg-green-500/20 px-3 py-0.5 text-green-200">
                        観客に投影中
                      </span>
                    )}
                    {isViewingPresentation && !isAudiencePresentation && (
                      <span className="rounded-full bg-sky-500/20 px-3 py-0.5 text-sky-200">
                        管理画面で閲覧中
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-center text-gray-200 text-sm">
            緑の枠線は観客に表示中、青の枠線は管理画面のみで閲覧中のプレゼンです。
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
      <div className="w-full max-w-4xl px-6 flex flex-col gap-2">
        <p className="text-sm text-gray-200">
          共有リンクコピー（URLは固定です。確認後に送信してください）
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {shareableUrls.map((item) => (
            <button
              key={item.label}
              onClick={() => handleCopyUrl(item.label, item.url)}
              className="flex flex-col items-start gap-1 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3 text-left hover:border-white"
            >
              <span className="text-sm font-semibold text-white">
                {item.label}
              </span>
              <span className="text-xs text-gray-300 break-all">
                {item.url}
              </span>
              {copiedLabel === item.label && (
                <span className="text-xs text-green-400">コピーしました</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="py-6 flex flex-col w-full gap-3 px-6">
        {transcriptsData.map((transcript) => {
          const isActive = presentationData.sync_id === transcript.id;
          return (
            <div
              id={transcript.id}
              className={`flex flex-col gap-2 px-3 py-2 rounded-lg border transition-colors ${
                isActive
                  ? "border-green-500/90 bg-green-500/10"
                  : "border-gray-600 hover:border-gray-400"
              }`}
              key={transcript.id}
              onClick={() => handleOnClickTranscript(transcript.id)}
              aria-current={isActive ? "true" : undefined}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-200">
                <span>{transcript.order}</span>
                <span>{transcript.voice_path}</span>
                {isActive && (
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-200">
                    観客に表示中
                  </span>
                )}
              </div>
              <p className={isActive ? "font-bold" : ""}>
                {transcript.transcript}
              </p>
              <p className="text-sm text-gray-200">
                {transcript.script || "スクリプトがありません"}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
