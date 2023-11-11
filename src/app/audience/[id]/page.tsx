"use client";

import { useState, useEffect, useRef, use } from "react";
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
import { set } from "firebase/database";

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
  transcript: string;
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
  const [playAudio, setPlayAudio] = useState<HTMLAudioElement>();
  const [fontSize, setFontSize] = useState<number>(1.8);
  const [isMute, setIsMute] = useState<boolean>(false);
  const [safariAction, setSafariAction] = useState<boolean>(false);
  const [audioDataList, setAudioDataList] = useState<audioData[]>([]);

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
    var unsubscribe: any = null;
    var groupUnsubscribe: any = null;
    function subscribe() {
      unsubscribe = onSnapshot(
        doc(db, "presentation", params.id || "presentationId"),
        (doc) => {
          const data: any = doc.data();
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
          router.push(`/audience/${serializedData.presentation_sync_id}`);
        }
        setGroupData(serializedData);
      });
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
        if (playAudio) {
          playAudio.pause();
        }
        setShowTranscriptData(targetTranscript);

        const audioIndex = audioDataList.findIndex(
          (audioData) => audioData.id === targetTranscript.id
        );

        if (audioIndex !== -1) {
          setPlayAudio(audioDataList[audioIndex].audio);
          audioDataList[audioIndex].audio.play();
          setPlayAudio(audioDataList[audioIndex].audio);
        } else {
          const audio = await new Audio(targetTranscript.voice_url);
          audio.playbackRate = 1.5;
          setPlayAudio(audio);
          audio.play();
        }
      }
    }

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

  const handleOnSafariAction = () => {
    const loadedAudioDataList: audioData[] = [];
    for (let data of transcriptsData) {
      const audio = new Audio(data.voice_url);
      audio.load();
      loadedAudioDataList.push({ id: data.id, audio: audio });
    }
    setSafariAction(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-black">
      <div className="text-center">
        <p className="p-3 text-gray-500">観客側</p>
      </div>
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
            <button
              className="bg-blue-500 text-white px-3 py-2 rounded-lg"
              onClick={handleOnSafariAction}
            >
              ここをタップしてください
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
