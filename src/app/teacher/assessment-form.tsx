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
};

export default function AssessmentForm({ materials }: Props) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [referenceMaterialId, setReferenceMaterialId] = useState("");

  const [state, generateAction, isGenerating] = useActionState(generateAssessmentByAi, initialState);

  useEffect(() => {
    if (state.generatedTitle) {
      setTitle(state.generatedTitle);
    }
    if (state.generatedPrompt) {
      setPrompt(state.generatedPrompt);
    }
    if (state.generatedAnswer) {
      setAnswer(state.generatedAnswer);
    }
  }, [state.generatedAnswer, state.generatedPrompt, state.generatedTitle]);

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
      <textarea
        name="prompt"
        className="field min-h-24"
        placeholder="Core question or task"
        required
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <textarea
        name="answer"
        className="field min-h-24"
        placeholder="Answer of the task"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
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

      <div className="flex flex-wrap gap-3">
        <button
          className="btn-secondary"
          type="submit"
          formAction={generateAction}
          formNoValidate
          disabled={isGenerating}
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
