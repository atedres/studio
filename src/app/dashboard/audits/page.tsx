
"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { FilePlus2, Eye, TrendingUp, AlertOctagon, UserCheck, ListChecks } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, where } from "firebase/firestore"
import { startOfMonth } from 'date-fns'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import { useAuth } from "@/hooks/use-auth"


interface Anomaly {
    type: "AD" | "IS" | "SD";
    description: string;
}

interface Dialogue {
  id: string;
  date: {
      seconds: number;
      nanoseconds: number;
  };
  observateur: string;
  zone: string;
  anomalies: Anomaly[];
  status: string;
}

interface DialogueStats {
    dialoguesCeMois: number;
    totalAnomalies: number;
    topObservateur: { name: string; count: number };
    anomaliesParType: { name: string; value: number; fill: string }[];
}

const ANOMALY_TYPE_COLORS: { [key: string]: string } = {
    "Acte Dangereux": "hsl(var(--chart-1))",
    "Situation Dangereuse": "hsl(var(--chart-2))",
    "Système Défaillant": "hsl(var(--chart-3))",
    "Autre": "hsl(var(--chart-4))",
};
const ANOMALY_TYPE_MAP: { [key: string]: string } = {
    "AD": "Acte Dangereux",
    "IS": "Situation Dangereuse",
    "SD": "Système Défaillant",
};


