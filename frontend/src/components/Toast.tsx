import { Check, X } from "lucide-react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 bg-blue-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
      <Check size={16} className="text-blue-300" />
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="text-blue-300 hover:text-white ml-2">
        <X size={14} />
      </button>
    </div>
  );
}
