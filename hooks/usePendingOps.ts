"use client";
import { useEffect, useState } from "react";
import { getQueue, type PendingOp } from "@/utils/mergeOffline";

export function usePendingOps() {
  const [ops, setOps] = useState<PendingOp[]>([]);

  useEffect(() => {
    setOps(getQueue());

    const handleUpdate = () => {
      setOps(getQueue());
    };

    window.addEventListener("pending-ops-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("pending-ops-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return ops;
}
