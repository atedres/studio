
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Eye, ListFilter } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore"
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Action {
    id: string; // combination of docId and index
    description: string;
    source: string; // e.g., "CAA" or "DS"
    sourceId: string; // document id
    responsable: string;
    echeance?: Timestamp;
    status: string;
    isOverdue: boolean;
}

export default function ActionPlanPage() {
    const [actions, setActions] = useState<Action[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchActions = async () => {
            setLoading(true);
            const allActions: Action[] = [];

            try {
                // Fetch from Chasses Aux Anomalies
                const caasQuery = query(collection(db, "chassesAuxAnomalies"), where("status", "!=", "Brouillon"));
                const caasSnapshot = await getDocs(caasQuery);
                caasSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.anomalies && Array.isArray(data.anomalies)) {
                        data.anomalies.forEach((anomalie: any, index: number) => {
                            if (anomalie.avancement !== 'Réalisée') {
                                allActions.push({
                                    id: `${doc.id}-${index}`,
                                    description: anomalie.description,
                                    source: 'CAA',
                                    sourceId: doc.id,
                                    responsable: anomalie.responsable || 'N/A',
                                    echeance: anomalie.echeance,
                                    status: anomalie.avancement,
                                    isOverdue: anomalie.echeance ? isPast(anomalie.echeance.toDate()) && anomalie.avancement !== 'Réalisée' : false
                                });
                            }
                        });
                    }
                });

                // Fetch from Dialogues Sécurité
                const dsQuery = query(collection(db, "dialoguesSecurite"), where("status", "!=", "Brouillon"));
                const dsSnapshot = await getDocs(dsQuery);
                dsSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.anomalies && Array.isArray(data.anomalies)) {
                        data.anomalies.forEach((anomalie: any, index: number) => {
                             if (anomalie.statut !== 'Réalisée') {
                                allActions.push({
                                    id: `${doc.id}-${index}`,
                                    description: anomalie.description,
                                    source: 'DS',
                                    sourceId: doc.id,
                                    responsable: anomalie.responsable || 'N/A',
                                    echeance: anomalie.echeance,
                                    status: anomalie.statut,
                                    isOverdue: anomalie.echeance ? isPast(anomalie.echeance.toDate()) && anomalie.statut !== 'Réalisée' : false
                                });
                            }
                        });
                    }
                });

                // Sort actions by due date (oldest first)
                allActions.sort((a, b) => {
                    if (a.echeance && b.echeance) {
                        return a.echeance.seconds - b.echeance.seconds;
                    }
                    if (a.echeance) return -1;
                    if (b.echeance) return 1;
                    return 0;
                });
                
                setActions(allActions);
            } catch (error) {
                console.error("Error fetching actions: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActions();
    }, []);

    const getStatusVariant = (status: string, isOverdue: boolean) => {
        if (isOverdue) return "destructive";
        switch (status) {
            case "Réalisée": return "default";
            case "En cours": return "outline";
            case "Non réalisée": return "destructive";
            default: return "secondary";
        }
    };

    const renderSkeleton = () => (
        [...Array(5)].map((_, i) => (
            <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-10 w-10" /></TableCell>
            </TableRow>
        ))
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Plan d'Action Global / خطة عمل شاملة</h1>
                <p className="text-muted-foreground">
                    Vue centralisée de toutes les actions correctives et préventives ouvertes.
                </p>
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Liste des Actions Ouvertes</CardTitle>
                        <CardDescription>Actions issues des Dialogues Sécurité et des Chasses aux Anomalies.</CardDescription>
                    </div>
                    <Button variant="outline">
                        <ListFilter className="mr-2 h-4 w-4" />
                        Filtrer
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Description de l'action</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead>Échéance</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? renderSkeleton() : actions.length > 0 ? actions.map((action) => (
                                <TableRow key={action.id} className={action.isOverdue ? "bg-destructive/10" : ""}>
                                    <TableCell className="font-medium">{action.description}</TableCell>
                                    <TableCell>{action.source}</TableCell>
                                    <TableCell>{action.responsable}</TableCell>
                                    <TableCell>
                                        {action.echeance ? format(action.echeance.toDate(), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(action.status, action.isOverdue) as any}>
                                            {action.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="icon">
                                            <Link href={action.source === 'CAA' ? `/dashboard/anomalies/${action.sourceId}` : `/dashboard/audits/${action.sourceId}`}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Voir la source</span>
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Aucune action ouverte. Excellent travail !
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
