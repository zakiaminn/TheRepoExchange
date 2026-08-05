export type ToastMessage = {
  text: string;
  type: "success" | "error";
} | null;

// bottom-right toast, used for trade fills/rejections and any other one-off status
// message. purely presentational - whoever's using it owns the message state and the
// setTimeout that clears it after a few seconds, this component just renders whatever
// it's handed (or nothing, if message is null)
export function Toast({ message }: { message: ToastMessage }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="px-4 py-3 text-sm shadow-brutal-sm flex items-center gap-3 border-2 border-edge bg-card text-ink">
        <div className={`h-2 w-2 rounded-full ${message.type === "success" ? "bg-bull" : "bg-bear"}`}></div>
        {message.text}
      </div>
    </div>
  );
}
