/**
 * Unified Entity Link System — barrel export
 */

// Core types
export type {
  EntityType,
  LinkRelation,
  LinkSyncRules,
  EntityLink,
  CreateEntityLinkInput,
  UpdateEntityLinkInput,
  EntityLinkQuery,
  ResolvedEntityLink,
  EntityRef,
} from './types';

export {
  DEFAULT_SYNC_RULES,
  ENTITY_LINKS_COLLECTION,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_ICONS,
  ENTITY_TYPE_COLORS,
} from './types';

// Service layer
export {
  createEntityLink,
  getLinksForEntity,
  subscribeToUserLinks,
  subscribeToEntityLinks,
  getEntityRefsFromLinks,
  updateEntityLink,
  updateLinkTitles,
  removeEntityLink,
  removeAllLinksForEntity,
  findLinksBetweenTypes,
} from './service';

// Sync engine
export type { EntityUpdaters } from './sync';
export {
  syncTitleChange,
  syncTimeChange,
  syncCompletionChange,
  getCascadeDeleteTargets,
} from './sync';
