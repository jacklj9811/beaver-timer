import {
  DocumentData,
  FirestoreError,
  Query,
  QueryDocumentSnapshot,
  Unsubscribe,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { sessionsCollection, tasksCollection, userDoc } from "./firestore";
import type { User } from "firebase/auth";

function logPermissionDenied(scope: string, uid: string, error: FirestoreError) {
  console.error(
    `[firestore-permission-denied] scope=${scope} uid=${uid} code=${error.code} message=${error.message}`
  );
}

function attachErrorHandler(
  scope: string,
  uid: string,
  onError?: (error: FirestoreError) => void
) {
  return (unsubscribeRef: { current: Unsubscribe | null }) =>
    (error: FirestoreError) => {
      if (error.code === "permission-denied") {
        logPermissionDenied(scope, uid, error);
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
      }
      onError?.(error);
    };
}

export function subscribeUserSessions(
  user: User,
  opts: {
    onData: (docs: QueryDocumentSnapshot<DocumentData>[]) => void;
    onError?: (error: FirestoreError) => void;
  }
) {
  const sessionsQuery: Query<DocumentData> = query(
    sessionsCollection,
    where("user_uid", "==", user.uid),
    orderBy("ts", "asc")
  );
  const unsubscribeRef: { current: Unsubscribe | null } = { current: null };
  const handleError = attachErrorHandler("sessions", user.uid, opts.onError)(unsubscribeRef);
  unsubscribeRef.current = onSnapshot(
    sessionsQuery,
    { includeMetadataChanges: true },
    (snap) => opts.onData(snap.docs),
    handleError
  );
  return () => unsubscribeRef.current?.();
}

export function subscribeUserTasks(
  user: User,
  opts: {
    onData: (docs: QueryDocumentSnapshot<DocumentData>[]) => void;
    onError?: (error: FirestoreError) => void;
  }
) {
  const tasksQuery: Query<DocumentData> = query(tasksCollection, where("user_uid", "==", user.uid));
  const unsubscribeRef: { current: Unsubscribe | null } = { current: null };
  const handleError = attachErrorHandler("tasks", user.uid, opts.onError)(unsubscribeRef);
  unsubscribeRef.current = onSnapshot(
    tasksQuery,
    { includeMetadataChanges: true },
    (snap) => opts.onData(snap.docs),
    handleError
  );
  return () => unsubscribeRef.current?.();
}

export function subscribeUserProfile(
  user: User,
  opts: {
    onData: (data: DocumentData | undefined) => void;
    onError?: (error: FirestoreError) => void;
  }
) {
  const unsubscribeRef: { current: Unsubscribe | null } = { current: null };
  const handleError = attachErrorHandler("user-profile", user.uid, opts.onError)(unsubscribeRef);
  unsubscribeRef.current = onSnapshot(userDoc(user.uid), (snap) => opts.onData(snap.data()), handleError);
  return () => unsubscribeRef.current?.();
}

export function subscribeUserTags(
  user: User,
  opts: {
    tagsCollectionFactory: (uid: string) => Query<DocumentData>;
    onData: (docs: QueryDocumentSnapshot<DocumentData>[]) => void;
    onError?: (error: FirestoreError) => void;
  }
) {
  const tagsQuery = opts.tagsCollectionFactory(user.uid);
  const unsubscribeRef: { current: Unsubscribe | null } = { current: null };
  const handleError = attachErrorHandler("tags", user.uid, opts.onError)(unsubscribeRef);
  unsubscribeRef.current = onSnapshot(tagsQuery, (snap) => opts.onData(snap.docs), handleError);
  return () => unsubscribeRef.current?.();
}