export default function DialoguesSecuritePage() {
  const [allDialogues, setAllDialogues] = useState<Dialogue[]>([])
  const [stats, setStats] = useState<DialogueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth();
  
  const canManage = user && ['niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role);

  const { pendingDialogues, historicalDialogues } = useMemo(() => {
    const pending = allDialogues.filter(d => d.status === 'En attente de validation');
    const historical = allDialogues.filter(d => d.status !== 'En attente de validation');
    return { pendingDialogues: pending, historicalDialogues: historical };
  }, [allDialogues]);

  useEffect(() => {
    const calculateStats = (data: Dialogue[]) => {
        const now = new Date();
        const debutMois = startOfMonth(now);

        const dialoguesCeMois = data.filter(d => new Date(d.date.seconds * 1000) >= debutMois).length;
        
        const allAnomalies = data.flatMap(d => d.anomalies);

        const observateurCounts = data.reduce((acc, dialogue) => {
            acc[dialogue.observateur] = (acc[dialogue.observateur] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topObservateur = Object.entries(observateurCounts).reduce((top, [name, count]) => {
            return count > top.count ? { name, count } : top;
        }, { name: 'N/A', count: 0 });

        const anomaliesParTypeMap = new Map<string, number>();
        allAnomalies.forEach(anomaly => {
            const typeName = ANOMALY_TYPE_MAP[anomaly.type] || "Autre";
            anomaliesParTypeMap.set(typeName, (anomaliesParTypeMap.get(typeName) || 0) + 1);
        });

        const anomaliesParType = Array.from(anomaliesParTypeMap.entries()).map(([name, value]) => ({
          name,
          value,
          fill: ANOMALY_TYPE_COLORS[name] || "hsl(var(--chart-5))",
        }));


        setStats({
            dialoguesCeMois,
            totalAnomalies: allAnomalies.length,
            topObservateur,
            anomaliesParType,
        });
    }

    const fetchDialogues = async () => {
        if (!user) return;
        setLoading(true)
        try {
            let dialoguesQuery;
            const baseQuery = collection(db, "dialoguesSecurite");

            switch (user.role) {
                case 'niveau1':
                case 'niveau2':
                    dialoguesQuery = query(baseQuery, where("createdBy", "==", user.uid), orderBy("date", "desc"));
                    break;
                case 'niveau3':
                case 'niveau4':
                case 'niveau5':
                    dialoguesQuery = query(baseQuery, where("zone", "==", user.entity), orderBy("date", "desc"));
                    break;
                case 'admin':
                    dialoguesQuery = query(baseQuery, orderBy("date", "desc"));
                    break;
                default:
                    // Return no results if role is not recognized
                    dialoguesQuery = query(baseQuery, where("createdBy", "==", "no-one"));
                    break;
            }

            const querySnapshot = await getDocs(dialoguesQuery);
            const dialoguesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Dialogue[];
            setAllDialogues(dialoguesData);
            calculateStats(dialoguesData);
        } catch (error) {
            console.error("Error fetching dialogues: ", error);
        } finally {
            setLoading(false);
        }
    };

    fetchDialogues();
  }, [user]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Validé":
      case "Clôturée":
        return "default"
      case "Brouillon":
        return "secondary"
      case "En attente de validation":
      case "Rejeté":
        return "destructive"
      case "Actions correctives ouvertes":
      case "À corriger":
        return "outline"
      default:
        return "secondary"
    }
  }

  const renderSkeleton = (rows = 5) => (
    [...Array(rows)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell><Skeleton className="h-10 w-24" /></TableCell>
      </TableRow>
    ))
  )

  const renderTable = (data: Dialogue[], emptyMessage: string, isPendingTab = false) => (
    <Table>
        <TableHeader>
        <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Observateur</TableHead>
            <TableHead>Zone / Unité</TableHead>
            <TableHead>Anomalies Signalées</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
        </TableRow>
        </TableHeader>
        <TableBody>
        {loading ? renderSkeleton() : data.length > 0 ? data.map((dialogue) => (
            <TableRow key={dialogue.id}>
            <TableCell>{new Date(dialogue.date.seconds * 1000).toLocaleDateString('fr-FR')}</TableCell>
            <TableCell>{dialogue.observateur}</TableCell>
            <TableCell>{dialogue.zone}</TableCell>
            <TableCell className="max-w-[300px]">
                 {dialogue.anomalies.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-xs">
                        {dialogue.anomalies.map((anomalie, index) => (
                            <li key={index} className="truncate" title={anomalie.description}>{anomalie.description}</li>
                        ))}
                    </ul>
                ) : (
                    <span className="text-xs text-muted-foreground">Aucune</span>
                )}
            </TableCell>
            <TableCell>
                <Badge variant={getStatusVariant(dialogue.status) as any}>{dialogue.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                        <Link href={
                            dialogue.status === 'Brouillon' ? `/dashboard/audits/${dialogue.id}/edit` : 
                            dialogue.status === 'En attente de validation' && canManage ? `/dashboard/audits/${dialogue.id}/validate` :
                            `/dashboard/audits/${dialogue.id}`
                        }>
                            {dialogue.status === 'En attente de validation' && canManage ? (
                                <>
                                 <ListChecks className="mr-2 h-4 w-4" /> Traiter
                                </>
                            ): (
                                <>
                                  <Eye className="mr-2 h-4 w-4" /> {dialogue.status === 'Brouillon' ? 'Modifier' : 'Voir'}
                                </>
                            )}
                        </Link>
                    </Button>
                </TableCell>
            </TableRow>
        )) : (
             <TableRow><TableCell colSpan={7} className="h-24 text-center">{emptyMessage}</TableCell></TableRow>
        )}
        </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dialogue Sécurité / حوار السلامة</h1>
        <p className="text-muted-foreground">
          Suivi des dialogues sécurité réalisés sur le terrain.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dialogues Réalisés (Mois)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{stats?.dialoguesCeMois}</div>}
             <p className="text-xs text-muted-foreground">Depuis le début du mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Signalées (Total)</CardTitle>
             <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats?.totalAnomalies}</div>}
            <p className="text-xs text-muted-foreground">Dans tous les dialogues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Observateur</CardTitle>
             <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-bold">{stats?.topObservateur.name}</div>}
            {loading ? <Skeleton className="h-4 w-24 mt-1" /> : <p className="text-xs text-muted-foreground">Avec {stats?.topObservateur.count} dialogues</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-full lg:col-span-4">
            <Tabs defaultValue={canManage && pendingDialogues.length > 0 ? "pending" : "history"}>
                <TabsList className="grid w-full grid-cols-2">
                    {canManage && (
                        <TabsTrigger value="pending">
                            À Valider
                            {pendingDialogues.length > 0 && 
                                <Badge variant="destructive" className="ml-2">{pendingDialogues.length}</Badge>
                            }
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="history" className={!canManage ? "col-span-2" : ""}>Historique</TabsTrigger>
                </TabsList>
                {canManage && (
                    <TabsContent value="pending">
                        <Card>
                             <CardHeader>
                                <CardTitle>Dialogues en attente de validation</CardTitle>
                                <CardDescription>Ces dialogues doivent être revus et validés.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderTable(pendingDialogues, "Aucun dialogue en attente de validation.", true)}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historique des Dialogues Sécurité</CardTitle>
                            <CardDescription>Liste de tous les dialogues réalisés, en brouillon ou en cours.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {renderTable(historicalDialogues, "Aucun dialogue dans l'historique.")}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
        <Card className="col-span-full lg:col-span-3 min-w-0">
            <CardHeader>
                <CardTitle>Anomalies par Type</CardTitle>
                <CardDescription>Répartition des anomalies signalées dans les DS.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
                {loading || !stats ? <Skeleton className="w-full h-full" /> :
                    <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                                data={stats.anomaliesParType}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label
                            >
                                {stats.anomaliesParType.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                }
            </CardContent>
        </Card>
      </div>

       <div className="fixed bottom-8 right-8">
            <Button asChild size="lg" className="rounded-full h-16 w-16 shadow-lg bg-accent hover:bg-accent/90">
                <Link href="/dashboard/audits/new">
                    <FilePlus2 className="h-8 w-8" />
                    <span className="sr-only">Ajouter un DS</span>
                </Link>
            </Button>
        </div>
    </div>
  )
}

