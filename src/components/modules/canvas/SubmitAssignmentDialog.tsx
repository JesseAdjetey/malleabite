// Submission dialog for a Canvas assignment.
//
// Shows only the submission types Canvas declared for the assignment:
//   online_text_entry  → textarea
//   online_url         → URL input
//   online_upload      → file picker (single file in v1)
//
// File uploads go direct to Canvas's storage via uploadFileToCanvas; we
// only call the canvasSubmit Cloud Function once the file_id is in hand
// (or for text/url, right away).

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Pencil, Link as LinkIcon, Upload, X, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { CanvasAssignment } from '@/hooks/use-canvas-integration';
import { uploadFileToCanvas, UploadProgress } from '@/lib/canvas-upload';

type SubmissionType = 'online_text_entry' | 'online_url' | 'online_upload';

const TYPE_META: Record<SubmissionType, { label: string; Icon: typeof Pencil }> = {
  online_text_entry: { label: 'Text', Icon: Pencil },
  online_url: { label: 'Website URL', Icon: LinkIcon },
  online_upload: { label: 'File upload', Icon: Upload },
};

interface SubmitAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: CanvasAssignment | null;
  onSubmit: (input: {
    assignmentId: string;
    submissionType: SubmissionType;
    body?: string;
    url?: string;
    fileIds?: string[];
  }) => Promise<boolean>;
}

export default function SubmitAssignmentDialog({
  open,
  onClose,
  assignment,
  onSubmit,
}: SubmitAssignmentDialogProps) {
  const supportedTypes = useMemo<SubmissionType[]>(() => {
    if (!assignment) return [];
    const set = new Set(assignment.submissionTypes);
    return (['online_text_entry', 'online_url', 'online_upload'] as SubmissionType[])
      .filter(t => set.has(t));
  }, [assignment]);

  const [activeType, setActiveType] = useState<SubmissionType | null>(null);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens / assignment changes.
  React.useEffect(() => {
    if (open) {
      setActiveType(supportedTypes[0] ?? null);
      setText('');
      setUrl('');
      setFile(null);
      setUploading(false);
      setUploadProgress(null);
      setSubmitting(false);
      setError(null);
    }
  }, [open, supportedTypes]);

  if (!assignment) return null;

  // Edge cases worth telling the user about up front.
  if (open && supportedTypes.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Can't submit from here</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-2 py-2 text-sm text-muted-foreground">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p>This assignment uses a submission type we don't support yet
              (likely a quiz, discussion, external tool, or on-paper submission).</p>
              <p className="mt-2">Open it in Canvas to submit there.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            {assignment.htmlUrl && (
              <Button onClick={() => window.open(assignment.htmlUrl!, '_blank')}>
                Open in Canvas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const canSubmit = (() => {
    if (!activeType || uploading || submitting) return false;
    if (activeType === 'online_text_entry') return text.trim().length > 0;
    if (activeType === 'online_url') {
      const trimmed = url.trim();
      try {
        const u = new URL(trimmed);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }
    if (activeType === 'online_upload') return file !== null;
    return false;
  })();

  const handleSubmit = async () => {
    if (!activeType || !assignment) return;
    setError(null);

    let fileIds: string[] | undefined;
    if (activeType === 'online_upload' && file) {
      setUploading(true);
      setUploadProgress({ loaded: 0, total: file.size, pct: 0 });
      try {
        const result = await uploadFileToCanvas(assignment.id, file, setUploadProgress);
        fileIds = [result.fileId];
      } catch (err: any) {
        setError(err?.message || 'Upload failed');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    setSubmitting(true);
    const ok = await onSubmit({
      assignmentId: assignment.id,
      submissionType: activeType,
      body: activeType === 'online_text_entry' ? text : undefined,
      url: activeType === 'online_url' ? url.trim() : undefined,
      fileIds,
    });
    setSubmitting(false);

    if (ok) onClose();
    // onSubmit shows its own toast on failure; we don't need to duplicate.
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !uploading && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Submit to Canvas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Assignment context */}
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: assignment.courseColor }}
              />
              <span className="text-xs text-muted-foreground truncate">{assignment.courseName}</span>
            </div>
            <div className="font-medium text-foreground mt-0.5">{assignment.title}</div>
            {assignment.pointsPossible !== null && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {assignment.pointsPossible} pts
              </div>
            )}
          </div>

          {/* Type picker */}
          {supportedTypes.length > 1 && (
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-md">
              {supportedTypes.map(t => {
                const { label, Icon } = TYPE_META[t];
                const active = activeType === t;
                return (
                  <button
                    key={t}
                    onClick={() => { if (!uploading && !submitting) setActiveType(t); }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded transition-colors',
                      active
                        ? 'bg-[#E66000] text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Per-type form */}
          {activeType === 'online_text_entry' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Your submission</Label>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type your submission here…"
                rows={8}
                maxLength={50_000}
                disabled={submitting}
                className="text-sm"
              />
              <div className="text-[10px] text-muted-foreground text-right">
                {text.length.toLocaleString()} / 50,000
              </div>
            </div>
          )}

          {activeType === 'online_url' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Website URL</Label>
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                disabled={submitting}
              />
            </div>
          )}

          {activeType === 'online_upload' && (
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              {!file ? (
                <label className="flex flex-col items-center justify-center gap-1 py-6 border-2 border-dashed border-white/10 rounded-md cursor-pointer hover:border-white/20 hover:bg-white/5 transition-colors">
                  <Upload size={18} className="text-muted-foreground/70" />
                  <span className="text-xs text-muted-foreground">Choose file</span>
                  <span className="text-[10px] text-muted-foreground/60">Single file, up to 500&nbsp;MB</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5">
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{file.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatBytes(file.size)}
                    </div>
                  </div>
                  {!uploading && !submitting && (
                    <button
                      onClick={() => setFile(null)}
                      className="p-1 rounded hover:bg-white/10 text-muted-foreground"
                      aria-label="Remove file"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {uploading && uploadProgress && (
                <div className="space-y-1">
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E66000] transition-all"
                      style={{ width: `${uploadProgress.pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right">
                    Uploading… {uploadProgress.pct.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-red-300">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading || submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Submitting…' : uploading ? 'Uploading…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
