
"use client"

import React, { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore"
import { History } from "lucide-react"
import { format } from "date-fns"
import { fr } from 'date-fns/locale'
import { Badge } from "@/components/ui/badge"

interface ActivityLog {
    id: string;
    timestamp: Timestamp;
    userEmail: string;
    userName: string;
    userRole: string;
    action: string;
    details: Record<string, any>;
}

export default function ActivityLogPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, "activityLog"), orderBy("timestamp", "desc"));
                const querySnapshot = await getDocs(q);
                const logsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as ActivityLog[];
                setLogs(logsData);
            } catch (error) {
                console.error("Error fetching activity logs: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const renderDetails = (details: Record<string, any>) => {
        if (Object.keys(details).length === 0) return 'N/A';
        return Object.entries(details)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    const renderSkeleton = () => (
        [...Array(10)].map((_, i) => (
            <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
            </TableRow>
        ))
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Journal d'Activité / سجل النشاطات</h1>
                <p className="text-muted-foreground">
                    Suivi de toutes les actions importantes réalisées sur la plateforme.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historique des actions</CardTitle>
                    <CardDescription>Liste chronologique des activités des utilisateurs.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Date & Heure</TableHead>
                                <TableHead>Utilisateur</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Détails</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? renderSkeleton() : logs.length > 0 ? logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        {log.timestamp ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: fr }) : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{log.userName}</div>
                                        <div className="text-sm text-muted-foreground">{log.userEmail}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{log.action}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{renderDetails(log.details)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <History className="h-8 w-8" />
                                            <span>Aucune activité enregistrée pour le moment.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
