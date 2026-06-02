import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Sparkles, FileText, PlusCircle, 
  Database, Layers, UploadCloud, Clock, 
  Image as ImageIcon, CheckCircle2, ChevronDown, ListPlus,
  Trash2, ImageOff, Link2, Upload, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminService, AdminCategory, AdminQuestion, GenerateQuestionsQueuedResponse, BulkCreateResponse } from "@/services/adminService";
import { resolveQuestionImageUrl } from "@/lib/mediaUrl";
import { toast } from "sonner";

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState("");
  const [modalUploading, setModalUploading] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<"link" | "upload">("link");

  useEffect(() => {
    if (editingQuestion) {
      setModalImageUrl(editingQuestion.imageUrl || "");
      setModalActiveTab("link");
    } else {
      setModalImageUrl("");
    }
  }, [editingQuestion]);

  const [activeTab, setActiveTab] = useState<"manual" | "bulk" | "ai">("manual");

  const [topicName, setTopicName] = useState("");
  const [topicSlug, setTopicSlug] = useState("");
  const [topicIcon, setTopicIcon] = useState("🎯");
  const [topicIconUploading, setTopicIconUploading] = useState(false);
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

  const [bulkJson, setBulkJson] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkCreateResponse | null>(null);
  const [bulkAutoImageProvider, setBulkAutoImageProvider] = useState<"searchstack" | "serp">("searchstack");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.success("Topic created successfully!");
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
        `Queued ${res.batches} background job(s) for ${count} question(s). They appear here after the worker finishes.`,
        { duration: 8000 }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Queue failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const parseBulkJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) {
      toast.error("Select a topic first");
      return;
    }
    const parsed = parseBulkJson(bulkJson);
    if (!parsed || parsed.length === 0) {
      toast.error("Invalid JSON. Must be an array of question objects.");
      return;
    }
    if (parsed.length > 200) {
      toast.error("Maximum 200 questions per bulk request");
      return;
    }
    setBulkSubmitting(true);
    setBulkResult(null);
    try {
      const res = await adminService.createBulkQuestions({
        categoryId: selectedSlug,
        autoImageProvider: bulkAutoImageProvider,
        questions: parsed,
      });
      setBulkResult(res);
      if (res.created > 0) {
        toast.success(`${res.created} question(s) created${res.failed > 0 ? `, ${res.failed} failed` : ""}`);
        const qs = await adminService.listQuestions(selectedSlug);
        setQuestions(qs);
        await refreshCategories();
      } else {
        toast.error(`All ${res.failed} question(s) failed validation`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setBulkSubmitting(false);
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
      toast.success("Question added successfully!");
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

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await adminService.deleteQuestion(id);
      toast.success("Question deleted");
      const qs = await adminService.listQuestions(selectedSlug);
      setQuestions(qs);
      await refreshCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleRemoveImage = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove the image from this question?")) return;
    try {
      await adminService.removeQuestionImage(id);
      toast.success("Image removed");
      const qs = await adminService.listQuestions(selectedSlug);
      setQuestions(qs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove image");
    }
  };

  const handleUpdateImageUrl = async (id: string) => {
    const url = window.prompt("Enter the new image URL:");
    if (url === null) return;
    if (!url.trim()) return;
    try {
      await adminService.updateQuestionImage(id, url.trim());
      toast.success("Image updated");
      const qs = await adminService.listQuestions(selectedSlug);
      setQuestions(qs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update image");
    }
  };

  const handleUpdateImageFile = async (id: string, file: File) => {
    try {
      const url = await adminService.uploadQuestionImage(file);
      await adminService.updateQuestionImage(id, url);
      toast.success("Image updated");
      const qs = await adminService.listQuestions(selectedSlug);
      setQuestions(qs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };


  const renderManualTab = () => (
    <form onSubmit={handleCreateQuestion} className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="space-y-2">
        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Question Text</Label>
        <Input
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          className="bg-white border-slate-300 text-slate-900 text-base py-6 focus-visible:ring-quizup-green shadow-sm"
          placeholder="What is the capital of France?"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Image <span className="text-slate-500 font-normal">(Optional)</span></span>
            {qImageUploading && <span className="text-quizup-green animate-pulse text-[10px]">Uploading...</span>}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              value={qImageUrl}
              onChange={(e) => setQImageUrl(e.target.value)}
              className="bg-white border-slate-300 text-slate-900 flex-1 shadow-sm"
              placeholder="Image URL or Upload"
            />
            <label className="flex items-center justify-center w-10 h-10 rounded-md bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors shrink-0 shadow-sm">
              <UploadCloud className="w-4 h-4 text-quizup-green" />
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
            </label>
          </div>
          {resolveQuestionImageUrl(qImageUrl) && (
            <div className="mt-3 relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 w-full h-32 flex items-center justify-center group shadow-sm">
              <img src={resolveQuestionImageUrl(qImageUrl)!} alt="Preview" className="max-w-full max-h-full object-contain" />
              <button
                type="button"
                onClick={() => setQImageUrl("")}
                className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-red-600 font-semibold text-sm backdrop-blur-sm"
              >
                Remove Image
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Time Limit (sec)</Label>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-md bg-white border border-slate-300 flex items-center justify-center shadow-sm">
               <Clock className="w-4 h-4 text-amber-500" />
             </div>
             <Input
                type="number"
                min={5}
                max={120}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value) || 10)}
                className="bg-white border-slate-300 text-slate-900 font-mono text-lg flex-1 h-10 shadow-sm"
             />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Options & Correct Answer</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["A", "B", "C", "D"] as const).map((label, i) => {
            const isCorrect = correctIndex === i;
            return (
              <div 
                key={label} 
                className={`relative flex items-center border rounded-lg overflow-hidden transition-all duration-300 shadow-sm ${isCorrect ? 'border-quizup-green bg-green-50 shadow-[0_0_15px_rgba(46,204,113,0.15)]' : 'border-slate-300 bg-white hover:border-slate-400'}`}
              >
                <button
                  type="button"
                  onClick={() => setCorrectIndex(i)}
                  className={`w-12 h-full absolute left-0 top-0 bottom-0 flex items-center justify-center font-display font-bold text-lg transition-colors border-r ${isCorrect ? 'bg-quizup-green text-white border-quizup-green' : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 hover:text-slate-900'}`}
                  title={`Set option ${label} as correct`}
                >
                  {label}
                </button>
                <Input
                  value={[opt0, opt1, opt2, opt3][i]}
                  onChange={(e) => [setOpt0, setOpt1, setOpt2, setOpt3][i](e.target.value)}
                  className="pl-16 bg-transparent border-0 h-12 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-900"
                  placeholder={`Option ${label}`}
                  required
                />
                {isCorrect && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-quizup-green pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        className="w-full h-12 mt-4 rounded-xl bg-red-400 hover:from-red-500 hover:to-quizup-green text-white font-display font-bold text-base shadow-lg shadow-quizup-green/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        ADD QUESTION
      </button>
    </form>
  );

  const renderBulkTab = () => (
    <form onSubmit={handleBulkImport} className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
       <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3 text-purple-700 text-sm">
             <FileText className="w-5 h-5 shrink-0 mt-0.5 text-purple-500" />
             <div>
                <strong className="block text-purple-900 mb-1">Bulk Import Guide</strong>
                Paste a JSON array of questions. Required: <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-800">text</code>, <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-800">options</code> (4 strings), <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-800">correctIndex</code> (0–3). Optional: <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-800">timeLimit</code>, <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-800">imageUrl</code>.
             </div>
          </div>
       </div>

       <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-500" /> Auto-fill Missing Images
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             <label className={`cursor-pointer flex items-center p-3 rounded-lg border transition-colors shadow-sm ${bulkAutoImageProvider === 'searchstack' ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="autoImg" checked={bulkAutoImageProvider === 'searchstack'} onChange={() => setBulkAutoImageProvider('searchstack')} className="sr-only" />
                <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${bulkAutoImageProvider === 'searchstack' ? 'border-purple-500 bg-purple-500' : 'border-slate-400 bg-white'}`}>
                   {bulkAutoImageProvider === 'searchstack' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div className="text-sm">
                   <p className="font-semibold text-slate-900">SearchStack</p>
                   <p className="text-xs text-slate-500">Google Images API</p>
                </div>
             </label>
             <label className={`cursor-pointer flex items-center p-3 rounded-lg border transition-colors shadow-sm ${bulkAutoImageProvider === 'serp' ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="autoImg" checked={bulkAutoImageProvider === 'serp'} onChange={() => setBulkAutoImageProvider('serp')} className="sr-only" />
                <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${bulkAutoImageProvider === 'serp' ? 'border-purple-500 bg-purple-500' : 'border-slate-400 bg-white'}`}>
                   {bulkAutoImageProvider === 'serp' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div className="text-sm">
                   <p className="font-semibold text-slate-900">Serp API</p>
                   <p className="text-xs text-slate-500">Google Images via SerpAPI</p>
                </div>
             </label>
          </div>
          
       </div>

       <div className="space-y-2">
         <div className="flex items-center justify-between">
           <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">JSON Payload</Label>
           {bulkJson.trim() && (
             <span className={`text-xs font-semibold px-2 py-0.5 rounded ${parseBulkJson(bulkJson) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
               {parseBulkJson(bulkJson) ? `✓ ${parseBulkJson(bulkJson)?.length} valid items` : '⚠ Invalid JSON'}
             </span>
           )}
         </div>
         <textarea
            value={bulkJson}
            onChange={(e) => { setBulkJson(e.target.value); setBulkResult(null); }}
            rows={8}
            className="w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-800 px-4 py-3 text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 shadow-inner custom-scrollbar"
            placeholder={'[\n  {\n    "text": "What is the capital of France?",\n    "options": ["Berlin", "Madrid", "Paris", "Rome"],\n    "correctIndex": 2,\n    "timeLimit": 10\n  }\n]'}
          />
       </div>

       {bulkResult && (
         <div className={`text-sm p-4 rounded-xl border shadow-sm ${bulkResult.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
               {bulkResult.errors.length === 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : null}
               Result: <span className="text-green-700">{bulkResult.created} created</span>
               {bulkResult.failed > 0 && <span className="text-red-600 mx-1">| {bulkResult.failed} failed</span>}
            </p>
            {bulkResult.errors.length > 0 && (
              <div className="mt-2 bg-white rounded-lg p-2 max-h-32 overflow-y-auto custom-scrollbar border border-red-100 shadow-inner">
                <ul className="space-y-1">
                  {bulkResult.errors.map((err) => (
                    <li key={err.index} className="text-red-700 text-xs font-mono">
                      <span className="text-red-600 font-bold">#{err.index + 1}</span> "{err.text.substring(0, 30)}...": {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
         </div>
       )}

       <button
        type="submit"
        disabled={bulkSubmitting || !bulkJson.trim() || !parseBulkJson(bulkJson)}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-indigo-600 hover:to-purple-600 text-white font-display font-bold text-base shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none hover:scale-[1.02] active:scale-[0.98]"
      >
        {bulkSubmitting ? "IMPORTING BATCH..." : "IMPORT JSON"}
      </button>
    </form>
  );

  const renderAiTab = () => (
    <form onSubmit={handleGenerateAiQuestions} className="space-y-6 animate-in fade-in zoom-in-95 duration-300 text-center py-6">
       <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 p-[2px] shadow-lg shadow-emerald-500/20">
         <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-emerald-500 animate-pulse" />
         </div>
       </div>
       
       <div>
         <h3 className="font-display font-bold text-2xl mb-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">AI Generator</h3>
         <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Harness the power of Gemini to automatically generate rich, context-aware questions with images for this topic.
         </p>
       </div>

       <div className="max-w-xs mx-auto space-y-2">
         <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Number of Questions</Label>
         <div className="relative">
            <Input
              type="number"
              min={1}
              max={500}
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value) || 0)}
              className="bg-white border-slate-300 text-slate-900 text-center text-2xl font-bold h-16 focus-visible:ring-emerald-500 shadow-sm"
            />
         </div>
       </div>

       <button
        type="submit"
        disabled={aiGenerating}
        className="w-full max-w-xs mx-auto h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-teal-500 hover:to-emerald-500 text-white font-display font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:pointer-events-none hover:scale-[1.05] active:scale-[0.95] flex items-center justify-center gap-2"
      >
        {aiGenerating ? (
           <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            QUEUING...
           </>
        ) : (
           <>
            GENERATE NOW <Sparkles className="w-5 h-5" />
           </>
        )}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            type="button" 
            onClick={() => navigate("/")} 
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-quizup-green to-teal-500 flex items-center justify-center shadow-md shadow-teal-500/20">
              <Database className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-display font-bold text-lg tracking-wide text-slate-900">Quiz Admin Console</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
             <div className="w-10 h-10 border-4 border-quizup-green border-t-transparent rounded-full animate-spin"></div>
             <p className="text-slate-500 font-medium text-sm animate-pulse">Loading Admin Workspace...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Topics Sidebar */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              
              {/* Select Topic */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-[50px] -mr-10 -mt-10 transition-all group-hover:bg-slate-100" />
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <Layers className="w-5 h-5 text-amber-500" />
                  <h2 className="font-display font-bold text-lg text-slate-900">Active Topic</h2>
                </div>
                <div className="relative z-10">
                  <select
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 px-4 text-sm font-medium appearance-none focus:outline-none focus:border-quizup-green focus:ring-2 focus:ring-quizup-green/20 transition-all cursor-pointer hover:bg-white shadow-sm"
                  >
                    <option value="" disabled className="text-slate-500">Choose a topic to manage...</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.icon} {c.name} ({c.questionCount} Qs)
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Create Topic Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-display font-bold text-xs text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                   <PlusCircle className="w-3 h-3" /> Create New Topic
                </h3>
                <form onSubmit={handleCreateTopic} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Name</Label>
                    <Input
                      value={topicName}
                      onChange={(e) => setTopicName(e.target.value)}
                      className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-quizup-green h-11 rounded-lg hover:bg-white shadow-sm"
                      placeholder="e.g. Space & Astronomy"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Slug <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input
                      value={topicSlug}
                      onChange={(e) => setTopicSlug(e.target.value)}
                      className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-quizup-green h-11 rounded-lg hover:bg-white font-mono text-xs shadow-sm"
                      placeholder="space-astronomy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Icon</Label>
                      <Input
                        value={topicIcon}
                        onChange={(e) => setTopicIcon(e.target.value)}
                        className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-quizup-green h-11 rounded-lg hover:bg-white shadow-sm"
                        placeholder="Emoji/URL"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Desc.</Label>
                      <Input
                        value={topicDescription}
                        onChange={(e) => setTopicDescription(e.target.value)}
                        className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-quizup-green h-11 rounded-lg hover:bg-white shadow-sm"
                        placeholder="Short blurb"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium cursor-pointer transition-colors border border-slate-300 border-dashed hover:border-slate-400 text-slate-700">
                      <UploadCloud className="w-4 h-4 text-quizup-green" />
                      <span>{topicIconUploading ? "Uploading…" : "Upload Icon"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={topicIconUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setTopicIconUploading(true);
                          try {
                            const url = await adminService.uploadQuestionImage(file);
                            setTopicIcon(url);
                            toast.success("Icon uploaded");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setTopicIconUploading(false);
                          }
                        }}
                      />
                    </label>
                    {topicIcon && topicIcon !== "🎯" && (
                       <button type="button" onClick={() => setTopicIcon("🎯")} className="text-xs text-red-500 hover:text-red-600 underline underline-offset-2">Reset</button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full h-11 mt-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 font-display font-bold text-sm transition-all hover:border-quizup-green/50 hover:text-quizup-green shadow-sm active:scale-[0.98]"
                  >
                    CREATE TOPIC
                  </button>
                </form>
              </div>

            </div>

            {/* Right Column: Question Workspace */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {!selectedSlug ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-white rounded-3xl border border-slate-200 border-dashed min-h-[400px] shadow-sm">
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                       <ListPlus className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="font-display font-bold text-2xl text-slate-800 mb-3">No Topic Selected</h3>
                    <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                       Choose a topic from the sidebar to manage its questions, or create a new topic to get started.
                    </p>
                 </div>
              ) : (
                <>
                  {/* Action Tabs & Form Area */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
                    
                    {/* Tabs Header */}
                    <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto custom-scrollbar">
                       <button 
                         onClick={() => setActiveTab("manual")}
                         className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 font-display font-bold text-sm transition-all duration-300 whitespace-nowrap ${activeTab === "manual" ? "text-quizup-green bg-white shadow-[inset_0_-2px_0_rgba(46,204,113,1)]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
                       >
                         <PlusCircle className="w-4 h-4" /> Add Manual
                       </button>
                       <button 
                         onClick={() => setActiveTab("bulk")}
                         className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 font-display font-bold text-sm transition-all duration-300 whitespace-nowrap ${activeTab === "bulk" ? "text-purple-600 bg-white shadow-[inset_0_-2px_0_rgba(147,51,234,1)]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
                       >
                         <FileText className="w-4 h-4 text" /> Bulk Import
                       </button>
                       <button 
                         onClick={() => setActiveTab("ai")}
                         className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 font-display font-bold text-sm transition-all duration-300 whitespace-nowrap ${activeTab === "ai" ? "text-emerald-600 bg-white shadow-[inset_0_-2px_0_rgba(5,150,105,1)]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
                       >
                         <Sparkles className="w-4 h-4" /> AI Generate
                       </button>
                    </div>

                    {/* Form Container */}
                    <div className="p-5 md:p-8 relative">
                      <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br rounded-full blur-[100px] opacity-[0.2] pointer-events-none transition-colors duration-700 ${activeTab === 'manual' ? 'from-teal-200 to-blue-200' : activeTab === 'bulk' ? 'from-purple-200 to-pink-200' : 'from-emerald-200 to-teal-200'}`} />
                      
                      <div className="relative z-10">
                        {activeTab === "manual" && renderManualTab()}
                        {activeTab === "bulk" && renderBulkTab()}
                        {activeTab === "ai" && renderAiTab()}
                      </div>
                    </div>
                  </div>

                  {/* Questions List */}
                  {questions.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                           <Database className="w-5 h-5 text-amber-500" />
                           Topic Questions <span className="text-slate-500 font-normal text-sm">({questions.length})</span>
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                        {questions.map((q, qi) => {
                          const thumb = resolveQuestionImageUrl(q.imageUrl ?? undefined);
                          return (
                            <div key={q.id} className="group bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md p-3 rounded-xl flex gap-3 transition-all hover:-translate-y-0.5">
                              {thumb ? (
                                <div 
                                  className="w-32 h-32 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 cursor-pointer relative group/thumb"
                                  onClick={() => setEditingQuestion(q)}
                                  title="Change Image"
                                >
                                  <img src={thumb} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" loading="lazy" />
                                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 backdrop-blur-xs">
                                    <Upload className="w-4 h-4" />
                                    <span>CHANGE IMAGE</span>
                                  </div>
                                </div>
                              ) : (
                                <div 
                                  className="w-32 h-32 rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shrink-0 text-slate-400 cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition-all group/placeholder"
                                  onClick={() => setEditingQuestion(q)}
                                  title="Add Image"
                                >
                                  <ImageIcon className="w-7 h-7 mb-1 text-slate-300 group-hover/placeholder:text-slate-400 transition-colors" />
                                  <span className="text-[9px] font-bold text-slate-400 group-hover/placeholder:text-slate-500 transition-colors uppercase tracking-wider">ADD IMAGE</span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <p className="text-sm text-slate-900 font-medium line-clamp-2 leading-tight mb-1">
                                  <span className="text-amber-500 font-bold mr-1">#{qi + 1}</span> {q.text}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-auto">
                                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 truncate max-w-[120px]">
                                     <CheckCircle2 className="w-3 h-3 shrink-0" /> <span className="truncate">{q.options[q.correctIndex]}</span>
                                  </span>
                                  <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                     <Clock className="w-3 h-3" /> {q.timeLimit}s
                                  </span>
                                  <div className="flex items-center gap-1 ml-auto shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setEditingQuestion(q)}
                                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                                      title="Update / Upload Image"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(q.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Edit Image Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none" />
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setEditingQuestion(null)}
              className="absolute right-5 top-5 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-lg text-slate-900 leading-tight">Update Question Image</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {editingQuestion.text}
                </p>
              </div>
            </div>

            {/* Tab Selection */}
            <div className="flex bg-slate-50 rounded-xl p-1 mb-5 border border-slate-100">
              <button
                type="button"
                onClick={() => setModalActiveTab("link")}
                className={`flex-1 py-2 px-3 rounded-lg font-display font-bold text-xs transition-all flex items-center justify-center gap-2 ${modalActiveTab === "link" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Image Link
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab("upload")}
                className={`flex-1 py-2 px-3 rounded-lg font-display font-bold text-xs transition-all flex items-center justify-center gap-2 ${modalActiveTab === "upload" ? "bg-white text-quizup-green shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File
              </button>
            </div>

            {/* Content Area */}
            <div className="space-y-4 min-h-[140px] flex flex-col justify-center">
              {modalActiveTab === "link" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Image URL</Label>
                  <div className="relative">
                    <Input
                      value={modalImageUrl}
                      onChange={(e) => setModalImageUrl(e.target.value)}
                      className="bg-slate-50 border-slate-200 text-slate-900 pl-9 focus-visible:ring-blue-500 shadow-sm"
                      placeholder="Paste image link here..."
                    />
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Upload Local Image</Label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 hover:border-quizup-green bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-all duration-300 group">
                    {modalUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-quizup-green border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-slate-600">Uploading to cloud...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-quizup-green transition-colors" />
                        <span className="text-xs font-bold text-slate-700">Click to upload file</span>
                        <span className="text-[10px] text-slate-400">PNG, JPG, GIF or WEBP</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={modalUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setModalUploading(true);
                        try {
                          const url = await adminService.uploadQuestionImage(file);
                          setModalImageUrl(url);
                          toast.success("Image uploaded successfully!");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setModalUploading(false);
                        }
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Preview Area */}
              {resolveQuestionImageUrl(modalImageUrl) && (
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Preview</Label>
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 w-full h-36 flex items-center justify-center group shadow-inner">
                    <img src={resolveQuestionImageUrl(modalImageUrl)!} alt="Preview" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setModalImageUrl("")}
                      className="absolute inset-0 bg-red-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm gap-2 backdrop-blur-xs"
                    >
                      <ImageOff className="w-4 h-4" /> Remove Selected Image
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 relative z-10">
              {editingQuestion.imageUrl && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Are you sure you want to remove the image from this question?")) return;
                    try {
                      await adminService.removeQuestionImage(editingQuestion.id);
                      toast.success("Image removed");
                      const qs = await adminService.listQuestions(selectedSlug);
                      setQuestions(qs);
                      setEditingQuestion(null);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to remove image");
                    }
                  }}
                  className="px-4 h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-display font-bold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <ImageOff className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
              
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-display font-bold text-xs transition-all"
              >
                Cancel
              </button>
              
              <button
                type="button"
                disabled={modalUploading}
                onClick={async () => {
                  try {
                    const finalUrl = modalImageUrl.trim() || null;
                    await adminService.updateQuestionImage(editingQuestion.id, finalUrl);
                    toast.success("Image updated successfully!");
                    const qs = await adminService.listQuestions(selectedSlug);
                    setQuestions(qs);
                    setEditingQuestion(null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to update image");
                  }
                }}
                className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
