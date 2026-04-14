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

async function performSync(uid: string, baseUrl: string, token: string): Promise<{ courseCount: number; assignmentCount: number }> {
  const db = getDb();
  const now = new Date().toISOString();

  // 1. Fetch active courses
  const rawCourses = await canvasFetch(baseUrl, token, '/courses?enrollment_state=active&include[]=term');
  const courses = rawCourses.filter((c: any) => !c.access_restricted_by_date && c.workflow_state !== 'completed');

  // 2. Upsert courses
  const coursesBatch = db.batch();
  const courseColorMap: Record<string, string> = {};
  const COURSE_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    const color = COURSE_COLORS[i % COURSE_COLORS.length];
    courseColorMap[String(c.id)] = color;
    const ref = coursesCol(uid).doc(String(c.id));
    coursesBatch.set(ref, {
      id: String(c.id),
      name: c.name || c.course_code || 'Unnamed Course',
      courseCode: c.course_code || '',
      color,
      term: c.term?.name || null,
      syncedAt: now,
    }, { merge: true });
  }
  await coursesBatch.commit();

  // 3. Fetch assignments for each course
  let totalAssignments = 0;
  for (const course of courses) {
    const courseId = String(course.id);
    const courseName = course.name || course.course_code || 'Unnamed Course';
    const courseColor = courseColorMap[courseId] || '#8B5CF6';

    let rawAssignments: any[] = [];
    try {
      rawAssignments = await canvasFetch(baseUrl, token, `/courses/${courseId}/assignments?order_by=due_at&include[]=submission`);
    } catch {
      // Skip courses where assignment fetch fails (e.g. restricted)
      continue;
    }

    const assignmentsBatch = db.batch();
    for (const a of rawAssignments) {
      const ref = assignmentsCol(uid).doc(String(a.id));
      const submission = a.submission;
      assignmentsBatch.set(ref, {
        id: String(a.id),
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

  return { courseCount: courses.length, assignmentCount: totalAssignments };
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
    const { courseCount, assignmentCount } = await performSync(uid, cleanUrl, token.trim());

    // Mark lastSyncAt
    await integrationDoc(uid).update({ lastSyncAt: new Date().toISOString() });

    return { success: true, courseCount, assignmentCount, displayName: profile.display_name || profile.name };
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
    const { courseCount, assignmentCount } = await performSync(uid, data.baseUrl, token);

    await integrationDoc(uid).update({ lastSyncAt: new Date().toISOString() });

    return { success: true, courseCount, assignmentCount };
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

    const { baseUrl, displayName, connectedAt, lastSyncAt } = snap.data()!;
    return { connected: true, baseUrl, displayName, connectedAt, lastSyncAt };
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
      try {
        const uid = snap.ref.parent.parent!.id;
        const data = snap.data();
        if (!data.encryptedToken || !data.baseUrl) return;

        const token = decryptString(data.encryptedToken);
        await performSync(uid, data.baseUrl, token);
        await snap.ref.update({ lastSyncAt: new Date().toISOString() });
      } catch (err) {
        console.error('Canvas scheduled sync error for doc', snap.ref.path, err);
      }
    });

    await Promise.allSettled(promises);
  }
);
