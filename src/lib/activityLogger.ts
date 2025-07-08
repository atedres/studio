
'use server';

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { AppUser } from "@/hooks/use-auth";

export const logActivity = async (
    user: AppUser | null,
    action: string,
    details?: Record<string, any>
) => {
    if (!user) {
        console.warn("Attempted to log activity without a user.");
        return;
    }

    try {
        await addDoc(collection(db, "activityLog"), {
            timestamp: serverTimestamp(),
            userEmail: user.email || 'N/A',
            userName: user.displayName || 'N/A',
            userRole: user.role || 'N/A',
            action: action,
            details: details || {},
        });
    } catch (error) {
        console.error("Error logging activity:", error);
        // Fail silently in the UI, but log the error.
    }
};
