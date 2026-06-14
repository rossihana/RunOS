import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AICoach() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: 'Halo! Saya **RunOS AI Coach**. Saya telah menganalisa data lari kamu belakangan ini. Ada yang ingin kamu tanyakan tentang performa atau menu latihanmu?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await api.post('/ai/chat', { message: userMessage });
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Failed to chat with AI:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, saya sedang mengalami gangguan koneksi. Bisa coba lagi nanti?' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              AI Coach <Sparkles className="w-5 h-5 text-orange-500 fill-orange-500" />
            </h1>
            <p className="text-sm text-zinc-500">Analitik tapi Mendukung • Powered by Gemini</p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
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
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 flex items-center justify-center animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-800">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
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
