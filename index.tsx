import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import './index.css';

// --- DEFAULT ASSETS (Fallback) ---
const DEFAULT_ASSETS = {
  bg: {
    act1: { type: 'css', value: 'radial-gradient(circle, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
    act2: { type: 'css', value: 'radial-gradient(circle, #441111 0%, #000000 100%)' },
    act3: { type: 'css', value: 'repeating-linear-gradient(45deg, #ff0000, #ff0000 10px, #000000 10px, #000000 20px)' },
    act4: { type: 'css', value: 'linear-gradient(to bottom, #000000, #434343)' },
    victory: { type: 'css', value: 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)' },
    defeat: { type: 'css', value: '#000000' },
  },
  character: {
    act1: '', 
    act2: '', 
    act3: '', 
  },
  music: {
    scary: '',   
    sad: '',     
    intense: '', 
    peaceful: '',
  },
  sfx: {
    glitch: '',  
    alert: '',   
  }
};

// --- Configuration ---
const MODEL_NAME = 'gemini-3-pro-preview';
const TIME_LIMIT_SECONDS = 180;
const STORAGE_KEY = 'teacher_lin_config_v2';

// --- Types ---
type Act = 1 | 2 | 3 | 4;

type GameState = {
  act: Act;
  corruption: number;
  empathy: number;
  status: 'start' | 'playing' | 'victory' | 'defeat';
  lastEnvironment: string;
  timeLeft: number;
};

type Message = {
  sender: 'boss' | 'player' | 'system';
  text: string;
  visualEffect?: 'shake' | 'glitch' | 'flash';
};

type OptionType = 'submissive' | 'aggressive' | 'empathetic';

type PlayerOption = {
  text: string;
  type: OptionType;
};

type AIResponse = {
  dialogue: string;
  visual_description: string;
  corruption_delta: number;
  empathy_delta: number;
  should_advance_act: boolean;
  visual_effect: 'none' | 'shake' | 'glitch' | 'flash';
  bgm_mood: 'scary' | 'sad' | 'intense' | 'peaceful';
  options: PlayerOption[];
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    dialogue: { type: Type.STRING },
    visual_description: { type: Type.STRING },
    corruption_delta: { type: Type.INTEGER },
    empathy_delta: { type: Type.INTEGER },
    should_advance_act: { type: Type.BOOLEAN },
    visual_effect: { type: Type.STRING, enum: ['none', 'shake', 'glitch', 'flash'] },
    bgm_mood: { type: Type.STRING, enum: ['scary', 'sad', 'intense', 'peaceful'] },
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['submissive', 'aggressive', 'empathetic'] }
        },
        required: ['text', 'type']
      }
    }
  },
  required: ['dialogue', 'visual_description', 'corruption_delta', 'empathy_delta', 'should_advance_act', 'options'],
};

// --- Visual Components ---

const ScreenEffect = ({ effect }: { effect: string }) => {
  if (effect === 'flash') return <div className="absolute inset-0 bg-white opacity-50 animate-[ping_0.2s_ease-in-out_1] pointer-events-none z-50"></div>;
  if (effect === 'glitch') return <div className="absolute inset-0 bg-red-500 mix-blend-overlay opacity-20 animate-pulse pointer-events-none z-50"></div>;
  // Shake is handled by the container class
  return null;
};

