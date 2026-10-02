import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/contexts/StoreContext";
import { trpc } from "@/lib/trpc";
import { FileText, LockKeyhole, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";

const MAX_BYTES = 3_000_000;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("The selected file could not be read."));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function StudyMaterials() {
  const { state, addStudyMaterial, deleteStudyMaterial } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topicId, setTopicId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const topics = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(
            topic =>
              [
                topic.id,
                { id: topic.id, subject: topic.subject, name: topic.name },
              ] as const
          ),
          ...state.exams.flatMap(exam =>
            exam.topics.map(
              topic =>
                [
                  topic.id,
                  { id: topic.id, subject: exam.subject, name: topic.name },
                ] as const
            )
          ),
        ]).values()
      ),
    [state.exams, state.topics]
  );
  const selectedTopic = topics.find(topic => topic.id === topicId);
  const upload = trpc.studyMaterials.upload.useMutation();
  const accessMaterial = trpc.studyMaterials.accessUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
  });

  const chooseFile = (next: File | null) => {
    if (!next) return;
    const supported =
      next.type === "application/pdf" ||
      next.type === "text/plain" ||
      /\.(pdf|txt)$/i.test(next.name);
    if (!supported) {
      setError("Choose a PDF or plain-text file.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(
        "Study materials must be 3 MB or smaller in this secure upload flow."
      );
      return;
    }
    setFile(next);
    setTitle(next.name.replace(/\.[^.]+$/, ""));
    setError("");
  };
  const submit = async () => {
    const resolvedSubject = selectedTopic?.subject ?? subject.trim();
    if (
      upload.isPending ||
      !file ||
      !title.trim() ||
      !resolvedSubject ||
      !acknowledged
    ) {
      setError(
        "Choose a file, give it a title and subject, and acknowledge the storage notice."
      );
      return;
    }
    const submittedMaterial = {
      title: title.trim(),
      subject: resolvedSubject,
      ...(selectedTopic ? { topicId: selectedTopic.id } : {}),
    };
    try {
      const dataUrl = await readAsDataUrl(file);
      upload.mutate(
        { ...submittedMaterial, fileName: file.name, dataUrl },
        {
          onSuccess: stored => {
            const accepted = addStudyMaterial({
              ...submittedMaterial,
              fileName: stored.fileName,
              mimeType: stored.mimeType,
              storageKey: stored.key,
              url: "",
              sizeBytes: stored.sizeBytes,
            });
            if (!accepted) {
              setError(
                "We could not add that uploaded material to your workspace. Your upload details are still here."
              );
              return;
            }
            setFile(null);
            setTitle("");
            setSubject("");
            setTopicId("");
            setAcknowledged(false);
            setError("");
            if (fileInput.current) fileInput.current.value = "";
          },
        }
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The file could not be prepared for upload."
      );
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Private study library
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Study materials
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep your own PDFs and notes alongside the topics you are learning.
            Uploading stores a private account-owned file; it never starts AI
            analysis automatically.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full bg-card">
          <Link href="/notes">Notes workspace</Link>
        </Button>
      </header>
      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-5 text-muted-foreground">
            <strong className="text-foreground">
              Your choice controls AI use.
            </strong>{" "}
            This upload stores the original file for your workspace. A future
            action will ask separately before any summary, flashcard, or quiz
            generation uses its content.
          </p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Title</Label>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="e.g. Chemistry revision pack"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Subject
            </Label>
            <Input
              value={selectedTopic?.subject ?? subject}
              onChange={event => {
                setSubject(event.target.value);
                setTopicId("");
              }}
              placeholder="e.g. Chemistry"
              disabled={Boolean(selectedTopic)}
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="mt-4">
          <Label className="mb-1.5 block text-xs font-semibold">
            Link a topic{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Select
            value={topicId || "_none"}
            onValueChange={value => setTopicId(value === "_none" ? "" : value)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No linked topic</SelectItem>
              {topics.map(topic => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.subject} — {topic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4">
          <Label className="mb-1.5 block text-xs font-semibold">
            PDF or plain-text file{" "}
            <span className="font-normal text-muted-foreground">
              (up to 3 MB)
            </span>
          </Label>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,text/plain,.pdf,.txt"
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/15"
            onChange={event => chooseFile(event.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ready: {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={event => setAcknowledged(event.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            I understand that this stores my file in my Student OS workspace and
            does not authorize automatic AI processing.
          </span>
        </label>
        {(error || upload.error) && (
          <p className="mt-3 text-sm font-medium text-destructive">
            {error || upload.error?.message}
          </p>
        )}
        <Button
          className="mt-4 rounded-xl"
          disabled={upload.isPending}
          onClick={submit}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {upload.isPending ? "Saving material…" : "Save material"}
        </Button>
      </Card>
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Your materials</h2>
          <span className="text-xs text-muted-foreground">
            {state.studyMaterials.length} saved
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {state.studyMaterials.map(material => (
            <Card key={material.id} className="p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{material.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {material.subject} · {material.fileName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(material.sizeBytes / 1024).toFixed(0)} KB · AI processing{" "}
                    {material.aiProcessingConsentAt
                      ? "approved"
                      : "not approved"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-card"
                  disabled={accessMaterial.isPending}
                  onClick={() =>
                    accessMaterial.mutate({ storageKey: material.storageKey })
                  }
                >
                  {accessMaterial.isPending ? "Opening…" : "Open file"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full bg-card text-destructive hover:text-destructive"
                  onClick={() => deleteStudyMaterial(material.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
        {state.studyMaterials.length === 0 && (
          <Card className="mt-3 border-dashed p-5 text-sm text-muted-foreground">
            Your study materials will appear here after a successful upload.
          </Card>
        )}
      </section>
    </div>
  );
}
