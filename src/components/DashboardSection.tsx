import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { FileText, MessageSquare, Trash2, ChevronRight, Clock, Scale, Lock, ShieldAlert } from "lucide-react";
import { cn } from "./Layout";
import { StorageService, LocalChat, LocalDraft } from "../services/storage";
import { FirestoreService } from "../services/firestoreService";
import { getTranslations, getCurrentLanguage, useLanguageVersion } from "../lib/i18n";

export default function DashboardSection({ onOpenChat }: { onOpenChat?: (id: string) => void }) {
  const { user, setShowLoginModal } = useAuth();
  const t = getTranslations(getCurrentLanguage());
  useLanguageVersion(); // re-render when the system language changes
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [chats, setChats] = useState<LocalChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      if (user) {
        try {
          const [loadedDrafts, loadedChats] = await Promise.all([
            FirestoreService.getDrafts(user.uid),
            FirestoreService.getChats(user.uid)
          ]);
          if (isMounted) {
            setDrafts(loadedDrafts);
            setChats(loadedChats);
          }
        } catch (err) {
          console.error("Error loading Vault data from Firestore:", err);
        }
      } else {
        if (isMounted) {
          setDrafts(StorageService.getDrafts());
          setChats(StorageService.getChats());
        }
      }
      if (isMounted) setLoading(false);
    };

    loadData();
    return () => { isMounted = false; };
  }, [user]);

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm(t.vaultDeleteDraftConfirm)) return;
    if (user) {
      try {
        await FirestoreService.deleteDraft(user.uid, id);
      } catch (err) {
        console.error("Error deleting draft:", err);
      }
    } else {
      StorageService.deleteDraft(id);
    }
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const handleDeleteChat = async (id: string) => {
    if (!window.confirm(t.vaultDeleteChatConfirm)) return;
    if (user) {
      try {
        await FirestoreService.deleteChat(user.uid, id);
      } catch (err) {
        console.error("Error deleting chat:", err);
      }
    } else {
      StorageService.deleteChat(id);
    }
    setChats(prev => prev.filter(c => c.id !== id));
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col items-center gap-6"
        >
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center animate-pulse">
            <Lock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-bold text-gray-900 leading-tight">{t.vaultProtectedTitle}</h3>
            <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
              {t.vaultProtectedDesc}
            </p>
          </div>
          <div className="flex gap-4 pt-4">
             <button 
               onClick={() => setShowLoginModal(true)}
               className="px-8 py-4 bg-[#01411C] text-white font-bold rounded-2xl shadow-xl shadow-[#01411C]/20 hover:scale-105 transition-all text-xs"
             >
               {t.vaultLoginBtn}
             </button>
             <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 rounded-xl">
               <ShieldAlert className="w-4 h-4" />
               {t.vaultGuestMode}
             </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01411C]"></div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Drafts Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-[#01411C] w-5 h-5" />
            {t.vaultSavedDrafts}
          </h3>
          <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">{drafts.length}</span>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {drafts.length === 0 ? (
              <div className="bg-white p-12 rounded-[2rem] border border-dashed border-gray-200 text-center space-y-3">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-300">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm text-gray-500">{t.vaultNoDrafts}</p>
                <p className="text-xs text-gray-400">{getCurrentLanguage() === 'roman_urdu' ? 'Drafting tab se naye dastawez banayen' : 'Create new documents from the Drafting tab'}</p>
              </div>
            ) : (
              drafts.map((draft) => (
                <motion.div
                  key={draft.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-900 group-hover:text-[#01411C] transition-colors">{draft.templateTitle || draft.templateKey}</h4>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(draft.createdAt).toLocaleDateString('en-PK')}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteDraft(draft.id)}
                      aria-label={t.deleteItem}
                      title={t.deleteItem}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 line-clamp-2 italic">
                    {draft.content.substring(0, 150)}...
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="text-[#01411C] w-5 h-5" />
            {t.vaultSavedChats}
          </h3>
          <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">{chats.length}</span>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {chats.length === 0 ? (
              <div className="bg-white p-12 rounded-[2rem] border border-dashed border-gray-200 text-center space-y-3">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-300">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-sm text-gray-500">{t.vaultNoChats}</p>
                <p className="text-xs text-gray-400">{getCurrentLanguage() === 'roman_urdu' ? 'Chat tab mein apne sawaal poochhen' : 'Ask your questions in the Chat tab'}</p>
              </div>
            ) : (
              chats.map((chat) => (
                <motion.div
                  key={chat.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onOpenChat?.(chat.id)}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md cursor-pointer transition-all group flex items-center gap-4 py-6"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-[#01411C]">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 truncate">{chat.title || t.vaultDefaultQueryTitle}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                      {t.vaultLastUpdated} {new Date(chat.updatedAt).toLocaleDateString('en-PK')}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                      aria-label={t.deleteItem}
                      title={t.deleteItem}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="p-2 text-[#01411C]">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
