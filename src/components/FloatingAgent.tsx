/**
 * Part U: FLOATING LEGAL AGENT.
 *
 * The Legal Agent is no longer a full-size tab. It lives in a floating circular
 * button that is always accessible across the whole application. Clicking it
 * opens a mobile-sized popup panel:
 *   - Desktop: compact floating panel anchored bottom-right.
 *   - Mobile:  near full-screen app-style panel.
 *
 * The embedded AgentSection stays MOUNTED for the lifetime of the app (the panel
 * is shown/hidden with CSS, never unmounted) so the agent conversation history
 * is preserved exactly like the main chat. All agent capabilities (Part V) and
 * registry-only route navigation (Part W) are reused unchanged.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, X } from "lucide-react";
import AgentSection from "./AgentSection";
import { getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import type { AppRoute } from "../config/appRoutes";
import { cn } from "./Layout";

export default function FloatingAgent({
  onNavigate,
  onOpenLibrary,
}: {
  onNavigate: (route: AppRoute) => void;
  onOpenLibrary?: (sectionId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = getCurrentLanguage();
  const rom = currentLang === "roman_urdu";
  useLanguageVersion();

  const label = (en: string, roman: string) => (rom ? roman : en);

  // When the agent navigates somewhere, close the panel first, then route.
  const handleNavigate = useCallback(
    (route: AppRoute) => {
      setIsOpen(false);
      onNavigate(route);
    },
    [onNavigate]
  );

  const handleOpenLibrary = useCallback(
    (sectionId: string) => {
      setIsOpen(false);
      onOpenLibrary?.(sectionId);
    },
    [onOpenLibrary]
  );

  return (
    <>
      {/* Floating panel — kept mounted, toggled with CSS so history persists. */}
      <div
        className={cn(
          "fixed z-[95] flex flex-col bg-[#F9FAFB] shadow-2xl border border-gray-200 overflow-hidden transition-all duration-200",
          // Desktop: compact panel anchored above the button.
          "sm:bottom-24 sm:right-6 sm:w-[400px] sm:h-[600px] sm:max-h-[80vh] sm:rounded-3xl",
          // Mobile: near full-screen app-style panel.
          "bottom-0 right-0 left-0 top-0 sm:top-auto sm:left-auto rounded-none sm:rounded-3xl",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto visible"
            : "opacity-0 translate-y-4 pointer-events-none invisible"
        )}
        role="dialog"
        aria-label={label("INSAaf Legal Agent", "INSAaf Qanooni Agent")}
        aria-hidden={!isOpen}
      >
        {/* Panel header (mobile gets its own bar; desktop uses the embedded header) */}
        <div className="sm:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#01411C] rounded-xl flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black text-gray-900">
              {label("INSAaf Legal Agent", "INSAaf Qanooni Agent")}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label={label("Close agent", "Agent band karen")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop close button floats over the embedded header */}
        <button
          onClick={() => setIsOpen(false)}
          className="hidden sm:flex absolute top-4 right-4 w-8 h-8 rounded-full items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors z-10"
          aria-label={label("Close agent", "Agent band karen")}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Embedded agent fills the panel body */}
        <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-5">
          <AgentSection
            embedded
            onNavigate={handleNavigate}
            onOpenLibrary={handleOpenLibrary}
          />
        </div>
      </div>

      {/* Floating action button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[96] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#01411C] text-white shadow-2xl shadow-[#01411C]/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            aria-label={label("Open Legal Agent", "Qanooni Agent kholein")}
            title={label("INSAaf Legal Agent", "INSAaf Qanooni Agent")}
          >
            <Bot className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
