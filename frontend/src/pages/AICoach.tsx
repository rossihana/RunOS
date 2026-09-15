import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ArrowLeft, Trash2, Settings, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

const idemKey = () => crypto.randomUUID();

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AICoach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false); // true saat jawaban AI sedang mengalir di background
  const [streamPreview, setStreamPreview] = useState('');
  const [chatModel, setChatModel] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatWidth, setChatWidth] = useState(() => Number(localStorage.getItem('runos_chat_width')) || 896);
  const abortRef = useRef<AbortController | null>(null);

  // ── Persist streaming ke localStorage ──
  // (bug: pindah route saat chat → komponen unmount → stream & jawaban hilang.
  //  Kini: delta ditulis ke localStorage segera; saat balik ke /ai-coach, chat dilanjutkan.)
  const STREAM_KEY = 'runos_chat_streaming';
  const saveStream = (partial: string) => {
    try { localStorage.setItem(STREAM_KEY, partial); } catch { /* quota */ }
  };
  const finishStream = (full: string) => {
    try { localStorage.removeItem(STREAM_KEY); } catch { /* ignore */ }
    return full;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([
          api.get('/ai/chat/history'),
          api.get('/ai/settings'),
        ]);
        const history: Message[] = (h.data || []).map((r: any) => ({ role: r.role, content: r.content }));
        if (history.length > 0) {
          setMessages(history);
        } else {
          setMessages([{
            role: 'assistant',
            content: 'Halo! Saya **RunOS AI Coach**. Saya telah menganalisa data lari kamu belakangan ini. Ada yang ingin kamu tanyakan tentang performa atau menu latihanmu?'
          }]);
        }
        setChatModel(s.data.features?.chat || s.data.defaultModel || 'default (9router)');
      } catch (e) {
        console.error('Gagal memuat chat:', e);
        setMessages([{
          role: 'assistant',
          content: 'Halo! Saya **RunOS AI Coach**. Ada yang ingin kamu tanyakan?'
        }]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Lanjutkan stream yang sedang berjalan (saat balik ke route ini) ──
  useEffect(() => {
    const partial = localStorage.getItem(STREAM_KEY);
    if (partial === null) return; // tidak ada stream aktif
    setStreaming(true);
    setMessages(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'assistant' && !last.content) {
        next[next.length - 1] = { role: 'assistant', content: partial };
      } else {
        next.push({ role: 'assistant', content: partial });
      }
      return next;
    });
    const tick = setInterval(() => {
      const p = localStorage.getItem(STREAM_KEY);
      if (p === null) {
        // stream selesai — sinkronkan final dari history
        clearInterval(tick);
        api.get('/ai/chat/history').then(h => {
          const history: Message[] = (h.data || []).map((r: any) => ({ role: r.role, content: r.content }));
          if (history.length > 0) setMessages(history);
        }).catch(() => {});
        setStreaming(false);
        return;
      }
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: p };
        return next;
      });
    }, 400);
    return () => clearInterval(tick);
  }, [loaded]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: '' }]);
    setLoading(true);
    const updateLast = (fn: (c: string) => string) =>
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: fn(next[next.length - 1].content) };
        return next;
      });

    try {
      // Simpan tanda "stream aktif" — kalau user pindah route, komponen lain di route /ai-coach
      // akan melanjutkan tampilan stream ini dari localStorage.
      saveStream('');
      const response = await fetch(`${api.defaults.baseURL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'X-Idempotency-Key': idemKey(),
      },
      body: JSON.stringify({ message: userMessage, stream: true }),
    });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || err?.message || 'Koneksi gagal');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const evMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (!evMatch || !dataMatch) continue;
          const ev = evMatch[1].trim();
          const data = JSON.parse(dataMatch[1]);
          if (ev === 'delta') {
            full += data.text;
            saveStream(full); // persist segera — tetap hidup walau pindah route
            updateLast(c => c + data.text);
          }
          else if (ev === 'error') updateLast(() => `⚠️ ${data.message}`);
        }
      }
      finishStream(full);
    } catch (error: any) {
      console.error('Failed to chat with AI:', error);
      const msg = error?.message || 'Maaf, saya sedang mengalami gangguan koneksi. Bisa coba lagi nanti?';
      finishStream('');
      updateLast(c => c ? c : `⚠️ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Hapus semua riwayat percakapan?')) return;
    try { await api.delete('/ai/chat/history'); } catch { /* ignore */ }
    setMessages([{
      role: 'assistant',
      content: 'Riwayat dihapus. Mau tanya apa hari ini?'
    }]);
  };

  // ── Resize: drag handle di tepi kiri ──
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(Math.max(560, startW + (startX - ev.clientX)), window.innerWidth - 60);
      setChatWidth(w);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setChatWidth(w => {
        localStorage.setItem('runos_chat_width', String(w));
        return w;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const currentChatModel = chatModel;

  return (
    <div className="flex flex-col mx-auto" style={{ width: chatWidth, maxWidth: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="hidden md:block w-1.5 h-10 rounded-full cursor-col-resize bg-zinc-200 dark:bg-zinc-800 hover:bg-orange-400 dark:hover:bg-orange-600 transition-colors"
            title="Tarik untuk mengubah lebar chat"
          />
          <Link to="/" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              AI Coach <Sparkles className="w-5 h-5 text-orange-500 fill-orange-500" />
            </h1>
            <p className="text-sm text-zinc-500 truncate max-w-[280px]" title={currentChatModel}>Model: {currentChatModel}</p>
          {streaming && (
            <p className="text-[10px] text-emerald-500 flex items-center gap-1 font-bold uppercase tracking-wider">
              <Radio className="w-3 h-3 animate-pulse" /> AI sedang menulis… (tetap lanjut walau pindah halaman)
            </p>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/ai-settings"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="Pengaturan AI: model per fitur & provider sendiri"
          >
            <Settings className="w-4 h-4" /> Pengaturan AI
          </Link>
          <button
            onClick={handleClear}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Hapus riwayat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="h-[calc(100vh-160px)] bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loaded && messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const showDots = loading && isLast && m.role === 'assistant' && m.content === '';
            return (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'user' ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
                  }`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-orange-600 text-white font-medium rounded-tr-none'
                      : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-800 rounded-tl-none'
                  }`}>
                    {showDots ? (
                      <div className="flex gap-1 py-1">
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <div className="prose dark:prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Tanya Coach tentang lari kamu..."
              className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white pl-4 pr-12 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-medium border-transparent focus:bg-white dark:focus:bg-zinc-700"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-2 p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-center text-zinc-400 uppercase font-bold tracking-widest">
            AI can make mistakes. Always listen to your body first.
          </p>
        </div>
      </div>
    </div>
  );
}
