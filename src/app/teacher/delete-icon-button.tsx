"use client";

type DeleteIconButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  fieldName: string;
  fieldValue: string;
  ariaLabel: string;
  title: string;
  confirmMessage: string;
};

export default function DeleteIconButton({
  action,
  fieldName,
  fieldValue,
  ariaLabel,
  title,
  confirmMessage,
}: DeleteIconButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name={fieldName} value={fieldValue} />
      <button
        type="submit"
        className="rounded-md p-2 text-red-500 transition hover:bg-red-500/10"
        aria-label={ariaLabel}
        title={title}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 6l1 14h8l1-14M10 10v7M14 10v7"
          />
        </svg>
      </button>
    </form>
  );
}