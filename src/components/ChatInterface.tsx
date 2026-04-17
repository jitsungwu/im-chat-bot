import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Loader2, Info, ChevronRight, MessageSquare, Key, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { chatWithGemini } from '../services/geminiService';
import { quotaService } from '../services/quotaService';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: '嗨！我是輔大資管的諮詢小助手。如果你有關於系所特色、課程、招生或是未來發展的問題，都可以問我喔！😊',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [userApiKey, setUserApiKey] = useState('');
  const [currentModel, setCurrentModel] = useState<string>('gemini-3.1-flash-lite-preview');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quota, setQuota] = useState({
    remaining: quotaService.getRemainingQuota(),
    total: quotaService.getMaxQuota()
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 初始化額度
    setQuota({
      remaining: quotaService.getRemainingQuota(),
      total: quotaService.getMaxQuota()
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    /* 
    if (!quotaService.hasQuota() && !userApiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }
    */

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.concat(userMessage).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const result = await chatWithGemini(chatHistory, userApiKey);
      const { text: response, model: usedModel } = result;
      setCurrentModel(usedModel);
      
      // 如果沒有使用自定義 API Key，才扣除額度
      if (!userApiKey) {
        quotaService.incrementUsage();
        setQuota({
          remaining: quotaService.getRemainingQuota(),
          total: quotaService.getMaxQuota()
        });
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response || '抱歉，我現在無法回答這個問題。',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      console.error('Chat Error:', error);
      
      // 偵測是否為額度用盡 (429)
      const errorString = error?.message || String(error);
      const isQuotaExceeded = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');

      if (isQuotaExceeded && !userApiKey) {
        // setIsApiKeyModalOpen(true);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: '⚠️ **目前系統諮詢額度已滿 (API 429 Error)**\n\n偵測到 API 限制，但目前為除錯模式，不主動要求輸入 Key。',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: '哎呀，發生了一些錯誤（可能與您的 API Key 有關），請檢查後再試。',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg-gray overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] bg-primary-blue text-white p-8 flex flex-col gap-6 hidden lg:flex flex-shrink-0">
        <div className="border-b border-white/10 pb-5">
          <h1 className="text-xl font-bold tracking-wider">輔仁大學資訊管理學系</h1>
          <p className="text-xs opacity-70 mt-1 uppercase tracking-tighter italic">High School Q&A Assistant</p>
        </div>
        
        <div className="space-y-6">
          <div className="nav-group">
            <h3 className="text-[10px] uppercase opacity-50 tracking-[1.5px] mb-3">問題分類</h3>
            <div className="space-y-1">
              <div 
                onClick={() => setInput('我想了解輔大資管的招生管道與入學要求')}
                className={cn(
                  "nav-item flex items-center gap-3 p-3 rounded-lg text-sm transition-colors cursor-pointer",
                  input === '我想了解輔大資管的招生管道與入學要求' ? "bg-white/20 font-semibold" : "bg-transparent hover:bg-white/5 opacity-80"
                )}
              >
                <span className="text-lg">📋</span> 招生與入學
              </div>
              <div 
                onClick={() => setInput('輔大資管有哪些特色課程與學程？')}
                className={cn(
                  "nav-item flex items-center gap-3 p-3 rounded-lg text-sm transition-colors cursor-pointer",
                  input === '輔大資管有哪些特色課程與學程？' ? "bg-white/20 font-semibold" : "bg-transparent hover:bg-white/5 opacity-80"
                )}
              >
                <span className="text-lg">📖</span> 課程與學程
              </div>
              <div 
                onClick={() => setInput('畢業後的職場競爭力與就業發展如何？')}
                className={cn(
                  "nav-item flex items-center gap-3 p-3 rounded-lg text-sm transition-colors cursor-pointer",
                  input === '畢業後的職場競爭力與就業發展如何？' ? "bg-white/20 font-semibold" : "bg-transparent hover:bg-white/5 opacity-80"
                )}
              >
                <span className="text-lg">🎓</span> 就業與發展
              </div>
              <div 
                onClick={() => setInput('輔大資管的學生生活、社團與實習機會多嗎？')}
                className={cn(
                  "nav-item flex items-center gap-3 p-3 rounded-lg text-sm transition-colors cursor-pointer",
                  input === '輔大資管的學生生活、社團與實習機會多嗎？' ? "bg-white/20 font-semibold" : "bg-transparent hover:bg-white/5 opacity-80"
                )}
              >
                <span className="text-lg">🎉</span> 學生生活與社團
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-5 border-t border-white/10 space-y-4">
          <div className="px-2 mb-2">
            <h3 className="text-[10px] uppercase opacity-50 tracking-[1.5px] mb-3">存取狀態</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  userApiKey ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-accent-gold shadow-[0_0_8px_rgba(255,191,41,0.5)]"
                )} />
                <span className="text-xs font-medium">
                  {userApiKey ? "個人 API 連線中" : "系統分配連線中"}
                </span>
                {userApiKey && (
                  <button 
                    onClick={() => setUserApiKey('')}
                    className="ml-auto text-[10px] bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded transition-colors"
                    title="清除個人 Key"
                  >
                    重設
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 px-1">
                <Bot size={12} className="opacity-50" />
                <span className="text-[10px] font-mono opacity-60 truncate max-w-[150px]">
                  {currentModel}
                </span>
              </div>
            </div>
          </div>

            {/* Quota Display */}
            <div className="bg-white/10 rounded-xl p-4 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500 text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-tighter">Debug Mode</div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase opacity-60 tracking-wider">
                  {userApiKey ? "個人額度狀態" : "每日免費諮詢額度"}
                </span>
                <span className="text-xs font-bold text-accent-gold">
                  {userApiKey ? "無限制" : "除錯模式 (無限制)"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full bg-green-400 transition-all duration-500"
                />
              </div>
              <div className="flex justify-between text-[9px] opacity-40">
                <span>目前已用: {quota.total - quota.remaining}</span>
                <span>上限: {quota.total}</span>
              </div>
              <p className="text-[9px] mt-3 opacity-50 leading-relaxed italic border-t border-white/5 pt-2">
                {userApiKey 
                  ? "您正在使用自己的 Key，不受系統公共額度限制。" 
                  : "目前為除錯模式，已暫時解除 30 次的使用限制。"}
              </p>
            </div>

          <a href="https://www.im.fju.edu.tw/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg text-sm hover:bg-white/5 cursor-pointer opacity-80">
            <span className="text-lg">🌐</span> 官方網站
          </a>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {/* API Key Modal - 偵錯模式暫時關閉
      <AnimatePresence>
        {isApiKeyModalOpen && (
          ...
        )}
      </AnimatePresence>
      */}

      {/* About Modal */}
        <AnimatePresence>
          {isInfoOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsInfoOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold mb-4 flex items-center text-primary-blue">
                  <Info className="mr-2 text-accent-gold" />
                  關於此機器人
                </h2>
                <p className="text-text-dark text-sm mb-6 leading-relaxed">
                  本機器人由 輔仁大學資訊管理學系 (FJU IM) 提供，旨在協助高中生解決招生與系所相關之疑問。
                  <br /><br />
                  所有回覆均參考系所官方網站資料並結合 AI 技術生成。如果您有更精密的問題，請參考官網或直接聯繫系辦公室。
                </p>
                <button
                  onClick={() => setIsInfoOpen(false)}
                  className="w-full py-3 bg-primary-blue text-white rounded-xl font-medium shadow-lg hover:brightness-110 transition-all"
                >
                  我知道了
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="h-20 border-b border-border-color px-6 md:px-10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 font-medium text-sm text-text-dark">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm shadow-green-200" />
                <span className="hidden xs:inline">資管系線上諮詢服務</span>
              </div>
              <span className="text-[9px] font-mono opacity-40 ml-4 hidden sm:block">
                Engine: {currentModel}
              </span>
            </div>
            {/* Mobile usage indicator */}
            <div className="lg:hidden flex items-center gap-1.5 bg-bg-gray px-2.5 py-1 rounded-full border border-border-color">
              <span className="text-[9px] font-bold text-text-light uppercase">額度</span>
              <span className="text-[10px] font-bold text-primary-blue">
                {userApiKey ? "∞" : `${quota.remaining}/${quota.total}`}
              </span>
            </div>
          </div>
          <div className="font-serif italic text-accent-gold font-bold text-lg hidden md:block">
            Information Management
          </div>
          <button 
            onClick={() => setIsInfoOpen(true)}
            className="p-2 text-text-light hover:bg-bg-gray rounded-full transition-colors lg:hidden"
          >
            <Info size={20} />
          </button>
        </header>

        {/* Chat Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scrollbar-hide">
          <div className="max-w-4xl mx-auto space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex flex-col max-w-[85%] md:max-w-[75%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "px-5 py-4 rounded-xl text-[15px] leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-primary-blue text-white rounded-br-none" 
                      : "bg-bg-gray text-text-dark rounded-bl-none border border-border-color"
                  )}>
                    <div className={cn("markdown-body", msg.role === 'user' ? "prose-invert" : "")}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.role === 'model' && msg.id === '1' && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {['系所特色是什麼？', '資管跟資工有什麼差別？', '需要很強的數學基礎嗎？'].map((q) => (
                          <button
                            key={q}
                            onClick={() => setInput(q)}
                            className="px-4 py-2 border border-primary-blue rounded-full text-xs text-primary-blue bg-white hover:bg-primary-blue/[0.03] transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={cn(
                    "text-[11px] mt-1.5 text-text-light",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center space-x-2 text-text-light text-xs italic"
              >
                <Loader2 className="animate-spin text-accent-gold" size={14} />
                <span>專員正在整理資料...</span>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Suggested Questions (Bottom bar) */}
        {!isLoading && messages.length > 2 && (
          <div className="px-6 md:px-10 py-3 border-t border-border-color bg-white flex-shrink-0">
            <div className="max-w-4xl mx-auto flex space-x-2 overflow-x-auto scrollbar-hide py-1">
              {['系所特色', '招生管道', '畢業出路', '程式基礎', '數學能力'].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-4 py-1.5 border border-primary-blue rounded-full text-[13px] text-primary-blue whitespace-nowrap hover:bg-primary-blue/5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <footer className="p-6 md:p-10 border-t border-border-color bg-white flex-shrink-0">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-4 h-14">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="請輸入您的問題，例如：學測成績要求..."
              className="flex-1 px-6 bg-bg-gray border border-border-color rounded-xl focus:outline-none focus:ring-[1.5px] focus:ring-primary-blue/30 focus:border-primary-blue transition-all text-sm text-text-dark"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                "px-6 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2",
                input.trim() && !isLoading 
                  ? "bg-primary-blue text-white shadow-md hover:brightness-110 active:scale-95" 
                  : "bg-border-color text-text-light opacity-50 cursor-not-allowed"
              )}
            >
              <Send size={18} />
              <span className="hidden sm:inline">發送訊息</span>
            </button>
          </form>
          <p className="text-[10px] text-center text-text-light mt-4 leading-relaxed">
            © 2026 輔仁大學資訊管理學系 · 高中生專業諮詢平台
          </p>
        </footer>
      </div>
    </div>
  );
}
