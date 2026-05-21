/**
 * Canvas LMS Integration Firebase Functions
 *
 * Architecture:
 *   - User provides their Canvas base URL + personal API token
 *   - Token stored AES-256-GCM encrypted in users/{uid}/integrations/canvas
 *   - Courses + assignments synced to users/{uid}/canvas_courses + users/{uid}/canvas_assignments
 *   - Canvas is read-only source of truth (assignments come from Canvas)
 *   - Sync runs on-demand (connect, manual refresh, scheduled)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

// ─── Secret ───────────────────────────────────────────────────────────────────

const canvasEncryptionKey = defineSecret('CANVAS_TOKEN_ENCRYPTION_KEY');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(canvasEncryptionKey.value()).digest();
}

function encryptString(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptString(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Invalid encrypted token payload');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function integrationDoc(uid: string) {
  return getDb().collection('users').doc(uid).collection('integrations').doc('canvas');
}

function coursesCol(uid: string) {
  return getDb().collection('users').doc(uid).collection('canvas_courses');
}

function assignmentsCol(uid: string) {
  return getDb().collection('users').doc(uid).collection('canvas_assignments');
}

function announcementsCol(uid: string) {
  return getDb().collection('users').doc(uid).collection('canvas_announcements');
}

// ─── Canvas API fetch helper ──────────────────────────────────────────────────

async function canvasFetch(baseUrl: string, token: string, path: string): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `${baseUrl.replace(/\/$/, '')}/api/v1${path}?per_page=50`;

  while (url) {
    const fetchRes: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      throw new Error(`Canvas API error ${fetchRes.status}: ${text}`);
    }

    const data: unknown = await fetchRes.json();
    if (Array.isArray(data)) results.push(...data);

    // Handle Canvas pagination via Link header
    const linkHeader: string = fetchRes.headers.get('link') || '';
    const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return results;
}

// ─── Sync logic (shared between connect and periodic sync) ────────────────────

async function performSync(uid: string, baseUrl: string, token: string): Promise<{
  courseCount: number;
  assignmentCount: number;
  announcementCount: number;
  failedCourseCount: number;
}> {
  const db = getDb();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  // 1. Fetch enrollments tagged "active" by Canvas, then filter further locally.
  //    Canvas keeps non-academic shells (graduation-clearance, advising, etc.)
  //    in "active" indefinitely, so we drop anything whose term has ended.
  const rawCourses = await canvasFetch(baseUrl, token, '/courses?enrollment_state=active&include[]=term');
  const courses = rawCourses.filter((c: any) => {
    if (c.access_restricted_by_date) return false;
    if (c.workflow_state === 'completed' || c.workflow_state === 'deleted') return false;
    const termEnd = c.term?.end_at ? Date.parse(c.term.end_at) : NaN;
    // Keep if no term end (open-ended) or term hasn't ended yet.
    if (!Number.isNaN(termEnd) && termEnd < nowMs) return false;
    return true;
  });

  // 2. Upsert courses (preserving stable colors by hashing course id)
  const COURSE_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];
  const colorFor = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return COURSE_COLORS[h % COURSE_COLORS.length];
  };

  const coursesBatch = db.batch();
  const courseColorMap: Record<string, string> = {};
  const keptCourseIds = new Set<string>();

  for (const c of courses) {
    const id = String(c.id);
    keptCourseIds.add(id);
    const color = colorFor(id);
    courseColorMap[id] = color;
    coursesBatch.set(coursesCol(uid).doc(id), {
      id,
      name: c.name || c.course_code || 'Unnamed Course',
      courseCode: c.course_code || '',
      color,
      term: c.term?.name || null,
      termEndAt: c.term?.end_at || null,
      syncedAt: now,
    }, { merge: true });
  }
  await coursesBatch.commit();

  // 2b. Delete any locally cached courses that no longer pass the filter.
  const existingCoursesSnap = await coursesCol(uid).get();
  const removedCourseIds: string[] = [];
  const deleteCoursesBatch = db.batch();
  existingCoursesSnap.forEach(doc => {
    if (!keptCourseIds.has(doc.id)) {
      removedCourseIds.push(doc.id);
      deleteCoursesBatch.delete(doc.ref);
    }
  });
  if (removedCourseIds.length > 0) await deleteCoursesBatch.commit();

  // 3. Fetch assignments per course (skip unpublished server-side)
  let totalAssignments = 0;
  let failedCourseCount = 0;
  const keptAssignmentIds = new Set<string>();

  for (const course of courses) {
    const courseId = String(course.id);
    const courseName = course.name || course.course_code || 'Unnamed Course';
    const courseColor = courseColorMap[courseId] || '#8B5CF6';

    let rawAssignments: any[] = [];
    try {
      rawAssignments = await canvasFetch(
        baseUrl,
        token,
        `/courses/${courseId}/assignments?order_by=due_at&include[]=submission&bucket=ungraded`
      );
      // Also fetch graded/past assignments so grade history is visible.
      const graded = await canvasFetch(
        baseUrl,
        token,
        `/courses/${courseId}/assignments?order_by=due_at&include[]=submission&bucket=past`
      );
      // Dedupe by id (buckets can overlap)
      const seen = new Set(rawAssignments.map(a => String(a.id)));
      for (const a of graded) if (!seen.has(String(a.id))) rawAssignments.push(a);
    } catch (err) {
      console.warn(`[canvas] assignment fetch failed for course ${courseId}:`, err);
      failedCourseCount++;
      continue;
    }

    const assignmentsBatch = db.batch();
    for (const a of rawAssignments) {
      // Skip drafts / deleted entirely
      if (a.workflow_state && a.workflow_state !== 'published') continue;

      const id = String(a.id);
      keptAssignmentIds.add(id);
      const submission = a.submission;
      assignmentsBatch.set(assignmentsCol(uid).doc(id), {
        id,
        courseId,
        courseName,
        courseColor,
        title: a.name || 'Untitled Assignment',
        description: a.description ? stripHtml(a.description) : null,
        htmlUrl: a.html_url || null,
        dueAt: a.due_at || null,
        pointsPossible: a.points_possible ?? null,
        submissionTypes: a.submission_types || [],
        submitted: submission ? ['submitted', 'graded'].includes(submission.workflow_state) : false,
        score: submission?.score ?? null,
        workflowState: a.workflow_state || 'published',
        syncedAt: now,
      }, { merge: true });
      totalAssignments++;
    }
    await assignmentsBatch.commit();
  }

  // 3b. Delete assignments that no longer exist on Canvas OR belong to a removed course.
  const existingAssignmentsSnap = await assignmentsCol(uid).get();
  const deleteAssignmentsBatch = db.batch();
  let assignmentDeletes = 0;
  existingAssignmentsSnap.forEach(doc => {
    const data = doc.data() as { courseId?: string };
    const courseGone = data.courseId ? !keptCourseIds.has(data.courseId) : true;
    if (courseGone || !keptAssignmentIds.has(doc.id)) {
      deleteAssignmentsBatch.delete(doc.ref);
      assignmentDeletes++;
    }
  });
  if (assignmentDeletes > 0) await deleteAssignmentsBatch.commit();

  // 4. Fetch announcements across all current courses (one batched API call).
  //    Canvas's /announcements endpoint accepts multiple context_codes; we pull
  //    everything posted in the last 60 days. Existing `read` flags are
  //    preserved so a sync doesn't mark items unread again.
  let announcementCount = 0;
  const keptAnnouncementIds = new Set<string>();

  if (courses.length > 0) {
    const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const contextCodes = courses.map(c => `context_codes[]=course_${c.id}`).join('&');
    try {
      const rawAnnouncements = await canvasFetch(
        baseUrl,
        token,
        `/announcements?${contextCodes}&start_date=${encodeURIComponent(start)}`
      );

      // Fetch existing `read` flags so we don't overwrite them.
      const existingReadMap = new Map<string, boolean>();
      const existingAnnSnap = await announcementsCol(uid).get();
      existingAnnSnap.forEach(doc => {
        existingReadMap.set(doc.id, (doc.data() as { read?: boolean }).read === true);
      });

      const annBatch = db.batch();
      for (const a of rawAnnouncements) {
        const id = String(a.id);
        keptAnnouncementIds.add(id);

        // Canvas returns context_code like "course_12345"; map back to our color.
        const courseId = (a.context_code || '').replace(/^course_/, '');
        const color = courseColorMap[courseId] || '#8B5CF6';
        const courseName = courses.find(c => String(c.id) === courseId)?.name || 'Course';

        annBatch.set(announcementsCol(uid).doc(id), {
          id,
          courseId,
          courseName,
          courseColor: color,
          title: a.title || 'Untitled Announcement',
          message: a.message ? stripHtml(a.message) : '',
          htmlUrl: a.html_url || null,
          author: a.user_name || a.author?.display_name || null,
          postedAt: a.posted_at || a.created_at || null,
          read: existingReadMap.get(id) ?? false,
          syncedAt: now,
        }, { merge: true });
        announcementCount++;
      }
      if (announcementCount > 0) await annBatch.commit();
    } catch (err) {
      // Announcements failing should not fail the whole sync; log and move on.
      console.warn('[canvas] announcements fetch failed:', err);
    }

    // 4b. Delete cached announcements no longer returned OR for removed courses.
    const annSnap = await announcementsCol(uid).get();
    const deleteAnnBatch = db.batch();
    let annDeletes = 0;
    annSnap.forEach(doc => {
      const data = doc.data() as { courseId?: string };
      const courseGone = data.courseId ? !keptCourseIds.has(data.courseId) : true;
      if (courseGone || !keptAnnouncementIds.has(doc.id)) {
        deleteAnnBatch.delete(doc.ref);
        annDeletes++;
      }
    });
    if (annDeletes > 0) await deleteAnnBatch.commit();
  }

  return {
    courseCount: courses.length,
    assignmentCount: totalAssignments,
    announcementCount,
    failedCourseCount,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

// ─── canvasConnect ─────────────────────────────────────────────────────────────

export const canvasConnect = onCall(
  { secrets: [canvasEncryptionKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { baseUrl, token } = request.data as { baseUrl: string; token: string };
    if (!baseUrl?.trim() || !token?.trim()) {
      throw new HttpsError('invalid-argument', 'baseUrl and token are required');
    }

    const cleanUrl = baseUrl.trim().replace(/\/$/, '');

    // Validate token by fetching user profile
    let profile: any;
    try {
      const res = await fetch(`${cleanUrl}/api/v1/users/self/profile`, {
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      profile = await res.json();
    } catch (err: any) {
      throw new HttpsError('invalid-argument', `Could not connect to Canvas: ${err.message}`);
    }

    // Encrypt and store
    const encryptedToken = encryptString(token.trim());
    await integrationDoc(uid).set({
      baseUrl: cleanUrl,
      encryptedToken,
      canvasUserId: String(profile.id),
      displayName: profile.display_name || profile.name || '',
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
    });

    // Initial sync
    let courseCount = 0;
    let assignmentCount = 0;
    let announcementCount = 0;
    let failedCourseCount = 0;
    let lastSyncError: string | null = null;
    try {
      const result = await performSync(uid, cleanUrl, token.trim());
      courseCount = result.courseCount;
      assignmentCount = result.assignmentCount;
      announcementCount = result.announcementCount;
      failedCourseCount = result.failedCourseCount;
    } catch (err: any) {
      lastSyncError = err?.message || 'Sync failed';
      console.error('[canvas] initial sync failed:', err);
    }

    await integrationDoc(uid).update({
      lastSyncAt: new Date().toISOString(),
      lastSyncError,
      lastSyncFailedCourseCount: failedCourseCount,
    });

    return {
      success: true,
      courseCount,
      assignmentCount,
      announcementCount,
      failedCourseCount,
      lastSyncError,
      displayName: profile.display_name || profile.name,
    };
  }
);

// ─── canvasSync ───────────────────────────────────────────────────────────────

export const canvasSync = onCall(
  { secrets: [canvasEncryptionKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const snap = await integrationDoc(uid).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Canvas not connected');

    const data = snap.data()!;
    const token = decryptString(data.encryptedToken);

    let courseCount = 0;
    let assignmentCount = 0;
    let announcementCount = 0;
    let failedCourseCount = 0;
    let lastSyncError: string | null = null;
    try {
      const result = await performSync(uid, data.baseUrl, token);
      courseCount = result.courseCount;
      assignmentCount = result.assignmentCount;
      announcementCount = result.announcementCount;
      failedCourseCount = result.failedCourseCount;
    } catch (err: any) {
      lastSyncError = err?.message || 'Sync failed';
      console.error('[canvas] manual sync failed:', err);
    }

    await integrationDoc(uid).update({
      lastSyncAt: new Date().toISOString(),
      lastSyncError,
      lastSyncFailedCourseCount: failedCourseCount,
    });

    return {
      success: !lastSyncError,
      courseCount,
      assignmentCount,
      announcementCount,
      failedCourseCount,
      lastSyncError,
    };
  }
);

// ─── canvasGetStatus ──────────────────────────────────────────────────────────

export const canvasGetStatus = onCall(
  { secrets: [canvasEncryptionKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const snap = await integrationDoc(uid).get();
    if (!snap.exists) return { connected: false };

    const { baseUrl, displayName, connectedAt, lastSyncAt, lastSyncError, lastSyncFailedCourseCount } = snap.data()!;
    return {
      connected: true,
      baseUrl,
      displayName,
      connectedAt,
      lastSyncAt,
      lastSyncError: lastSyncError ?? null,
      lastSyncFailedCourseCount: lastSyncFailedCourseCount ?? 0,
    };
  }
);

// ─── canvasDisconnect ─────────────────────────────────────────────────────────

export const canvasDisconnect = onCall(
  { secrets: [canvasEncryptionKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const db = getDb();

    // Delete integration doc
    await integrationDoc(uid).delete();

    // Delete all courses
    const courses = await coursesCol(uid).listDocuments();
    const cBatch = db.batch();
    courses.forEach(ref => cBatch.delete(ref));
    await cBatch.commit();

    // Delete all assignments
    const assignments = await assignmentsCol(uid).listDocuments();
    const aBatch = db.batch();
    assignments.forEach(ref => aBatch.delete(ref));
    await aBatch.commit();

    // Delete all announcements
    const announcements = await announcementsCol(uid).listDocuments();
    const nBatch = db.batch();
    announcements.forEach(ref => nBatch.delete(ref));
    if (announcements.length > 0) await nBatch.commit();

    return { success: true };
  }
);

// ─── canvasSyncScheduled ──────────────────────────────────────────────────────
// Runs every 30 minutes — syncs all connected users

export const canvasSyncScheduled = onSchedule(
  { schedule: 'every 30 minutes', secrets: [canvasEncryptionKey] },
  async () => {
    const db = getDb();

    // Find all users with canvas integration
    const integrations = await db.collectionGroup('integrations')
      .where(admin.firestore.FieldPath.documentId(), '==', 'canvas')
      .get();

    const promises = integrations.docs.map(async (snap) => {
      const uid = snap.ref.parent.parent!.id;
      const data = snap.data();
      if (!data.encryptedToken || !data.baseUrl) return;

      let failedCourseCount = 0;
      let lastSyncError: string | null = null;
      try {
        const token = decryptString(data.encryptedToken);
        const result = await performSync(uid, data.baseUrl, token);
        failedCourseCount = result.failedCourseCount;
      } catch (err: any) {
        lastSyncError = err?.message || 'Sync failed';
        console.error('Canvas scheduled sync error for', snap.ref.path, err);
      }
      await snap.ref.update({
        lastSyncAt: new Date().toISOString(),
        lastSyncError,
        lastSyncFailedCourseCount: failedCourseCount,
      });
    });

    await Promise.allSettled(promises);
  }
);
