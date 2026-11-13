/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import Layout, { Tab } from "./components/Layout";
import ChatSection from "./components/ChatSection";
import VoiceAgentSection from "./components/VoiceAgentSection";
import DraftingSection from "./components/DraftingSection";
import DocumentIntelligenceSection from "./components/DocumentIntelligenceSection";
import GovernmentServicesSection from "./components/GovernmentServicesSection";
import CivicIssuesSection from "./components/CivicIssuesSection";
import CommunitySection from "./components/CommunitySection";
import AdminDashboardSection from "./components/AdminDashboardSection";
import DashboardSection from "./components/DashboardSection";
import LearningSection from "./components/LearningSection";
import LegalAidSection from "./components/LegalAidSection";
import FloatingAgent from "./components/FloatingAgent";
import PolicyPage, { type PolicyPageId } from "./components/PolicyPage";
import type { AppRoute } from "./config/appRoutes";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [policyPage, setPolicyPage] = useState<PolicyPageId | null>(null);
  // Opening Legal Chat from navigation must reveal the chat screen; the landing
  // page is only the default composition while no conversation is open.
  const [chatOpenSignal, setChatOpenSignal] = useState(0);

  // F13: deep-link focus state driven by the Legal Agent's navigation chips
  const [learningFocusId, setLearningFocusId] = useState<string | null>(null);
  const [legalaidFocusTab, setLegalaidFocusTab] = useState<'directory' | 'process' | 'aid' | null>(null);
  const [draftFocusMode, setDraftFocusMode] = useState<'analyze' | 'draft' | null>(null);

  const handleOpenChat = (id: string) => {
    setActiveChatId(id);
    setChatOpenSignal(n => n + 1);
    setActiveTab('chat');
  };

  // Manual nav (header/footer) resets any one-shot deep-link focus.
  const handleTabChange = (tab: Tab) => {
    setPolicyPage(null);
    setLearningFocusId(null);
    setLegalaidFocusTab(null);
    setDraftFocusMode(null);
    if (tab === 'chat') setChatOpenSignal(n => n + 1);
    setActiveTab(tab);
  };

  // Every primary-feature change starts at the destination's own top, even when
  // the user clicked from the footer. Modals and in-page anchors are untouched.
  // Policy pages are full screens too: without this, the footer's scroll
  // position left their "Back" control underneath the sticky header on phones.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, chatOpenSignal, learningFocusId, legalaidFocusTab, draftFocusMode, policyPage]);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);

  // F13: Legal Agent deep-links. Only registry routes are used (never invented URLs).
  // F14: "Open in Insaaf AI Library" deep-links to a specific verified library section.
  const handleOpenLibrary = (sectionId: string) => {
    setPolicyPage(null);
    setLearningFocusId(sectionId);
    setLegalaidFocusTab(null);
    setDraftFocusMode(null);
    setActiveTab('learning');
  };

  const handleOpenLegalAid = (tab: 'directory' | 'process' | 'aid') => {
    setPolicyPage(null);
    setLearningFocusId(null);
    setDraftFocusMode(null);
    setLegalaidFocusTab(tab);
    setActiveTab('legalaid');
  };

  const handleAgentNavigate = (route: AppRoute) => {
    if (route.target === 'settings') {
      window.dispatchEvent(new Event('insaaf_open_settings'));
      return;
    }
    if (route.tab === 'learning') {
      setLearningFocusId(null); // library overview; no specific domain targeted
      setLegalaidFocusTab(null);
      setDraftFocusMode(null);
    } else if (route.tab === 'legalaid') {
      setLegalaidFocusTab((route.target as 'directory' | 'process' | 'aid') || 'directory');
      setLearningFocusId(null);
      setDraftFocusMode(null);
    } else if (route.tab === 'draft') {
      setDraftFocusMode((route.target as 'analyze' | 'draft') || 'draft');
      setLearningFocusId(null);
      setLegalaidFocusTab(null);
    } else {
      setLearningFocusId(null);
      setLegalaidFocusTab(null);
      setDraftFocusMode(null);
    }
    setActiveTab(route.tab);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleTabChange} onOpenLibrary={handleOpenLibrary} onOpenLegalAid={handleOpenLegalAid} onOpenPolicy={setPolicyPage}>
      {policyPage ? (
        <PolicyPage
          page={policyPage}
          onBack={() => setPolicyPage(null)}
        />
      ) : (<>
      {/* Chat stays MOUNTED across tab switches (state survives; the inactive
          mode renders nothing) so history is never lost, while the DOM never
          holds two copies of the search field or topic directory. */}
      <div className={activeTab === 'chat' ? '' : 'hidden'}>
        <ChatSection chatMode="legal" isActive={activeTab === 'chat'} activeChatId={activeChatId} openChatSignal={chatOpenSignal} onChatLoaded={() => setActiveChatId(null)} onOpenLibrary={handleOpenLibrary} onNavigate={(tab) => handleTabChange(tab as Tab)} />
      </div>
      <div className={activeTab === 'islamic' ? '' : 'hidden'}>
        <ChatSection chatMode="islamic" isActive={activeTab === 'islamic'} onOpenLibrary={handleOpenLibrary} onNavigate={(tab) => handleTabChange(tab as Tab)} />
      </div>
      {/* Voice Agent stays MOUNTED across tab switches for the same reason: an
          active listening/speaking session must not be killed by navigating. */}
      <div className={activeTab === 'voice' ? '' : 'hidden'}>
        <VoiceAgentSection onNavigate={handleAgentNavigate} />
      </div>
      {activeTab === 'draft' && <DraftingSection onNavigate={handleTabChange} focusMode={draftFocusMode} />}
      {activeTab === 'docintel' && <DocumentIntelligenceSection onNavigateToDrafting={(mode) => { setDraftFocusMode(mode || 'analyze'); setActiveTab('draft'); }} />}
      {activeTab === 'gov' && (
        <GovernmentServicesSection
          onNavigate={(tab) => setActiveTab(tab as Tab)}
          onOpenLibrary={(sectionId) => handleOpenLibrary(sectionId)}
          onOpenDrafting={() => { setDraftFocusMode('draft'); setActiveTab('draft'); }}
          onOpenDocumentAssistant={() => setActiveTab('docintel')}
        />
      )}
      {activeTab === 'learning' && <LearningSection focusSectionId={learningFocusId} />}
      {/* Civic Issues stays mounted so an unfinished report draft is not lost on navigation. */}
      <div className={activeTab === 'civic' ? '' : 'hidden'}>
        <CivicIssuesSection
          onNavigate={(tab) => setActiveTab(tab as Tab)}
          onOpenDrafting={() => { setDraftFocusMode('draft'); setActiveTab('draft'); }}
        />
      </div>
      {/* Community stays mounted across tab switches so a half-written post is not lost. */}
      <div className={activeTab === 'community' ? '' : 'hidden'}>
        <CommunitySection />
      </div>
      {activeTab === 'admin' && <AdminDashboardSection />}
      {activeTab === 'legalaid' && <LegalAidSection initialTab={legalaidFocusTab || undefined} />}
      {activeTab === 'vault' && <DashboardSection onOpenChat={handleOpenChat} />}

      {/* Part U: the Legal Agent is a floating widget available across every tab
          (no longer a full-size tab). It stays mounted so its history persists. */}
      <FloatingAgent onNavigate={handleAgentNavigate} onOpenLibrary={handleOpenLibrary} />
      </>)}
    </Layout>
  );
}
