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
import { BsFillVolumeMuteFill, BsFillVolumeUpFill } from "react-icons/bs";
import { useRouter } from "next/navigation";

interface PresentationData {
  title: string;
  sync_id: string;
}

interface GroupData {
  name: string;
  presentation_sync_id: string;
}

interface TranscriptData {
  id: string;
  order: number;
  transcript: string;
  voice_url: string;
}

interface AudioData {
  id: string;
  audio: HTMLAudioElement;
}

export default function Audience({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [presentationData, setPresentationData] = useState<PresentationData>(
    {} as PresentationData
  );
  const [groupData, setGroupData] = useState<GroupData>({} as GroupData);
  const [transcriptsData, setTranscriptsData] = useState<TranscriptData[]>([]);
  const [showTranscriptData, setShowTranscriptData] = useState<TranscriptData>(
    {} as TranscriptData
  );
  const [playAudio, setPlayAudio] = useState<HTMLAudioElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(1.8);
  const [isMute, setIsMute] = useState<boolean>(true);
  const [safariAction, setSafariAction] = useState<boolean>(true);
  const [audioDataList, setAudioDataList] = useState<AudioData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadedAudioCount, setLoadedAudioCount] = useState<number>(0);
  const [isFetchingPresentationData, setIsFetchingPresentationData] =
    useState<boolean>(true);
  const [noAudio, setNoAudio] = useState<boolean>(false);

  useEffect(() => {
    // ブラウザがSafariかどうか判定
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.indexOf("safari") !== -1) {
      if (userAgent.indexOf("chrome") > -1) {
        // Chrome
      } else {
        // Safari
        setSafariAction(true);
        setIsMute(true);
      }
    }
  }, []);

  useEffect(() => {
    let unsubscribeGroup: () => void = () => {};

    const subscribeGroup = (groupId: string) => {
      unsubscribeGroup = onSnapshot(doc(db, "groups", groupId), (doc) => {
        const data: any = doc.data();
        const serializedData: GroupData = {
          name: data.name || "",
          presentation_sync_id: data.presentation_sync_id || "",
        };
        setGroupData(serializedData);
        fetchPresentationData(serializedData.presentation_sync_id);
      });
    };

    subscribeGroup(params.id);

    return () => {
      unsubscribeGroup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchPresentationData = async (presentationId: string) => {
    let unsubscribePresentation: () => void = () => {};
    if (!presentationId) {
      setPresentationData({} as PresentationData);
      setTranscriptsData([]);
      setShowTranscriptData({} as TranscriptData);
      return;
    }

    unsubscribePresentation = onSnapshot(
      doc(db, "presentation", presentationId),
      (doc) => {
        const data: any = doc.data();
        const serializedData: PresentationData = {
          title: data.title || "",
          sync_id: data.sync_id || "",
        };
        setPresentationData(serializedData);
      }
    );

    await getAllTranscripts(presentationId);

    return () => unsubscribePresentation();
  };

  const getAllTranscripts = async (presentationId: string) => {
    const presentationRef = doc(db, "presentation", presentationId);
    const transcriptRef = collection(presentationRef, "transcripts");
    const sortedByOrderTranscriptRef = query(transcriptRef, orderBy("order"));
    await getDocs(sortedByOrderTranscriptRef).then(async (querySnapshot) => {
      const data: any = [];

      await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const voice_path = doc.data().voice_path;
          const voice_path_ref = ref(storage, voice_path);
          const url = await getDownloadURL(voice_path_ref);
          data.push({
            id: doc.id,
            order: doc.data().order,
            transcript: doc.data().transcript,
            voice_url: url,
          });
        })
      );

      data.sort((a: any, b: any) => {
        if (a.order < b.order) return -1;
        if (a.order > b.order) return 1;
        return 0;
      });

      setTranscriptsData(data);
      setIsFetchingPresentationData(false);
    });
  };

  useEffect(() => {
    const playTranscriptAudio = async () => {
      const modifiedSyncId = presentationData.sync_id;
      if (!modifiedSyncId) {
        setShowTranscriptData({} as TranscriptData);
        return;
      }
      const targetTranscript = transcriptsData.find(
        (transcript: any) => transcript.id === modifiedSyncId
      );

      if (targetTranscript) {
        if (playAudio) {
          playAudio.pause();
        }
        setShowTranscriptData(targetTranscript);

        const audioIndex = audioDataList.findIndex(
          (audioData: any) => audioData.id === targetTranscript.id
        );

        if (audioIndex !== -1) {
          audioDataList[audioIndex].audio.playbackRate = 1.4;
          audioDataList[audioIndex].audio.play();
          setPlayAudio(audioDataList[audioIndex].audio);
        } else {
          const audio = new Audio(targetTranscript.voice_url);
          audio.playbackRate = 1.4;
          setPlayAudio(audio);
          audio.play();
        }
      }
    };

    playTranscriptAudio();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationData.sync_id, transcriptsData]);

  useEffect(() => {
    if (isMute) {
      playAudio?.pause();
    } else {
      playAudio?.play();
    }
  }, [isMute, playAudio]);

  useEffect(() => {
    const defaultFontSize = localStorage.getItem("fontSize");
    if (defaultFontSize) {
      setFontSize(parseFloat(defaultFontSize));
    }
  }, []);

  const fontSizeUp = () => {
    setFontSize(fontSize + 0.2);
    localStorage.setItem("fontSize", `${fontSize + 0.2}`);
  };

  const fontSizeDown = () => {
    if (fontSize <= 1.0) return;
    setFontSize(fontSize - 0.2);
    localStorage.setItem("fontSize", `${fontSize - 0.2}`);
  };

  const loadAudio = (index: number) => {
    if (index >= transcriptsData.length) {
      setIsLoading(false);
      return;
    }
    const audio = new Audio(transcriptsData[index].voice_url);
    audio.oncanplaythrough = () => {
      setLoadedAudioCount((prev) => prev + 1);
      loadAudio(index + 1);
    };
    audio.load();
    setAudioDataList((prev) => [
      ...prev,
      { id: transcriptsData[index].id, audio: audio },
    ]);
  };

  const handleOnSafariAction = () => {
    const loadedAudioDataList: AudioData[] = [];
    for (let data of transcriptsData) {
      const audio = new Audio(data.voice_url);
      audio.load();
      audio.oncanplaythrough = () => {
        setLoadedAudioCount((prev) => prev + 1);
      };
      loadedAudioDataList.push({ id: data.id, audio: audio });
    }
    setAudioDataList(loadedAudioDataList);
    setSafariAction(false);
  };

  const handleNoloadAudio = () => {
    setNoAudio(true);
    setSafariAction(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-black">
      {!noAudio && (
        <div className="text-center">
          <p className="p-3 text-gray-500 text-xs">
            音声データ
            {Math.ceil(100 * (loadedAudioCount / transcriptsData.length))}%
            loaded
          </p>
        </div>
      )}
      {!noAudio && (
        <button
          className={`border-2 rounded-full p-2 fixed bottom-3 left-1/2 -translate-x-1/2 ${
            isMute ? "text-gray-400 border-gray-400" : "text-white border-white"
          }}`}
          onClick={() => setIsMute(!isMute)}
        >
          {isMute ? (
            <BsFillVolumeMuteFill size="32"></BsFillVolumeMuteFill>
          ) : (
            <BsFillVolumeUpFill size="32"></BsFillVolumeUpFill>
          )}
        </button>
      )}
      <div
        className={`fixed top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 container`}
      >
        {showTranscriptData.transcript ? (
          <p
            style={{ fontSize: `${fontSize}rem` }}
            className="text-center font-bold leading-loose text-white"
          >
            {showTranscriptData.transcript}
          </p>
        ) : (
          <p className="text-center text-3xl font-bold text-gray-500">
            しばらくお待ちください
          </p>
        )}
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
      <div className="fixed p-3 bottom-0 right-0 text-xs flex gap-3">
        <button
          onClick={fontSizeDown}
          className="border-2 border-blue-500 text-white px-3 py-2 rounded-lg"
        >
          -
        </button>
        <button
          onClick={fontSizeUp}
          className="border-2 border-red-500 text-white px-3 py-2 rounded-lg"
        >
          +
        </button>
      </div>
      {safariAction && (
        <div className="fixed left-0 top-0 w-full h-full bg-black z-10">
          <div className="w-full h-full flex justify-center items-center text-center">
            {isFetchingPresentationData ? (
              <div className="flex flex-col gap-3 justify-center items-center p-3">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-200"></div>
                <p className="text-white text-2xl">読み込み中</p>
                <p className="text-white text-sm">
                  この読み込みには時間がかかる場合があります。
                </p>
                <div className="border border-white rounded-lg p-3 my-6">
                  <p className="text-white text-lg -mt-6 text-center">
                    <span className="bg-black px-3">使い方</span>
                  </p>
                  <p className="text-white">
                    スピーカーと同期して翻訳音声をイヤホンから聴くことができるシステムです。
                  </p>
                  <p>
                    <b className="text-yellow-400">
                      必ずイヤホンをつけた状態でご利用ください。
                    </b>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 justify-center items-center p-3">
                <button
                  disabled={isLoading}
                  className={`text-white px-3 py-2 rounded-lg hover:opacity-80 ${
                    isLoading ? "bg-gray-400" : "bg-blue-500"
                  }`}
                  onClick={() => handleOnSafariAction()}
                >
                  {isLoading ? "読み込み中" : "音声データの読み込みを開始する"}
                </button>
                <button
                  className="text-white px-3 py-2 rounded-lg text-sm hover:underline"
                  onClick={() => handleNoloadAudio()}
                >
                  読み込まずに開始する
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
