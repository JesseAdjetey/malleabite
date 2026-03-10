// Renders rich elements inside an AI message bubble
import React from "react";
import type { RichMessage, ActionCardData, SuggestionChip } from "./rich-message-types";
import { ActionCard } from "./ActionCard";
import { SuggestionChips } from "./SuggestionChips";
import { ActionProgress } from "./ActionProgress";
import { ConfirmPrompt } from "./ConfirmPrompt";
import { StreamingText } from "./StreamingText";
import { ExpandableSectionList } from "./ExpandableSection";
import { GuidedFlow } from "./GuidedFlow";

interface RichMessageRendererProps {
  message: RichMessage;
  isLastAiMessage: boolean;
  onSuggestionSelect: (chip: SuggestionChip) => void;
  onUndoAction?: (card: ActionCardData) => void;
  onApproveAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
  onApproveAll?: () => void;
  onGuidedFlowSelect?: (optionId: string, prompt: string) => void;
  onGuidedFlowSubmitMulti?: (optionIds: string[]) => void;
}

export const RichMessageRenderer: React.FC<RichMessageRendererProps> = ({
  message,
  isLastAiMessage,
  onSuggestionSelect,
  onUndoAction,
  onApproveAction,
  onRejectAction,
  onApproveAll,
  onGuidedFlowSelect,
  onGuidedFlowSubmitMulti,
}) => {
  return (
    <>
      {/* Text content — streaming or static */}
      {message.isLoading ? null : (
        message.isStreaming ? (
          <StreamingText text={message.text} complete={false} />
        ) : (
          <span className="whitespace-pre-wrap">{message.text}</span>
        )
      )}

      {/* Expandable sections (schedule/list responses) */}
      {message.expandableSections && message.expandableSections.length > 0 && (
        <ExpandableSectionList sections={message.expandableSections} />
      )}

      {/* Guided flow (multi-step wizard) */}
      {isLastAiMessage && message.guidedFlow && onGuidedFlowSelect && (
        <GuidedFlow
          flow={message.guidedFlow}
          onSelectOption={onGuidedFlowSelect}
          onSubmitMulti={onGuidedFlowSubmitMulti}
        />
      )}

      {/* Action progress (multi-step indicator) */}
      {message.actionProgress && message.actionProgress.length > 0 && (
        <ActionProgress steps={message.actionProgress} />
      )}

      {/* Action cards (created events, todos, etc.) */}
      {message.actionCards && message.actionCards.length > 0 && (
        <div className="space-y-1">
          {message.actionCards.map(card => (
            <ActionCard key={card.id} card={card} onUndo={onUndoAction} />
          ))}
        </div>
      )}

      {/* Pending action confirmations */}
      {message.pendingActions && message.pendingActions.length > 0 && onApproveAction && onRejectAction && onApproveAll && (
        <ConfirmPrompt
          actions={message.pendingActions}
          onApprove={onApproveAction}
          onReject={onRejectAction}
          onApproveAll={onApproveAll}
        />
      )}

      {/* Suggestion chips — only on the latest AI message */}
      {isLastAiMessage && message.suggestions && message.suggestions.length > 0 && (
        <SuggestionChips chips={message.suggestions} onSelect={onSuggestionSelect} />
      )}
    </>
  );
};
