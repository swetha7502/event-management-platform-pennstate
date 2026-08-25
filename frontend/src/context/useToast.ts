import { useState, useCallback } from "react";

export function useToast() {
  const [message, setMessage] = useState("");

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2200);
  }, []);

  return { message, showToast, clear: () => setMessage("") };
}
