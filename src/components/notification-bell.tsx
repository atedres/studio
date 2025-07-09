
"use client"

import React, { useState, useEffect } from 'react'
import Link from "next/link"
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuth } from '@/hooks/use-auth'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from "@/lib/utils"

interface Notification {
    id: string;
    message: string;
    href: string;
    timestamp: Timestamp;
}

const READ_NOTIFICATIONS_KEY = "hse_read_notifications";

export function NotificationBell() {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

    const canManage = user && ['niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role)

    // Load read notifications from localStorage on mount
    useEffect(() => {
        try {
            const storedReadIds = localStorage.getItem(READ_NOTIFICATIONS_KEY);
            if (storedReadIds) {
                setReadNotifications(new Set(JSON.parse(storedReadIds)));
            }
        } catch (error) {
            console.error("Failed to parse read notifications from localStorage", error);
            // In case of parsing error, clear the faulty key
            localStorage.removeItem(READ_NOTIFICATIONS_KEY);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setLoading(false)
            return
        }

        const fetchNotifications = async () => {
            setLoading(true)
            const allNotifs: Notification[] = []

            // 1. Dialogues en attente de validation (for managers)
            if (canManage) {
                try {
                    const q = query(collection(db, 'dialoguesSecurite'), where('status', '==', 'En attente de validation'))
                    const snapshot = await getDocs(q)
                    snapshot.forEach(doc => {
                        const data = doc.data()
                        allNotifs.push({
                            id: `ds-validate-${doc.id}`,
                            message: `Nouveau DS de ${data.observateur} à valider.`,
                            href: `/dashboard/audits/${doc.id}/validate`,
                            timestamp: data.createdAt || Timestamp.now()
                        })
                    })
                } catch (e) { console.error("Error fetching validation notifications:", e) }
            }

            const myName = user.displayName;
            if (myName) {
                // 2. Tâches assignées
                try {
                    const dsTasksQuery = query(collection(db, 'dialoguesSecurite'), where('anomalies', '!=', []));
                    const dsTasksSnapshot = await getDocs(dsTasksQuery);
                    dsTasksSnapshot.forEach(doc => {
                        doc.data().anomalies.forEach((anomalie: any, index: number) => {
                            if (anomalie.responsable === myName && anomalie.statut !== 'Réalisée') {
                                allNotifs.push({
                                    id: `task-ds-${doc.id}-${index}`,
                                    message: `Tâche : ${anomalie.description.substring(0, 40)}...`,
                                    href: `/dashboard/audits/${doc.id}`,
                                    timestamp: doc.data().createdAt || Timestamp.now()
                                });
                            }
                        });
                    });
                } catch (e) { console.error("Error fetching DS tasks:", e) }

                try {
                    const caaTasksQuery = query(collection(db, 'chassesAuxAnomalies'), where('anomalies', '!=', []));
                    const caaTasksSnapshot = await getDocs(caaTasksQuery);
                    caaTasksSnapshot.forEach(doc => {
                        doc.data().anomalies.forEach((anomalie: any, index: number) => {
                            if (anomalie.responsable === myName && anomalie.avancement !== 'Réalisée') {
                                allNotifs.push({
                                    id: `task-caa-${doc.id}-${index}`,
                                    message: `Tâche : ${anomalie.description.substring(0, 40)}...`,
                                    href: `/dashboard/anomalies/${doc.id}`,
                                    timestamp: doc.data().createdAt || Timestamp.now()
                                });
                            }
                        });
                    });
                } catch (e) { console.error("Error fetching CAA tasks:", e) }

                // 3. Réunions
                try {
                    const meetingsQuery = query(collection(db, 'reunions'), where('status', '==', 'Planifiée'));
                    const meetingsSnapshot = await getDocs(meetingsQuery);
                    meetingsSnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.collaborateurs && data.collaborateurs.includes(myName)) {
                             allNotifs.push({
                                id: `meeting-${doc.id}`,
                                message: `Invitation réunion : ${data.objet}`,
                                href: `/dashboard/reunions/${doc.id}`,
                                timestamp: data.date,
                            });
                        }
                    });
                } catch(e) { console.error("Error fetching meetings:", e) }
            }

            // 4. Corrections demandées
            try {
                const correctionsQuery = query(collection(db, 'dialoguesSecurite'), where('createdBy', '==', user.uid), where('status', '==', 'À corriger'))
                const correctionsSnapshot = await getDocs(correctionsQuery);
                correctionsSnapshot.forEach(doc => {
                    allNotifs.push({
                        id: `correction-${doc.id}`,
                        message: `Correction demandée pour votre DS.`,
                        href: `/dashboard/audits/${doc.id}/edit`,
                        timestamp: doc.data().dateValidation || Timestamp.now()
                    })
                });
            } catch(e) { console.error("Error fetching corrections:", e) }

            // Sort and set unique notifications
            allNotifs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
            const uniqueNotifs = allNotifs.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            
            setNotifications(uniqueNotifs);
            setLoading(false);
        }

        fetchNotifications();
    }, [user, canManage])

    const handleNotificationClick = (notificationId: string) => {
        const newReadNotifications = new Set(readNotifications);
        newReadNotifications.add(notificationId);
        setReadNotifications(newReadNotifications);
        localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(newReadNotifications)));
        setIsOpen(false);
    };

    const unreadCount = notifications.filter(n => !readNotifications.has(n.id)).length;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-[1.2rem] w-[1.2rem]" />
                    {!loading && unreadCount > 0 && (
                         <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                         </div>
                    )}
                    <span className="sr-only">Ouvrir les notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-2">
                <div className="flex items-center justify-between p-2">
                    <h4 className="font-medium text-sm">Notifications</h4>
                </div>
                <div className="max-h-[24rem] overflow-y-auto">
                    {loading ? (
                         <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                         </div>
                    ) : notifications.length > 0 ? (
                        <div className="flex flex-col">
                            {notifications.map(notif => (
                                <Link
                                    key={notif.id}
                                    href={notif.href}
                                    onClick={() => handleNotificationClick(notif.id)}
                                    className={cn(
                                        "block hover:bg-secondary rounded-md p-2 border-b last:border-b-0 transition-colors",
                                        !readNotifications.has(notif.id) && "bg-accent/10"
                                    )}
                                >
                                     <p className="text-sm font-medium">{notif.message}</p>
                                     <p className="text-xs text-muted-foreground">{formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true, locale: fr })}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="p-4 text-sm text-center text-muted-foreground">Vous n'avez aucune nouvelle notification.</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
