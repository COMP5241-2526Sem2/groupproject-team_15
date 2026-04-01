"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createAssessment,
  updateAssessment,
  generateAssessmentByAi,
  type GenerateAssessmentState,
} from "@/app/actions";

type MaterialOption = {
  id: string;
  title: string;
};

type Props = {
  materials: MaterialOption[];
  assessmentId?: string;
  initialTitle?: string;
  initialQuestions?: string[];
  initialAnswers?: string[];
  initialReferenceMaterialIds?: string[];
};

const initialState: GenerateAssessmentState = {
  generatedTitle: "",
  generatedPrompt: "",
  generatedAnswer: "",
  generatedQuestions: [],
  generatedAnswers: [],
};

function splitStructuredLines(text: string) {
  return text
    .split(/\r?\n+/)
    .map((line) =>
      line
        .replace(/^\s*(?:question|answer|q|a)?\s*\d+[\s).:-]*/i, "")
        .replace(/^\s*[-*]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

export default function AssessmentForm({
  materials,
  assessmentId,
  initialTitle = "",
  initialQuestions = [""],
  initialAnswers = [""],
  initialReferenceMaterialIds = [],
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<string[]>(initialQuestions);
  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [selectedReferenceMaterialIds, setSelectedReferenceMaterialIds] = useState<string[]>(initialReferenceMaterialIds);
  const [questionCount, setQuestionCount] = useState("");

  const [state, generateAction, isGenerating] = useActionState(generateAssessmentByAi, initialState);
  const [lastProcessedState, setLastProcessedState] = useState(initialState);

  useEffect(() => {
    if (state === lastProcessedState) return;
    setLastProcessedState(state);

    if (state.generatedTitle && !title) {
      setTitle(state.generatedTitle);
    }

    let newQuestions: string[] = [];
    if (state.generatedQuestions.length > 0) {
      newQuestions = state.generatedQuestions;
    } else if (state.generatedPrompt) {
      const parsedQuestions = splitStructuredLines(state.generatedPrompt);
      if (parsedQuestions.length > 0) {
        newQuestions = parsedQuestions;
      }
    }

    let newAnswers: string[] = [];
    if (state.generatedAnswers.length > 0) {
      newAnswers = state.generatedAnswers;
    } else if (state.generatedAnswer) {
      const parsedAnswers = splitStructuredLines(state.generatedAnswer);
      if (parsedAnswers.length > 0) {
        newAnswers = parsedAnswers;
      }
    }

    if (newQuestions.length > 0 || newAnswers.length > 0) {
      const updatedQs = [...questions];
      const updatedAs = [...answers];

      let aiIndex = 0;
      for (let i = 0; i < Math.max(updatedQs.length, updatedAs.length); i++) {
        // Only fill where the existing question is empty
        const qIsEmpty = !updatedQs[i]?.trim();
        if (qIsEmpty && aiIndex < Math.max(newQuestions.length, newAnswers.length)) {
          updatedQs[i] = newQuestions[aiIndex] || "";
          updatedAs[i] = newAnswers[aiIndex] || "";
          aiIndex++;
        }
      }

      // Append any remaining generated items
      while (aiIndex < Math.max(newQuestions.length, newAnswers.length)) {
        updatedQs.push(newQuestions[aiIndex] || "");
        updatedAs.push(newAnswers[aiIndex] || "");
        aiIndex++;
      }

      setQuestions(updatedQs);
      setAnswers(updatedAs);
    }
  }, [state, lastProcessedState, title, questions, answers]);

  const toggleMaterial = (id: string, checked: boolean) => {
    setSelectedReferenceMaterialIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  };

  const serializedPrompt = questions
    .map((question, index) => question.trim() && `Q${index + 1}. ${question.trim()}`)
    .filter(Boolean)
    .join("\n");

  const serializedAnswer = answers
    .map((answerLine, index) => answerLine.trim() && `A${index + 1}. ${answerLine.trim()}`)
    .filter(Boolean)
    .join("\n");

  const updateQuestion = (index: number, value: string) => {
    setQuestions((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const updateAnswer = (index: number, value: string) => {
    setAnswers((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  };

  const removeAnswer = (index: number) => {
    setAnswers((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  };

  return (
    <form action={assessmentId ? updateAssessment : createAssessment} className="mt-4 space-y-3">
      {assessmentId && <input type="hidden" name="assessmentId" value={assessmentId} />}
      <input
        name="title"
        className="field"
        placeholder="Assessment title"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <input type="hidden" name="prompt" value={serializedPrompt} />
      <input type="hidden" name="answer" value={serializedAnswer} />

      <section className="space-y-2 rounded-lg border border-[var(--stroke)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Questions</h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setQuestions((current) => [...current, ""])}
          >
            Add Question Line
          </button>
        </div>

        <div className="space-y-2">
          {questions.map((question, index) => (
            <div key={`question-${index}`} className="rounded-lg border border-[var(--stroke)] p-3">
              <label className="mb-2 block text-xs font-semibold opacity-75">Question {index + 1}</label>
              <textarea
                className="field min-h-20"
                placeholder="Type question"
                required={index === 0}
                value={question}
                onChange={(event) => updateQuestion(index, event.target.value)}
              />
              {questions.length > 1 ? (
                <button
                  type="button"
                  className="mt-2 text-xs underline"
                  onClick={() => removeQuestion(index)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-[var(--stroke)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Model Answers</h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setAnswers((current) => [...current, ""])}
          >
            Add Answer Line
          </button>
        </div>

        <div className="space-y-2">
          {answers.map((answerLine, index) => (
            <div key={`answer-${index}`} className="rounded-lg border border-[var(--stroke)] p-3">
              <label className="mb-2 block text-xs font-semibold opacity-75">Answer {index + 1}</label>
              <textarea
                className="field min-h-20"
                placeholder="Type model answer"
                value={answerLine}
                onChange={(event) => updateAnswer(index, event.target.value)}
              />
              {answers.length > 1 ? (
                <button
                  type="button"
                  className="mt-2 text-xs underline"
                  onClick={() => removeAnswer(index)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <input type="hidden" name="referenceMaterialId" value={selectedReferenceMaterialIds[0] ?? ""} />

      <fieldset className="field h-34 overflow-y-auto p-3 space-y-2 bg-[var(--bg)] border border-[var(--stroke)] rounded-lg">
        <legend className="sr-only">Reference Materials</legend>
        {materials.map((material) => (
          <label key={material.id} className="flex flex-row items-start gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              name="referenceMaterialIds"
              value={material.id}
              checked={selectedReferenceMaterialIds.includes(material.id)}
              onChange={(e) => toggleMaterial(material.id, e.target.checked)}
              className="mt-0.5 size-4 rounded-sm border-gray-300"
            />
            <span className="flex-1 opacity-90">{material.title}</span>
          </label>
        ))}
        {materials.length === 0 && <p className="text-xs opacity-70">No materials available.</p>}
      </fieldset>
      <p className="text-xs opacity-70">
        Check the boxes for the materials you want to use.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <label htmlFor="questionCount" className="mb-1 block text-xs font-semibold opacity-75">
            AI Question Count
          </label>
          <input
            id="questionCount"
            name="questionCount"
            type="number"
            min={1}
            max={20}
            step={1}
            className="field"
            placeholder="e.g. 5"
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
          />
        </div>

        <button
          className="btn-secondary"
          type="submit"
          formAction={generateAction}
          formNoValidate
          disabled={isGenerating}
          onClick={(e) => {
            if (!questionCount.trim()) {
              e.preventDefault();
              alert("Please enter AI Question Count.");
              return;
            }
            if (selectedReferenceMaterialIds.length === 0) {
              e.preventDefault();
              alert("Please select at least one reference material.");
              return;
            }
          }}
        >
          {isGenerating ? "Generating..." : "Generate by AI"}
        </button>
        <button className="btn-primary" type="submit">
          {assessmentId ? "Save Changes" : "Publish Assessment"}
        </button>
      </div>

      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
    </form>
  );
}
