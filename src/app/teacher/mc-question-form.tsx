"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createMcQuestions,
  updateMcQuestions,
  generateMcQuestionsByAi,
  type GenerateMcQuestionState,
  type McQuestionItem,
} from "@/app/actions";

type MaterialOption = {
  id: string;
  title: string;
};

type Props = {
  materials: MaterialOption[];
  setId?: string;
  initialTitle?: string;
  initialItems?: McQuestionItem[];
  initialReferenceMaterialIds?: string[];
};

const initialState: GenerateMcQuestionState = {
  generatedTitle: "",
  generatedItems: [],
};

function newEmptyItem(): McQuestionItem {
  return {
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    explanation: "",
  };
}

export default function McQuestionForm({
  materials,
  setId,
  initialTitle = "",
  initialItems = [newEmptyItem()],
  initialReferenceMaterialIds = [],
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [items, setItems] = useState<McQuestionItem[]>(initialItems);
  const [selectedReferenceMaterialIds, setSelectedReferenceMaterialIds] = useState<string[]>(initialReferenceMaterialIds);
  const [questionCount, setQuestionCount] = useState("");

  const [state, generateAction, isGenerating] = useActionState(generateMcQuestionsByAi, initialState);

  useEffect(() => {
    if (state.generatedTitle) {
      setTitle(state.generatedTitle);
    }

    if (state.generatedItems.length > 0) {
      setItems(state.generatedItems);
    }
  }, [state.generatedItems, state.generatedTitle]);

  const updateItem = <K extends keyof McQuestionItem>(index: number, key: K, value: McQuestionItem[K]) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };

  const addItem = () => {
    setItems((current) => [...current, newEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  };

  const toggleMaterial = (id: string, checked: boolean) => {
    setSelectedReferenceMaterialIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  };

  const serializedItems = JSON.stringify(items);
  const primaryReferenceMaterialId = selectedReferenceMaterialIds[0] ?? "";

  return (
    <form action={setId ? updateMcQuestions : createMcQuestions} className="mt-4 space-y-3">
      {setId && <input type="hidden" name="setId" value={setId} />}
      <input
        name="title"
        className="field"
        placeholder="MC set title"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <input type="hidden" name="itemsJson" value={serializedItems} />

      <section className="space-y-2 rounded-lg border border-[var(--stroke)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-semibold">Multiple Choice Questions</h3>
          <button type="button" className="btn-secondary" onClick={addItem}>
            Add MC Question
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`mc-${index}`} className="rounded-lg border border-[var(--stroke)] p-3 space-y-2">
              <label className="block text-xs font-semibold opacity-75">Question {index + 1}</label>
              <textarea
                className="field min-h-20"
                placeholder="Type question"
                required={index === 0}
                value={item.question}
                onChange={(event) => updateItem(index, "question", event.target.value)}
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="field"
                  placeholder="Option A"
                  value={item.optionA}
                  onChange={(event) => updateItem(index, "optionA", event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Option B"
                  value={item.optionB}
                  onChange={(event) => updateItem(index, "optionB", event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Option C"
                  value={item.optionC}
                  onChange={(event) => updateItem(index, "optionC", event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Option D"
                  value={item.optionD}
                  onChange={(event) => updateItem(index, "optionD", event.target.value)}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="field"
                  value={item.correctOption}
                  onChange={(event) =>
                    updateItem(index, "correctOption", event.target.value as McQuestionItem["correctOption"])
                  }
                >
                  <option value="A">Correct option: A</option>
                  <option value="B">Correct option: B</option>
                  <option value="C">Correct option: C</option>
                  <option value="D">Correct option: D</option>
                </select>
                <input
                  className="field"
                  placeholder="Optional explanation"
                  value={item.explanation}
                  onChange={(event) => updateItem(index, "explanation", event.target.value)}
                />
              </div>

              {items.length > 1 ? (
                <button type="button" className="text-xs underline" onClick={() => removeItem(index)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <input type="hidden" name="referenceMaterialId" value={primaryReferenceMaterialId} />

      <fieldset className="field h-34 overflow-y-auto p-3 space-y-2 bg-[var(--bg)] border border-[var(--stroke)] rounded-lg">
        <h3 className="text-sm font-semibold">Reference Materials</h3>
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
         Check the boxes for the materials you make reference or want AI to create questions according to the materials.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <label htmlFor="mcQuestionCount" className="mb-1 block text-xs font-semibold opacity-75">
            Number of question
          </label>
          <input
            id="mcQuestionCount"
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
              alert("Please enter number of question.");
              return;
            }
            if (selectedReferenceMaterialIds.length === 0) {
              e.preventDefault();
              alert("Please select at least one reference material.");
              return;
            }
          }}
        >
          {isGenerating ? "Generating..." : "Generate MC by AI"}
        </button>

        <button className="btn-primary" type="submit">
          {setId ? "Save Changes" : "Publish MC Questions"}
        </button>
      </div>

      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
    </form>
  );
}
