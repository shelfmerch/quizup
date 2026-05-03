import { API_URL } from "@/config/env";

const headers = () => {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  questionCount: number;
  isActive: boolean;
}

export interface AdminQuestion {
  id: string;
  categoryId: string;
  text: string;
  imageUrl?: string | null;
  options: string[];
  correctIndex: number;
  timeLimit: number;
  isActive: boolean;
}

export interface GenerateQuestionsQueuedResponse {
  accepted: boolean;
  categoryId: string;
  jobIds: string[];
  batches: number;
  message?: string;
}

export const adminService = {
  async listCategories(): Promise<AdminCategory[]> {
    const res = await fetch(`${API_URL}/admin/categories`, { headers: headers() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load topics");
    }
    const data = await res.json();
    return data.categories;
  },

  async createCategory(body: {
    name: string;
    slug?: string;
    icon?: string;
    color?: string;
    description?: string;
  }): Promise<AdminCategory> {
    const res = await fetch(`${API_URL}/admin/categories`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to create topic");
    }
    const data = await res.json();
    return data.category;
  },

  async listQuestions(categoryId: string): Promise<AdminQuestion[]> {
    const q = new URLSearchParams({ categoryId });
    const res = await fetch(`${API_URL}/admin/questions?${q}`, { headers: headers() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load questions");
    }
    const data = await res.json();
    return data.questions;
  },

  async uploadQuestionImage(file: File): Promise<string> {
    const token = localStorage.getItem("quizup_token");
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`${API_URL}/admin/upload-question-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Image upload failed");
    }
    const data = await res.json();
    return data.url as string;
  },

  async createQuestion(body: {
    categoryId: string;
    text: string;
    options: string[];
    correctIndex: number;
    timeLimit?: number;
    imageUrl?: string | null;
  }): Promise<AdminQuestion> {
    const res = await fetch(`${API_URL}/admin/questions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to create question");
    }
    const data = await res.json();
    return data.question;
  },

  async generateQuestionsQueued(body: {
    categoryId: string;
    count: number;
  }): Promise<GenerateQuestionsQueuedResponse> {
    const res = await fetch(`${API_URL}/admin/generate-questions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to queue generation");
    }
    return res.json();
  },
};
