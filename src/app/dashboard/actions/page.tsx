
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
import { format, isPast, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"

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

const demoActions: Action[] = [
    { id: 'demo-1', description: "Installer une nouvelle signalisation de sécurité", source: 'CAA', sourceId: 'demo-caa-1', responsable: 'J. Dupont', echeance: Timestamp.fromDate(subDays(new Date(), 5)), status: 'En cours', isOverdue: true },
    { id: 'demo-2', description: "Vérifier le harnais de sécurité", source: 'DS', sourceId: 'demo-ds-1', responsable: 'A. Martin', echeance: Timestamp.fromDate(new Date()), status: 'En cours', isOverdue: false },
    { id: 'demo-3', description: "Réparer une fuite d'huile mineure", source: 'CAA', sourceId: 'demo-caa-2', responsable: 'F. Bernard', echeance: Timestamp.fromDate(subDays(new Date(), 10)), status: 'Non réalisée', isOverdue: true },
    { id: 'demo-4', description: "Former l'équipe sur la nouvelle procédure LOTO", source: 'DS', sourceId: 'demo-ds-2', responsable: 'C. Petit', echeance: undefined, status: 'En cours', isOverdue: false },
];

export default function ActionPlanPage() {
    const { isDemoMode } = useAuth();
    const [actions, setActions] = useState<Action[]>([])
    const [filteredActions, setFilteredActions] = useState<Action[]>([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({
        overdueOnly: false,
        source: 'all', // 'all', 'CAA', 'DS'
        status: 'all', // 'all', 'En cours', 'Non réalisée'
    });

    useEffect(() => {
        if (isDemoMode) {
            setActions(demoActions);
            setLoading(false);
            return;
        }

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
    }, [isDemoMode]);

    useEffect(() => {
        const tempActions = actions.filter(action => {
            const sourceMatch = filters.source === 'all' || action.source === filters.source;
            const statusMatch = filters.status === 'all' || action.status === filters.status;
            const overdueMatch = !filters.overdueOnly || action.isOverdue;
            return sourceMatch && statusMatch && overdueMatch;
        });
        setFilteredActions(tempActions);
    }, [actions, filters]);

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

    const getEmptyStateMessage = () => {
        if (actions.length === 0) {
            return "Aucune action ouverte. Excellent travail !";
        }
        return "Aucune action ne correspond à vos critères de filtre.";
    }

    const getLinkHref = (action: Action) => {
        return action.source === 'CAA' ? `/dashboard/anomalies/${action.sourceId}` : `/dashboard/audits/${action.sourceId}`;
    }

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
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <ListFilter className="mr-2 h-4 w-4" />
                                Filtrer
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Filtrer les actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={filters.overdueOnly}
                                onCheckedChange={(checked) => setFilters(prev => ({...prev, overdueOnly: !!checked}))}
                            >
                                En retard uniquement
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Source</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={filters.source} onValueChange={(value) => setFilters(prev => ({ ...prev, source: value }))}>
                                        <DropdownMenuRadioItem value="all">Toutes</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="CAA">CAA</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="DS">DS</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                             <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Statut</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                                        <DropdownMenuRadioItem value="all">Tous</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="En cours">En cours</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Non réalisée">Non réalisée</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                            {loading ? renderSkeleton() : filteredActions.length > 0 ? filteredActions.map((action) => (
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
                                            <Link href={getLinkHref(action)}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Voir la source</span>
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                       {getEmptyStateMessage()}
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
