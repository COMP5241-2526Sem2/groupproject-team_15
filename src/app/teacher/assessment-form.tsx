"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createAssessment,
  generateAssessmentByAi,
  type GenerateAssessmentState,
} from "@/app/actions";

type MaterialOption = {
  id: string;
  title: string;
};

type Props = {
  materials: MaterialOption[];
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

export default function AssessmentForm({ materials }: Props) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [answers, setAnswers] = useState<string[]>([""]);
  const [referenceMaterialId, setReferenceMaterialId] = useState("");
  const [questionCount, setQuestionCount] = useState("");

  const [state, generateAction, isGenerating] = useActionState(generateAssessmentByAi, initialState);

  useEffect(() => {
    if (state.generatedTitle) {
      setTitle(state.generatedTitle);
    }

    if (state.generatedQuestions.length > 0) {
      setQuestions(state.generatedQuestions);
    } else if (state.generatedPrompt) {
      const parsedQuestions = splitStructuredLines(state.generatedPrompt);
      if (parsedQuestions.length > 0) {
        setQuestions(parsedQuestions);
      }
    }

    if (state.generatedAnswers.length > 0) {
      setAnswers(state.generatedAnswers);
    } else if (state.generatedAnswer) {
      const parsedAnswers = splitStructuredLines(state.generatedAnswer);
      if (parsedAnswers.length > 0) {
        setAnswers(parsedAnswers);
      }
    }
  }, [
    state.generatedAnswer,
    state.generatedAnswers,
    state.generatedPrompt,
    state.generatedQuestions,
    state.generatedTitle,
  ]);

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
    <form action={createAssessment} className="mt-4 space-y-3">
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

      <select
        name="referenceMaterialId"
        className="field"
        value={referenceMaterialId}
        onChange={(event) => setReferenceMaterialId(event.target.value)}
      >
        <option value="">No reference material</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>
            {material.title}
          </option>
        ))}
      </select>

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
            required
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
          disabled={isGenerating || !questionCount.trim()}
          title={!questionCount.trim() ? "Enter question count first" : undefined}
        >
          {isGenerating ? "Generating..." : "Generate by AI"}
        </button>
        <button className="btn-primary" type="submit">
          Publish Assessment
        </button>
      </div>

      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
    </form>
  );
}