const BossSprite = ({ act, emotion, customName, assets }: { act: number, emotion: string, customName: string, assets: typeof DEFAULT_ASSETS }) => {
  const customImg = 
    act === 1 ? assets.character.act1 :
    act === 2 ? assets.character.act2 :
    act === 3 ? assets.character.act3 : null;

  if (customImg && act < 4) {
    return (
      <div className={`transition-all duration-1000 relative w-64 h-64 mx-auto my-4 ${act === 3 ? 'animate-pulse scale-110' : ''}`}>
        <img src={customImg} alt="Boss" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]" />
        {act === 3 && <div className="absolute inset-0 bg-red-500 mix-blend-color-burn opacity-30 animate-pulse"></div>}
      </div>
    );
  }

  // CSS Fallback
  return (
    <div className={`transition-all duration-1000 relative w-64 h-64 mx-auto my-4 
      ${act === 3 ? 'scale-110' : 'scale-100'} 
      ${act === 4 ? 'opacity-0 blur-xl' : 'opacity-100'}
    `}>
      <div className={`w-full h-full rounded-full blur-sm flex items-center justify-center transition-colors duration-500
        ${act === 1 ? 'bg-pink-300 shadow-[0_0_30px_pink]' : ''}
        ${act === 2 ? 'bg-purple-900' : ''}
        ${act === 3 ? 'bg-black border-4 border-red-600 animate-pulse' : ''}
        ${emotion === 'peaceful' ? 'bg-yellow-100 shadow-[0_0_50px_gold]' : ''}
      `}>
        <div className="relative w-32 h-32 bg-gray-900 rounded-full overflow-hidden">
             {act < 4 && (
                 <>
                  {/* Eyes */}
                  <div className={`absolute top-10 left-6 w-6 h-6 bg-white rounded-full ${act===1 ? 'animate-pulse' : 'bg-red-500'}`}></div>
                  <div className={`absolute top-10 right-6 w-6 h-6 bg-white rounded-full ${act===1 ? 'animate-pulse delay-75' : 'bg-red-500'}`}></div>
                  
                  {/* Mouth */}
                  <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-8 border-b-4 border-white rounded-full ${act===3 ? 'rotate-180 border-red-500' : ''}`}></div>
                 </>
             )}
             {(act === 2 || act === 3) && (
                <div className="absolute top-0 left-0 w-full h-full bg-red-500/20 animate-pulse"></div>
             )}
        </div>
      </div>
      {act !== 4 && (
        <div className="absolute -top-10 left-0 w-full text-center font-mono text-xs text-red-500 tracking-widest opacity-60 uppercase">
           状态: {act === 1 ? "催眠中" : act === 2 ? "创伤触发" : "精神崩溃"}
        </div>
      )}
    </div>
  );
};

const Background = ({ gameState, assets }: { gameState: GameState, assets: typeof DEFAULT_ASSETS }) => {
  let asset = assets.bg.act1;
  
  if (gameState.status === 'victory') asset = assets.bg.victory;
  else if (gameState.status === 'defeat') asset = assets.bg.defeat;
  else if (gameState.act === 2) asset = assets.bg.act2;
  else if (gameState.act === 3) asset = assets.bg.act3;
  else if (gameState.act === 4) asset = assets.bg.act4;

  if (asset.type === 'video' && asset.value) {
    return (
      <video 
        autoPlay muted loop playsInline 
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-60 pointer-events-none"
        src={asset.value}
      />
    );
  }
  
  if (asset.type === 'image' && asset.value) {
    return (
       <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 opacity-60"
        style={{ backgroundImage: `url(${asset.value})` }}
      />
    );
  }

  // CSS Fallback
  return (
    <div 
      className="absolute inset-0 z-0 transition-all duration-1000"
      style={{ background: asset.value || '#000' }}
    />
  );
};

// --- Config Panel Component ---
const ConfigPanel = ({ isOpen, onClose, config, onSave }: { isOpen: boolean, onClose: () => void, config: typeof DEFAULT_ASSETS, onSave: (newConfig: typeof DEFAULT_ASSETS) => void }) => {
  const [tempConfig, setTempConfig] = useState(config);
  const [activeTab, setActiveTab] = useState<'bg' | 'character' | 'music' | 'sfx'>('bg');
  const [audioPreview, setAudioPreview] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) setTempConfig(config);
    return () => {
      if (audioPreview) {
        audioPreview.pause();
        setAudioPreview(null);
      }
    };
  }, [isOpen, config]);

  const updateField = (category: string, key: string, value: string) => {
    const isUrl = value.startsWith('http') || value.startsWith('data:');
    let type = 'css';
    if (isUrl) {
      const lower = value.toLowerCase();
      if (lower.includes('video') || lower.includes('.mp4') || lower.includes('.webm')) type = 'video';
      else type = 'image';
    }

    setTempConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof DEFAULT_ASSETS],
        [key]: category === 'bg' ? { type: isUrl ? type : 'css', value } : value
      }
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category: string, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (Warn if > 3MB)
    if (file.size > 3 * 1024 * 1024) {
      alert("警告：文件过大 (>3MB)。可能会导致浏览器卡顿或无法保存。建议使用图片，或使用外部链接加载视频/音频。");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateField(category, key, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const playPreview = (url: string) => {
    if (audioPreview) {
      audioPreview.pause();
      setAudioPreview(null);
    }
    if (url) {
      const audio = new Audio(url);
      audio.volume = 0.5;
      audio.play().catch(e => alert("播放失败，请检查链接或文件格式"));
      setAudioPreview(audio);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="w-full max-w-4xl h-[90vh] bg-gray-900 border border-gray-700 rounded-xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">⚙️</span> 创作者后台 (Creator Panel)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white px-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900">
          {['bg', 'character', 'music', 'sfx'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 px-4 py-3 text-sm font-bold transition-colors
                ${activeTab === tab ? 'bg-gray-800 text-red-400 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
            >
              {tab === 'bg' ? '场景 (Scenes)' : tab === 'character' ? '角色 (Char)' : tab === 'music' ? '音乐 (BGM)' : '音效 (SFX)'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeTab === 'bg' && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs text-blue-200 mb-4">
                💡 提示：上传图片/视频，或粘贴 URL。注意：大文件可能导致保存失败。
              </div>
              {Object.entries(tempConfig.bg).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {key === 'act1' ? '第一幕 (初遇)' : 
                     key === 'act2' ? '第二幕 (爆发)' : 
                     key === 'act3' ? '第三幕 (高潮)' : 
                     key === 'act4' ? '第四幕 (决断)' :
                     key === 'victory' ? '胜利 (Victory)' : '失败 (Defeat)'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-gray-950 border border-gray-700 focus:border-red-500 rounded px-3 py-2 text-sm text-white font-mono outline-none transition-colors"
                      value={val.value.length > 50 ? val.value.substring(0, 50) + '...' : val.value}
                      onChange={e => updateField('bg', key, e.target.value)}
                      placeholder="粘贴 URL 或点击右侧上传 ->"
                    />
                    <label className="cursor-pointer w-10 h-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-white transition-colors" title="上传文件">
                      📁
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,video/*"
                        onChange={(e) => handleFileUpload(e, 'bg', key)} 
                      />
                    </label>
                    <div className="w-10 h-10 rounded border border-gray-700 overflow-hidden relative bg-black shrink-0">
                       {val.type === 'css' && <div className="w-full h-full" style={{background: val.value}}></div>}
                       {val.type === 'image' && <img src={val.value} className="w-full h-full object-cover" />}
                       {val.type === 'video' && <video src={val.value} className="w-full h-full object-cover" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'character' && (
            <div className="space-y-4">
               <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs text-blue-200 mb-4">
                💡 提示：推荐上传透明背景 PNG 图片。
               </div>
               {Object.entries(tempConfig.character).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {key === 'act1' ? 'Boss形态 - 第一幕' : key === 'act2' ? 'Boss形态 - 第二幕' : 'Boss形态 - 第三幕'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-gray-950 border border-gray-700 focus:border-red-500 rounded px-3 py-2 text-sm text-white font-mono outline-none"
                      value={val.length > 50 ? val.substring(0, 50) + '...' : val}
                      onChange={e => updateField('character', key, e.target.value)}
                      placeholder="粘贴 URL 或上传 ->"
                    />
                    <label className="cursor-pointer w-10 h-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-white transition-colors" title="上传图片">
                      📁
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'character', key)} 
                      />
                    </label>
                    {val && <img src={val} className="w-10 h-10 object-contain bg-black border border-gray-700 rounded shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'music' && (
             <div className="space-y-4">
               <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs text-blue-200 mb-4">
                💡 提示：支持 MP3/WAV。注意：完整歌曲文件较大，建议只上传片段或使用外部 URL。
               </div>
               {Object.entries(tempConfig.music).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {key === 'scary' ? '恐怖氛围 (Scary)' : 
                     key === 'sad' ? '悲伤回忆 (Sad)' : 
                     key === 'intense' ? '激烈/高潮 (Intense)' : '平静/胜利 (Peaceful)'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-gray-950 border border-gray-700 focus:border-red-500 rounded px-3 py-2 text-sm text-white font-mono outline-none"
                      value={val.length > 50 ? val.substring(0, 50) + '...' : val}
                      onChange={e => updateField('music', key, e.target.value)}
                      placeholder="粘贴 URL 或上传 ->"
                    />
                     <label className="cursor-pointer w-10 h-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-white transition-colors" title="上传音频">
                      📁
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="audio/*"
                        onChange={(e) => handleFileUpload(e, 'music', key)} 
                      />
                    </label>
                    <button onClick={() => playPreview(val)} className="px-3 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700">▶</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sfx' && (
             <div className="space-y-4">
               <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs text-blue-200 mb-4">
                💡 提示：短促的音效 (Glitch/Alert)。
               </div>
               {Object.entries(tempConfig.sfx).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                     {key === 'glitch' ? '故障音效 (Glitch)' : '警告音效 (Alert)'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-gray-950 border border-gray-700 focus:border-red-500 rounded px-3 py-2 text-sm text-white font-mono outline-none"
                      value={val.length > 50 ? val.substring(0, 50) + '...' : val}
                      onChange={e => updateField('sfx', key, e.target.value)}
                      placeholder="粘贴 URL 或上传 ->"
                    />
                    <label className="cursor-pointer w-10 h-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-white transition-colors" title="上传音频">
                      📁
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="audio/*"
                        onChange={(e) => handleFileUpload(e, 'sfx', key)} 
                      />
                    </label>
                     <button onClick={() => playPreview(val)} className="px-3 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700">▶</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-gray-800 rounded-b-xl">
          <button 
            onClick={() => {
              if(confirm('确定重置所有素材为默认吗？这会清除你的自定义配置。')) {
                setTempConfig(DEFAULT_ASSETS);
              }
            }}
            className="text-xs text-red-500 hover:text-red-400 underline"
          >
            重置默认配置
          </button>
          <button 
            onClick={() => {
               try {
                 onSave(tempConfig);
               } catch(e) {
                 alert("保存失败！可能原因是文件总大小超过了浏览器限制 (5MB)。请尝试只使用 URL 链接或减小文件。");
               }
            }}
            className="px-8 py-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded shadow-[0_0_15px_rgba(255,0,0,0.4)] transition-all transform hover:scale-105 active:scale-95"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  // Load config from local storage
  const [assets, setAssets] = useState<typeof DEFAULT_ASSETS>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default to ensure new keys (like act4) exist if reading old config
        return { ...DEFAULT_ASSETS, ...parsed, bg: { ...DEFAULT_ASSETS.bg, ...parsed.bg } };
      }
      return DEFAULT_ASSETS;
    } catch (e) {
      return DEFAULT_ASSETS;
    }
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    act: 1,
    corruption: 30,
    empathy: 0,
    status: 'start',
    lastEnvironment: '一间过度温馨、色彩鲜艳的幼儿园教室。空气中弥漫着甜腻的糖果味。',
    timeLeft: TIME_LIMIT_SECONDS
  });

  const [names, setNames] = useState({ player: '玩家', boss: '教母' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentOptions, setCurrentOptions] = useState<PlayerOption[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [screenEffect, setScreenEffect] = useState<'none'|'shake'|'glitch'|'flash'>('none');
  const [bgmMood, setBgmMood] = useState<'scary'|'sad'|'intense'|'peaceful'>('scary');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Save config handler
  const handleSaveConfig = (newConfig: typeof DEFAULT_ASSETS) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setAssets(newConfig);
      setIsConfigOpen(false);
    } catch (e) {
      console.error(e);
      alert("保存失败：存储空间不足。请减少上传的本地大文件（如长视频/音乐），改用 URL 链接。");
    }
  };

  // --- Audio System ---
  useEffect(() => {
    // Play BGM logic
    if (gameState.status === 'start') return;

    let targetSrc = '';
    if (gameState.status === 'victory') targetSrc = assets.music.peaceful;
    else if (bgmMood === 'scary') targetSrc = assets.music.scary;
    else if (bgmMood === 'sad') targetSrc = assets.music.sad;
    else if (bgmMood === 'intense') targetSrc = assets.music.intense;

    if (targetSrc && bgmRef.current) {
      const currentSrc = bgmRef.current.getAttribute('src');
      if (currentSrc !== targetSrc) {
        bgmRef.current.src = targetSrc;
        bgmRef.current.volume = 0.4; // Default BGM volume
        bgmRef.current.play().catch(e => console.log("Audio play prevented", e));
      }
    }
  }, [bgmMood, gameState.status, assets]);

  const playSfx = (type: 'glitch' | 'alert') => {
    if (sfxRef.current && assets.sfx[type]) {
      sfxRef.current.src = assets.sfx[type];
      sfxRef.current.volume = 0.6;
      sfxRef.current.play().catch(e => console.log("SFX play prevented", e));
    }
  };

  // --- Timer System ---
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) return { ...prev, timeLeft: 0, status: 'defeat' };
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState.status]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset screen effect
  useEffect(() => {
    if (screenEffect !== 'none') {
      playSfx('glitch');
      const timer = setTimeout(() => setScreenEffect('none'), 500);
      return () => clearTimeout(timer);
    }
  }, [screenEffect]);

  const startGame = () => {
    setGameState({ 
      act: 1, 
      corruption: 20, 
      empathy: 0, 
      status: 'playing',
      lastEnvironment: '一间过度温馨、色彩鲜艳的幼儿园教室。空气中弥漫着甜腻的糖果味。',
      timeLeft: TIME_LIMIT_SECONDS
    });
    setMessages([
      { sender: 'system', text: '【副本载入完成】' },
      { sender: 'system', text: '【第一幕：甜蜜的陷阱】' },
      { sender: 'boss', text: `哎呀……有新的小朋友，${names.player}，来了呢。` },
      { sender: 'system', text: '（你感到一阵强烈的困意，耳边传来了扭曲的《小星星》旋律）' }
    ]);
    
    // Initial options to kickstart the interaction immediately
    setCurrentOptions([
      { text: "（顺从地闭上眼，装作困倦）", type: 'submissive' },
      { text: "这里好吵……谁在唱歌？", type: 'aggressive' },
      { text: "老师，你的铃铛声音真好听。", type: 'empathetic' }
    ]);
  };

  const generateSystemInstruction = () => `
你是这个3分钟“速通”心理恐怖文字游戏的GM。
玩家名称: "${names.player}" (无限流挑战者)。
Boss名称: "${names.boss}" (一位死后异化的幼儿园老师，数字恶灵)。

【核心规则】:
- **必须全程使用中文回复**。不要使用英文。
- 这是一个快节奏游戏。
- 每一轮，你需要生成3个截然不同的选项供玩家选择。
- **关于视觉效果 (visual_effect)**: 
  - 当Boss感到愤怒、尖叫、恶意值激增或剧情发生剧烈反转时，**必须**返回 "shake" (剧烈震动) 或 "glitch" (故障)。
  - 当进入下一幕或有重大启示时，返回 "flash" (闪光)。

【核心剧本】:
- 场景: 一间过度温馨、充满糖果味但令人作呕的幼儿园教室。
- Boss声音: 在“甜得发腻的母性温柔”（催眠时）和“伴随电流杂音的尖叫”（被触发创伤时）之间切换。
- 关键意象: 扭曲的《小星星》儿歌在循环播放。
- 创伤背景: 她生前遭受了严重的网络暴力（造谣虐童）。弹幕像“黑心老师”、“去死”、“作秀”依然缠绕着她。她杀死孩子是为了让他们“永远安静”，不再受世界伤害。

【章节结构】(总共3分钟):
第一幕: 甜蜜的陷阱 (催眠)。Boss温柔地诱导玩家入睡。
第二幕: 故障 (网暴噩梦)。幻象破裂，满屏恶意弹幕。Boss开始尖叫。**建议触发 shake 震动**。
第三幕: 高潮 (终焉童谣)。《小星星》变成刺耳尖啸。Boss试图杀死玩家。**频繁触发 shake 和 glitch**。
第四幕: 结局 (决断)。净化或吞噬。

【输出要求】:
1. 严禁英文。
2. 如果【恶意值】达到100，描述玩家被做成了布娃娃。
`;

  const handleOptionSelect = async (option: PlayerOption) => {
    if (isProcessing || gameState.status !== 'playing') return;

    setIsProcessing(true);
    // Clear options while processing to prevent double clicks
    setCurrentOptions([]); 
    setMessages(prev => [...prev, { sender: 'player', text: option.text }]);

    try {
      const historyText = messages.slice(-8).map(m => {
        const name = m.sender === 'boss' ? names.boss : m.sender === 'player' ? names.player : '系统';
        return `${name}: ${m.text}`;
      }).join('\n');

      const prompt = `
        当前幕: ${gameState.act}/4.
        剩余时间: ${gameState.timeLeft} 秒.
        当前数值: 恶意值 ${gameState.corruption}%, 唤醒值 ${gameState.empathy}%.
        对话历史: 
        ${historyText}
        
        玩家选择了: [${option.type.toUpperCase()}] "${option.text}"
        
        指令: 
        1. 分析玩家的选择。
        2. 根据类型更新数值 (Empathetic -> +Empathy, Aggressive -> +Corruption)。
        3. 只有在剧情到达当前幕的高潮点时，才推进到下一幕 (Advance Act)。
        4. 生成3个新的选项给玩家。
        5. **必须使用中文回复**。
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: generateSystemInstruction(),
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 1024 }
        }
      });

      const data = JSON.parse(response.text) as AIResponse;

      if (data.visual_effect !== 'none') setScreenEffect(data.visual_effect);
      setBgmMood(data.bgm_mood);

      let newCorruption = Math.max(0, Math.min(100, gameState.corruption + data.corruption_delta));
      let newEmpathy = Math.max(0, Math.min(100, gameState.empathy + data.empathy_delta));
      
      let nextAct = gameState.act;
      let nextStatus: GameState['status'] = gameState.status;

      // Check Game Over Conditions
      if (newCorruption >= 100) nextStatus = 'defeat';
      else if (newEmpathy >= 100) nextStatus = 'victory';
      else if (data.should_advance_act && gameState.act < 4) {
        nextAct = (gameState.act + 1) as Act;
        
        const actTitles = {
           2: "【第二幕：破碎的回忆】",
           3: "【第三幕：终焉的童谣】",
           4: "【第四幕：最终抉择】"
        };

        setMessages(prev => [...prev, { 
             sender: 'system', 
             text: `--- ${actTitles[nextAct as 2|3|4]} ---`,
             visualEffect: 'flash'
        }]);
        setScreenEffect('flash');
      }

      // Check Final Act Resolution
      if (nextAct === 4 && nextStatus === 'playing') {
         if (newEmpathy > newCorruption) nextStatus = 'victory';
         // Act 4 continues to let the user see the final dialogue before end
      }

      setGameState(prev => ({
        ...prev,
        corruption: newCorruption,
        empathy: newEmpathy,
        act: nextAct,
        status: nextStatus,
        lastEnvironment: data.visual_description
      }));

      setMessages(prev => [...prev, { 
        sender: 'boss', 
        text: data.dialogue, 
        visualEffect: data.visual_effect as any 
      }]);

      if (nextStatus === 'playing') {
        setCurrentOptions(data.options);
      } else {
        setCurrentOptions([]);
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { sender: 'system', text: '连接不稳定... 正在重试...' }]);
      setCurrentOptions([option]); // Restore option to try again
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans">
      {/* Config Panel */}
      <ConfigPanel 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        config={assets} 
        onSave={handleSaveConfig} 
      />

      {/* Audio Elements */}
      <audio ref={bgmRef} loop />
      <audio ref={sfxRef} />

      <Background gameState={gameState} assets={assets} />
      <ScreenEffect effect={screenEffect} />

      {/* Start Screen */}
      {gameState.status === 'start' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8 text-center animate-fade-in">
          {/* Config Button */}
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="absolute top-4 right-4 text-3xl text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full"
            title="打开创作者后台 (Creator Panel)"
          >
            ⚙️
          </button>

          <h1 className="text-6xl font-bold text-red-600 tracking-tighter mb-4 glitch-text">GODMOTHER</h1>
          <p className="text-gray-400 mb-8 max-w-md font-mono">
            副本代号：幼儿园<br/>
            挑战目标：存活并净化 Boss<br/>
            限时：3:00
          </p>

          <div className="flex flex-col gap-4 mb-8 w-64">
            <div>
               <label className="text-xs text-red-400 font-mono block text-left mb-1">玩家昵称</label>
               <input 
                 className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono focus:border-red-500 outline-none"
                 value={names.player}
                 onChange={e => setNames(prev => ({...prev, player: e.target.value}))}
               />
            </div>
            <div>
               <label className="text-xs text-gray-500 font-mono block text-left mb-1">BOSS (已锁定)</label>
               <input 
                 className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-500 font-mono cursor-not-allowed outline-none"
                 value={names.boss}
                 readOnly
               />
            </div>
          </div>

          <button 
            onClick={startGame}
            className="px-12 py-4 bg-red-800 hover:bg-red-700 text-xl text-white font-mono rounded border border-red-500 transition-all hover:scale-105 shadow-[0_0_20px_red]"
          >
            进入副本
          </button>
        </div>
      )}

      {/* Game Over / Victory */}
      {(gameState.status === 'victory' || gameState.status === 'defeat') && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-8 text-center animate-fade-in">
           <h1 className={`text-6xl font-bold mb-4 ${gameState.status === 'victory' ? 'text-blue-400' : 'text-red-600'}`}>
             {gameState.status === 'victory' ? '净化成功' : '已被吞噬'}
           </h1>
           <p className="text-xl text-white mb-8 max-w-lg leading-relaxed">
             {gameState.status === 'victory' 
               ? `铃声清脆响起。${names.boss}记起了自己是守护者，而不是怪物。谢谢你，${names.player}，把她带回来了。` 
               : gameState.timeLeft === 0 ? `时间耗尽。${names.player}永远成为了她收藏的玩偶。` : `你激怒了她。${names.player}的意识被无数恶毒的弹幕撕碎了。`}
           </p>
           <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 border border-white/30 rounded hover:bg-white/10 font-mono"
          >
            重启轮回
          </button>
        </div>
      )}

      {/* Main Game Interface - Added shake class conditionally */}
      <div className={`flex flex-col h-full max-w-3xl mx-auto relative z-10 bg-black/40 backdrop-blur-md shadow-2xl border-x border-white/10 ${screenEffect === 'shake' ? 'animate-shake' : ''}`}>
        
        {/* Top HUD */}
        <div className="p-4 bg-black/60 border-b border-white/10 flex justify-between items-center">
          <div className="flex flex-col w-1/4">
             <span className="text-[10px] text-red-400 font-mono tracking-widest">恶意值 (CORRUPTION)</span>
             <div className="h-1 bg-gray-800 w-full overflow-hidden">
                <div className="h-full bg-red-600 shadow-[0_0_10px_red] transition-all duration-500" style={{width: `${gameState.corruption}%`}}></div>
             </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center">
             <div className={`text-3xl font-mono font-bold ${gameState.timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatTime(gameState.timeLeft)}
             </div>
             <div className="text-[10px] text-gray-400 font-mono uppercase">第 {gameState.act} 幕 / 共 4 幕</div>
          </div>

          <div className="flex flex-col w-1/4 items-end">
             <span className="text-[10px] text-blue-400 font-mono tracking-widest">唤醒值 (EMPATHY)</span>
             <div className="h-1 bg-gray-800 w-full overflow-hidden">
                <div className="h-full bg-blue-400 shadow-[0_0_10px_blue] float-right transition-all duration-500" style={{width: `${gameState.empathy}%`}}></div>
             </div>
          </div>
        </div>

        {/* Scene Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
           <p className="absolute top-2 text-center w-full text-sm text-gray-300 italic opacity-80 px-4 drop-shadow-md animate-fade-in">
             "{gameState.lastEnvironment}"
           </p>
           
           <BossSprite act={gameState.act} emotion={bgmMood} customName={names.boss} assets={assets} />
        </div>

        {/* Dialogue Scroll */}
        <div 
          ref={scrollRef}
          className="h-80 overflow-y-auto p-4 space-y-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent scrollbar-hide mask-image-gradient"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.sender === 'player' ? 'items-end' : 'items-start'} animate-fade-in`}>
              <div className={`
                max-w-[90%] px-5 py-3 rounded-xl text-sm leading-relaxed backdrop-blur-md border border-white/10 shadow-lg relative
                ${m.sender === 'player' ? 'bg-blue-900/40 text-blue-50 rounded-tr-none' : ''}
                ${m.sender === 'boss' ? 'bg-red-900/40 text-red-50 rounded-tl-none border-red-500/30' : ''}
                ${m.sender === 'system' ? 'w-full text-center bg-transparent text-gray-400 text-xs py-1 border-none italic' : ''}
              `}>
                <span className="font-bold text-[10px] opacity-60 block mb-1 tracking-wider uppercase">
                  {m.sender === 'boss' ? names.boss : m.sender === 'player' ? names.player : ''}
                </span>
                {m.text}
                {m.sender === 'boss' && <div className="absolute -left-1 top-0 h-full w-1 bg-red-500/50 rounded-l"></div>}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="text-xs text-gray-500 animate-pulse ml-2 font-mono flex items-center">
              <span className="w-2 h-2 bg-gray-500 rounded-full mr-2 animate-bounce"></span>
              {names.boss} 正在思考...
            </div>
          )}
        </div>

        {/* Decision Panel (Replaces Input) */}
        <div className="p-4 bg-black/80 border-t border-white/10">
          {isProcessing ? (
             <div className="h-20 flex items-center justify-center text-gray-500 font-mono text-sm animate-pulse">
               正在同步神经信号...
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {currentOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(opt)}
                  className={`
                    p-3 rounded text-sm text-left transition-all duration-200 border relative overflow-hidden group
                    ${opt.type === 'submissive' ? 'border-gray-600 bg-gray-900/50 hover:bg-gray-800 text-gray-300' : ''}
                    ${opt.type === 'aggressive' ? 'border-red-900/50 bg-red-900/20 hover:bg-red-900/40 text-red-200 hover:border-red-500' : ''}
                    ${opt.type === 'empathetic' ? 'border-blue-900/50 bg-blue-900/20 hover:bg-blue-900/40 text-blue-200 hover:border-blue-500' : ''}
                  `}
                >
                  <span className={`
                    absolute left-0 top-0 h-full w-1 
                    ${opt.type === 'submissive' ? 'bg-gray-500' : ''}
                    ${opt.type === 'aggressive' ? 'bg-red-600' : ''}
                    ${opt.type === 'empathetic' ? 'bg-blue-500' : ''}
                  `}></span>
                  <div className="flex flex-col pl-2">
                     <span className="text-[10px] uppercase opacity-50 font-bold mb-1 tracking-wider">
                       {opt.type === 'submissive' ? '观察 / 顺从' : opt.type === 'aggressive' ? '对抗 / 揭露' : '共情 / 唤醒'}
                     </span>
                     <span>{opt.text}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}