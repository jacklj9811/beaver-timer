import { useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export type SubscriptionFactory = (user: User) => Array<() => void>;

export function useAuthSubscriptions(
  subscribeForUser: SubscriptionFactory,
  onUserChange?: (user: User | null) => void
) {
  useEffect(() => {
    let unsubscribers: Array<() => void> = [];

    const clearSubscriptions = () => {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      clearSubscriptions();
      onUserChange?.(user);
      if (!user) return;
      unsubscribers = subscribeForUser(user).filter(Boolean);
    });

    return () => {
      clearSubscriptions();
      unsubscribeAuth();
    };
  }, [onUserChange, subscribeForUser]);
}
