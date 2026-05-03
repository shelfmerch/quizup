import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminService, AdminCategory, AdminQuestion, GenerateQuestionsQueuedResponse } from "@/services/adminService";
import { resolveQuestionImageUrl } from "@/lib/mediaUrl";
import { toast } from "sonner";

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [topicName, setTopicName] = useState("");
  const [topicSlug, setTopicSlug] = useState("");
  const [topicIcon, setTopicIcon] = useState("🎯");
  const [topicDescription, setTopicDescription] = useState("");

  const [qText, setQText] = useState("");
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [timeLimit, setTimeLimit] = useState(10);
  const [qImageUrl, setQImageUrl] = useState("");
  const [qImageUploading, setQImageUploading] = useState(false);

  const [aiCount, setAiCount] = useState(10);
  const [aiGenerating, setAiGenerating] = useState(false);

  const refreshCategories = async () => {
    const list = await adminService.listCategories();
    setCategories(list);
    setSelectedSlug((prev) => {
      if (list.length === 0) return "";
      if (!prev || !list.some((c) => c.slug === prev)) return list[0].slug;
      return prev;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refreshCategories();
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = await adminService.listQuestions(selectedSlug);
        if (!cancelled) setQuestions(qs);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load questions");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createCategory({
        name: topicName,
        slug: topicSlug.trim() || undefined,
        icon: topicIcon,
        description: topicDescription,
      });
      toast.success("Topic created");
      setTopicName("");
      setTopicSlug("");
      setTopicIcon("🎯");
      setTopicDescription("");
      await refreshCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  const handleGenerateAiQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) {
      toast.error("Select a topic first");
      return;
    }
    const count = Math.min(500, Math.max(1, Math.floor(Number(aiCount) || 0)));
    if (count < 1) {
      toast.error("Enter a count between 1 and 500");
      return;
    }
    setAiGenerating(true);
    try {
      const res: GenerateQuestionsQueuedResponse = await adminService.generateQuestionsQueued({
        categoryId: selectedSlug,
        count,
      });
      toast.success(
        `Queued ${res.batches} background job(s) for ${count} question(s). They appear here after the worker finishes (usually under a minute).`,
        { duration: 8000 }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Queue failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) {
      toast.error("Select a topic first");
      return;
    }
    try {
      await adminService.createQuestion({
        categoryId: selectedSlug,
        text: qText,
        options: [opt0, opt1, opt2, opt3],
        correctIndex,
        timeLimit,
        imageUrl: qImageUrl.trim() || null,
      });
      toast.success("Question added");
      setQText("");
      setOpt0("");
      setOpt1("");
      setOpt2("");
      setOpt3("");
      setCorrectIndex(0);
      setQImageUrl("");
      const qs = await adminService.listQuestions(selectedSlug);
      setQuestions(qs);
      await refreshCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  return (
    <div className="min-h-screen bg-quizup-dark max-w-md mx-auto pb-10">
      <div className="quizup-header-teal px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button type="button" onClick={() => navigate("/home")} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-foreground text-base">Quiz admin</h1>
      </div>

      <div className="p-4 space-y-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-display font-bold text-foreground text-lg">Create topic</h2>
              <p className="text-xs text-muted-foreground">
                Topics use a URL slug for matchmaking (e.g. <span className="text-foreground/80">science</span>). Leave slug
                blank to auto-generate from the name.
              </p>
              <form onSubmit={handleCreateTopic} className="space-y-3 bg-quizup-card p-4 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    className="mt-1 bg-quizup-dark border-border text-foreground"
                    placeholder="e.g. Space & Astronomy"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Slug (optional)</Label>
                  <Input
                    value={topicSlug}
                    onChange={(e) => setTopicSlug(e.target.value)}
                    className="mt-1 bg-quizup-dark border-border text-foreground"
                    placeholder="space-astronomy"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Icon</Label>
                    <Input
                      value={topicIcon}
                      onChange={(e) => setTopicIcon(e.target.value)}
                      className="mt-1 bg-quizup-dark border-border text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      value={topicDescription}
                      onChange={(e) => setTopicDescription(e.target.value)}
                      className="mt-1 bg-quizup-dark border-border text-foreground"
                      placeholder="Short blurb"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-11 rounded-lg quizup-header-green text-foreground font-display font-bold text-sm"
                >
                  CREATE TOPIC
                </button>
              </form>
            </section>

            <section className="space-y-3">
              <h2 className="font-display font-bold text-foreground text-lg">Add questions</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You can add any number of questions per topic. Each live match randomly picks{" "}
                <span className="text-foreground font-semibold">7</span> different questions from that
                pool (or all of them if fewer than 7 exist).
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Topic</Label>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="mt-1 w-full h-11 rounded-md bg-quizup-card border border-border text-foreground px-3 text-sm"
                >
                  <option value="">Select a topic…</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.icon} {c.name} ({c.questionCount} Q)
                    </option>
                  ))}
                </select>
              </div>

              {selectedSlug && (
                <form onSubmit={handleGenerateAiQuestions} className="space-y-3 bg-quizup-card p-4 rounded-lg border border-quizup-green/30">
                  <div className="flex items-center gap-2 text-quizup-green">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <h3 className="font-display font-bold text-foreground text-sm">Generate with AI</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Uses Gemini + image APIs on the server. Jobs run in the background (10 questions per job). Requires{" "}
                    <code className="text-foreground/80">REDIS_URL</code>, <code className="text-foreground/80">GEMINI_API_KEY</code>, and worker
                    running.
                  </p>
                  <div>
                    <Label className="text-xs text-muted-foreground">How many questions</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value) || 0)}
                      className="mt-1 bg-quizup-dark border-border text-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={aiGenerating}
                    className="w-full h-11 rounded-lg bg-quizup-green/90 hover:bg-quizup-green text-quizup-dark font-display font-bold text-sm disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {aiGenerating ? "QUEUING…" : "QUEUE AI GENERATION"}
                  </button>
                </form>
              )}

              {selectedSlug && (
                <form onSubmit={handleCreateQuestion} className="space-y-3 bg-quizup-card p-4 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Question</Label>
                    <Input
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      className="mt-1 bg-quizup-dark border-border text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Image (optional)</Label>
                    <Input
                      value={qImageUrl}
                      onChange={(e) => setQImageUrl(e.target.value)}
                      className="mt-1 bg-quizup-dark border-border text-foreground"
                      placeholder="https://… or leave empty after upload"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs text-quizup-green font-semibold cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          disabled={qImageUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            setQImageUploading(true);
                            try {
                              const url = await adminService.uploadQuestionImage(file);
                              setQImageUrl(url);
                              toast.success("Image uploaded");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Upload failed");
                            } finally {
                              setQImageUploading(false);
                            }
                          }}
                        />
                        {qImageUploading ? "Uploading…" : "Upload image file"}
                      </label>
                      {qImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setQImageUrl("")}
                          className="text-xs text-muted-foreground underline"
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                    {resolveQuestionImageUrl(qImageUrl) ? (
                      <img
                        src={resolveQuestionImageUrl(qImageUrl)}
                        alt=""
                        className="mt-2 w-full max-h-40 object-contain rounded-md border border-border bg-quizup-dark"
                      />
                    ) : null}
                  </div>
                  {(["A", "B", "C", "D"] as const).map((label, i) => (
                    <div key={label}>
                      <Label className="text-xs text-muted-foreground">Option {label}</Label>
                      <Input
                        value={[opt0, opt1, opt2, opt3][i]}
                        onChange={(e) => [setOpt0, setOpt1, setOpt2, setOpt3][i](e.target.value)}
                        className="mt-1 bg-quizup-dark border-border text-foreground"
                        required
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs text-muted-foreground">Correct answer</Label>
                    <select
                      value={correctIndex}
                      onChange={(e) => setCorrectIndex(Number(e.target.value))}
                      className="mt-1 w-full h-11 rounded-md bg-quizup-dark border border-border text-foreground px-3 text-sm"
                    >
                      <option value={0}>A</option>
                      <option value={1}>B</option>
                      <option value={2}>C</option>
                      <option value={3}>D</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Time (sec)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={120}
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value) || 10)}
                        className="mt-1 bg-quizup-dark border-border text-foreground"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full h-11 rounded-lg quizup-header-teal text-foreground font-display font-bold text-sm"
                  >
                    ADD QUESTION
                  </button>
                </form>
              )}

              {selectedSlug && questions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    In this topic ({questions.length})
                  </p>
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {questions.map((q, qi) => {
                      const thumb = resolveQuestionImageUrl(q.imageUrl ?? undefined);
                      return (
                        <li key={q.id} className="text-xs bg-quizup-card p-3 rounded-md text-foreground/90 border border-border flex gap-2">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-14 h-14 object-cover rounded shrink-0 border border-border" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <span className="text-quizup-gold font-semibold">#{qi + 1}</span> {q.text}
                            <p className="text-muted-foreground mt-1 truncate">
                              ✓ {q.options[q.correctIndex]} · {q.timeLimit}s
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
