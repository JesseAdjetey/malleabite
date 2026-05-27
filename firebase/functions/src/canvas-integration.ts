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

function calendarEventsCol(uid: string) {
  return getDb().collection('users').doc(uid).collection('canvas_calendar_events');
}

// ─── Canvas API fetch helper ──────────────────────────────────────────────────

class CanvasHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'CanvasHttpError';
  }
}

async function canvasFetch(baseUrl: string, token: string, path: string): Promise<any[]> {
  const results: any[] = [];
  const sep = path.includes('?') ? '&' : '?';
  let url: string | null = `${baseUrl.replace(/\/$/, '')}/api/v1${path}${sep}per_page=50`;

  while (url) {
    const fetchRes: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      throw new CanvasHttpError(fetchRes.status, `Canvas API error ${fetchRes.status}: ${text}`);
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
  calendarEventCount: number;
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
      // The `bucket` filter is only valid on /users/self/courses/:id/assignments;
      // /courses/:id/assignments 400s on it. Fetch everything and filter locally.
      rawAssignments = await canvasFetch(
        baseUrl,
        token,
        `/courses/${courseId}/assignments?order_by=due_at&include[]=submission`
      );
    } catch (err) {
      // 401/403/404 means the user has no assignment-read access for this course
      // (observer enrollment, restricted permissions, or concluded shell that
      // slipped past the term filter). Skip silently — these aren't real failures.
      if (err instanceof CanvasHttpError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        console.info(`[canvas] no assignment access for course ${courseId} (${err.status}); skipping`);
        continue;
      }
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
    // Canvas's /announcements endpoint wants YYYY-MM-DD, not a full ISO datetime.
    const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const contextCodes = courses.map(c => `context_codes[]=course_${c.id}`).join('&');
    try {
      const rawAnnouncements = await canvasFetch(
        baseUrl,
        token,
        `/announcements?${contextCodes}&start_date=${start}`
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

  // 5. Fetch Canvas-native calendar events (lectures, office hours, exam
  //    logistics, etc.) — NOT assignment events, which would duplicate the
  //    Assignments tab. Window: 30 days back through 60 days forward, so
  //    you can see the recent past for context and plan ahead.
  let calendarEventCount = 0;
  const keptCalendarEventIds = new Set<string>();

  if (courses.length > 0) {
    // Canvas's /calendar_events endpoint requires full ISO 8601 datetimes when
    // combined with type=event; bare YYYY-MM-DD is rejected with "Invalid date".
    // The window is also capped at 90 days, so keep total span < 90.
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 59 * 24 * 60 * 60 * 1000).toISOString();
    const contextCodes = courses.map(c => `context_codes[]=course_${c.id}`).join('&');
    try {
      const rawEvents = await canvasFetch(
        baseUrl,
        token,
        `/calendar_events?type=event&${contextCodes}&start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`
      );

      const evBatch = db.batch();
      for (const e of rawEvents) {
        const id = String(e.id);
        keptCalendarEventIds.add(id);

        const courseId = (e.context_code || '').replace(/^course_/, '');
        const color = courseColorMap[courseId] || '#8B5CF6';
        const courseName = courses.find(c => String(c.id) === courseId)?.name || 'Course';

        evBatch.set(calendarEventsCol(uid).doc(id), {
          id,
          courseId,
          courseName,
          courseColor: color,
          title: e.title || 'Untitled Event',
          description: e.description ? stripHtml(e.description) : null,
          locationName: e.location_name || null,
          locationAddress: e.location_address || null,
          startAt: e.start_at || null,
          endAt: e.end_at || null,
          allDay: e.all_day === true,
          htmlUrl: e.html_url || null,
          syncedAt: now,
        }, { merge: true });
        calendarEventCount++;
      }
      if (calendarEventCount > 0) await evBatch.commit();
    } catch (err) {
      console.warn('[canvas] calendar events fetch failed:', err);
    }

    // 5b. Purge stale calendar events
    const evSnap = await calendarEventsCol(uid).get();
    const deleteEvBatch = db.batch();
    let evDeletes = 0;
    evSnap.forEach(doc => {
      const data = doc.data() as { courseId?: string };
      const courseGone = data.courseId ? !keptCourseIds.has(data.courseId) : true;
      if (courseGone || !keptCalendarEventIds.has(doc.id)) {
        deleteEvBatch.delete(doc.ref);
        evDeletes++;
      }
    });
    if (evDeletes > 0) await deleteEvBatch.commit();
  }

  return {
    courseCount: courses.length,
    assignmentCount: totalAssignments,
    announcementCount,
    calendarEventCount,
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
    let calendarEventCount = 0;
    let failedCourseCount = 0;
    let lastSyncError: string | null = null;
    try {
      const result = await performSync(uid, cleanUrl, token.trim());
      courseCount = result.courseCount;
      assignmentCount = result.assignmentCount;
      announcementCount = result.announcementCount;
      calendarEventCount = result.calendarEventCount;
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
      calendarEventCount,
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
    let calendarEventCount = 0;
    let failedCourseCount = 0;
    let lastSyncError: string | null = null;
    try {
      const result = await performSync(uid, data.baseUrl, token);
      courseCount = result.courseCount;
      assignmentCount = result.assignmentCount;
      announcementCount = result.announcementCount;
      calendarEventCount = result.calendarEventCount;
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
      calendarEventCount,
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

    // Delete all calendar events
    const events = await calendarEventsCol(uid).listDocuments();
    const eBatch = db.batch();
    events.forEach(ref => eBatch.delete(ref));
    if (events.length > 0) await eBatch.commit();

    return { success: true };
  }
);

// ─── canvasGetUploadUrl ────────────────────────────────────────────────────────
// Step 1 of Canvas's file-upload protocol, executed server-side so we can use
// the user's encrypted token without ever exposing it to the browser. Returns
// a signed upload_url + upload_params; the client then POSTs the file bytes
// directly to that URL (step 2), bypassing this Cloud Function entirely.

export const canvasGetUploadUrl = onCall(
  { secrets: [canvasEncryptionKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { assignmentId, name, size, contentType } = request.data as {
      assignmentId: string;
      name: string;
      size: number;
      contentType: string;
    };
    if (!assignmentId || !name || typeof size !== 'number') {
      throw new HttpsError('invalid-argument', 'assignmentId, name, size required');
    }
    if (size <= 0 || size > 500 * 1024 * 1024) {
      // 500MB is well above any sane assignment upload.
      throw new HttpsError('invalid-argument', 'File size out of range');
    }

    const intSnap = await integrationDoc(uid).get();
    if (!intSnap.exists) throw new HttpsError('failed-precondition', 'Canvas not connected');
    const intData = intSnap.data()!;
    const token = decryptString(intData.encryptedToken);
    const baseUrl = intData.baseUrl as string;

    // Look up courseId from the cached assignment doc.
    const aSnap = await assignmentsCol(uid).doc(String(assignmentId)).get();
    if (!aSnap.exists) throw new HttpsError('not-found', 'Assignment not found');
    const courseId = (aSnap.data() as { courseId?: string }).courseId;
    if (!courseId) throw new HttpsError('failed-precondition', 'Assignment missing course');

    const url = `${baseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self/files`;
    const body = new URLSearchParams({
      name,
      size: String(size),
      ...(contentType ? { content_type: contentType } : {}),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new HttpsError('internal', `Canvas upload URL request failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as { upload_url: string; upload_params: Record<string, string> };
    if (!data.upload_url || !data.upload_params) {
      throw new HttpsError('internal', 'Canvas did not return upload_url/upload_params');
    }
    return { uploadUrl: data.upload_url, uploadParams: data.upload_params };
  }
);

// ─── canvasSubmit ──────────────────────────────────────────────────────────────
// Performs the actual submission. For online_upload, the file IDs returned
// by step 2 of the upload flow are passed in. After submitting, we re-fetch
// the single assignment from Canvas so the UI's `submitted` flag flips
// immediately without waiting for the next full sync.

export const canvasSubmit = onCall(
  { secrets: [canvasEncryptionKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { assignmentId, submissionType, body: textBody, url: submissionUrl, fileIds } = request.data as {
      assignmentId: string;
      submissionType: 'online_text_entry' | 'online_url' | 'online_upload';
      body?: string;
      url?: string;
      fileIds?: string[];
    };
    if (!assignmentId || !submissionType) {
      throw new HttpsError('invalid-argument', 'assignmentId and submissionType required');
    }
    if (submissionType === 'online_text_entry' && !textBody?.trim()) {
      throw new HttpsError('invalid-argument', 'Text submission requires body');
    }
    if (submissionType === 'online_url' && !submissionUrl?.trim()) {
      throw new HttpsError('invalid-argument', 'URL submission requires url');
    }
    if (submissionType === 'online_upload' && (!fileIds || fileIds.length === 0)) {
      throw new HttpsError('invalid-argument', 'File submission requires at least one fileId');
    }

    const intSnap = await integrationDoc(uid).get();
    if (!intSnap.exists) throw new HttpsError('failed-precondition', 'Canvas not connected');
    const intData = intSnap.data()!;
    const token = decryptString(intData.encryptedToken);
    const baseUrl = intData.baseUrl as string;

    const aSnap = await assignmentsCol(uid).doc(String(assignmentId)).get();
    if (!aSnap.exists) throw new HttpsError('not-found', 'Assignment not found');
    const aData = aSnap.data() as { courseId?: string };
    if (!aData.courseId) throw new HttpsError('failed-precondition', 'Assignment missing course');

    // Canvas accepts the submission via POST with submission[...] params.
    const form = new URLSearchParams();
    form.append('submission[submission_type]', submissionType);
    if (submissionType === 'online_text_entry') {
      form.append('submission[body]', textBody!.trim());
    } else if (submissionType === 'online_url') {
      form.append('submission[url]', submissionUrl!.trim());
    } else {
      for (const id of fileIds!) form.append('submission[file_ids][]', String(id));
    }

    const submitUrl = `${baseUrl}/api/v1/courses/${aData.courseId}/assignments/${assignmentId}/submissions`;
    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      // Surface Canvas's actual error message (locked, late not allowed, etc.).
      throw new HttpsError('internal', `Canvas rejected submission: ${res.status} ${text.slice(0, 300)}`);
    }

    // Refresh just this assignment so `submitted` flips without a full resync.
    try {
      const refRes = await fetch(
        `${baseUrl}/api/v1/courses/${aData.courseId}/assignments/${assignmentId}?include[]=submission`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      if (refRes.ok) {
        const fresh = await refRes.json() as any;
        const submission = fresh.submission;
        await assignmentsCol(uid).doc(String(assignmentId)).set({
          submitted: submission ? ['submitted', 'graded'].includes(submission.workflow_state) : true,
          score: submission?.score ?? null,
          syncedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (err) {
      // Refresh failure is not fatal — next scheduled sync will catch up.
      console.warn('[canvas] post-submit refresh failed:', err);
    }

    return { success: true };
  }
);

// ─── canvasSyncScheduled ──────────────────────────────────────────────────────
// Runs every 30 minutes — syncs all connected users

export const canvasSyncScheduled = onSchedule(
  { schedule: 'every 30 minutes', secrets: [canvasEncryptionKey] },
  async () => {
    const db = getDb();

    // Iterate users and look up each one's canvas integration directly.
    // We can't do a collection-group query filtered by document id ("canvas")
    // because Firestore rejects FieldPath.documentId() on collection groups —
    // document paths must have an even segment count and "canvas" is one.
    const usersSnap = await db.collection('users').select().get();
    const integrationSnaps = await Promise.all(
      usersSnap.docs.map(u => u.ref.collection('integrations').doc('canvas').get())
    );
    const integrations = { docs: integrationSnaps.filter(s => s.exists) };

    const promises = integrations.docs.map(async (snap) => {
      const uid = snap.ref.parent.parent!.id;
      const data = snap.data()!;
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
